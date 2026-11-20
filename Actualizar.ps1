[CmdletBinding()]
param(
    [string]$ArchivePath,
    [switch]$SkipIntegration,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$installationDir = $PSScriptRoot
$temporaryDir = Join-Path ([IO.Path]::GetTempPath()) ('NotificadorWSP-update-' + [Guid]::NewGuid())
$exitCode = 0
$appliedFiles = New-Object 'System.Collections.Generic.List[object]'
$appWasRunning = $false
$appStopped = $false
$changesConfirmed = $false

function Set-NotificadorShortcut {
    param([string]$ShortcutPath)
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $shortcut.Arguments = '"' + (Join-Path $installationDir 'windows-app\IniciarSilencioso.vbs') + '"'
    $shortcut.WorkingDirectory = Join-Path $installationDir 'windows-app'
    $shortcut.IconLocation = Join-Path $installationDir 'windows-app\icono.ico'
    $shortcut.Description = 'Notificador WhatsApp'
    $shortcut.Save()
}

try {
    Write-Host 'Descargando y actualizando Notificador WhatsApp...' -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $temporaryDir | Out-Null
    $zipPath = Join-Path $temporaryDir 'actualizacion.zip'
    if ($ArchivePath) {
        Copy-Item -LiteralPath $ArchivePath -Destination $zipPath
    } else {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $downloadUrl = 'https://codeload.github.com/matiasSerantes/NotificadorWSP/zip/refs/heads/main'
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 90
    }
    $extractDir = Join-Path $temporaryDir 'descarga'
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir
    $roots = @(Get-ChildItem -LiteralPath $extractDir -Directory)
    if ($roots.Count -ne 1) { throw 'La descarga no contiene una carpeta de proyecto valida.' }
    $sourceDir = $roots[0].FullName
    $requiredFiles = @(
        'extension\manifest.json',
        'extension\background.js',
        'extension\popup.html',
        'extension\popup.js',
        'extension\whatsapp-injected.js',
        'extension\whatsapp-injected.css',
        'windows-app\NotificadorWindows.ps1',
        'windows-app\IniciarSilencioso.vbs',
        'windows-app\config.json',
        'IniciarNotificadorWindows.bat',
        'autoupdate.bat',
        'Actualizar.ps1'
    )
    foreach ($relative in $requiredFiles) {
        if (!(Test-Path -LiteralPath (Join-Path $sourceDir $relative) -PathType Leaf)) {
            throw "La descarga esta incompleta. Falta $relative"
        }
    }
    $manifest = Get-Content -LiteralPath (Join-Path $sourceDir 'extension\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if (!$manifest.version -or $manifest.manifest_version -ne 3) { throw 'El manifiesto de la extension no es valido.' }

    # Guardar la configuracion local y comprobarla antes de tocar la instalacion.
    $configPath = Join-Path $installationDir 'windows-app\config.json'
    $configSource = if (Test-Path -LiteralPath $configPath) { $configPath } else { Join-Path $sourceDir 'windows-app\config.json' }
    $config = Get-Content -LiteralPath $configSource -Raw -Encoding UTF8 | ConvertFrom-Json

    # Actualizar solo los archivos del programa, sin modificar el historial ni .git.
    $files = New-Object 'System.Collections.Generic.List[object]'
    foreach ($folder in @('extension', 'windows-app')) {
        $folderPath = Join-Path $sourceDir $folder
        foreach ($file in Get-ChildItem -LiteralPath $folderPath -File -Recurse) {
            $relative = $file.FullName.Substring($sourceDir.Length + 1)
            if ($relative -eq 'windows-app\config.json' -and (Test-Path -LiteralPath $configPath)) { continue }
            $files.Add(@{ Source = $file.FullName; Relative = $relative })
        }
    }
    foreach ($relative in @('IniciarNotificadorWindows.bat', 'autoupdate.bat', 'Actualizar.ps1', 'README.md', 'PRUEBA_EN_EQUIPO.txt')) {
        $source = Join-Path $sourceDir $relative
        if (Test-Path -LiteralPath $source -PathType Leaf) { $files.Add(@{ Source = $source; Relative = $relative }) }
    }
    $backupDir = Join-Path $temporaryDir 'respaldo'
    foreach ($file in $files) {
        $destination = Join-Path $installationDir $file.Relative
        $backup = Join-Path $backupDir $file.Relative
        $exists = Test-Path -LiteralPath $destination -PathType Leaf
        if ($exists) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
            Copy-Item -LiteralPath $destination -Destination $backup
        }
        $file.Destination = $destination
        $file.Backup = $backup
        $file.Existed = $exists
    }

    if (!$SkipIntegration) {
        $appPath = Join-Path $installationDir 'windows-app\NotificadorWindows.ps1'
        $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
            $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($appPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
        })
        $appWasRunning = $processes.Count -gt 0
        foreach ($process in $processes) {
            Stop-Process -Id $process.ProcessId -ErrorAction Stop
            Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
        }
        $appStopped = $appWasRunning
    }

    foreach ($file in $files) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $file.Destination) -Force | Out-Null
        $appliedFiles.Add($file)
        Copy-Item -LiteralPath $file.Source -Destination $file.Destination -Force
    }
    $changesConfirmed = $true
    Write-Host "Archivos actualizados a la version $($manifest.version)." -ForegroundColor Green
    Write-Host 'Los datos del usuario y la conexion se conservaron.'

    if (!$SkipIntegration) {
        $desktop = [Environment]::GetFolderPath('Desktop')
        if ($desktop) { Set-NotificadorShortcut (Join-Path $desktop 'Notificador WhatsApp.lnk') }
        if ($config.inicioAutomatico) {
            $startup = [Environment]::GetFolderPath('Startup')
            Set-NotificadorShortcut (Join-Path $startup 'NotificadorWSP.lnk')
        }
        if ($appWasRunning) {
            Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $installationDir 'windows-app\IniciarSilencioso.vbs') + '"') -WindowStyle Hidden
            $appStopped = $false
            Write-Host 'La aplicacion Windows fue reiniciada.'
        }
    }
    Write-Host ''
    Write-Host 'Si usas Chrome, abre chrome://extensions y pulsa Recargar en el notificador.' -ForegroundColor Yellow
    Write-Host 'Despues recarga WhatsApp Web con Ctrl+R.' -ForegroundColor Yellow
} catch {
    $exitCode = 1
    if (!$changesConfirmed) {
        foreach ($file in $appliedFiles) {
            if ($file.Existed) {
                Copy-Item -LiteralPath $file.Backup -Destination $file.Destination -Force
            } elseif (Test-Path -LiteralPath $file.Destination -PathType Leaf) {
                Remove-Item -LiteralPath $file.Destination -Force
            }
        }
    }
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($changesConfirmed) { Write-Host 'Los archivos se actualizaron, pero fallo la configuracion de accesos o el reinicio.' }
    else { Write-Host 'La actualizacion no se completo. Se conservaron los archivos anteriores.' }
    if ($appStopped) {
        Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $installationDir 'windows-app\IniciarSilencioso.vbs') + '"') -WindowStyle Hidden
    }
} finally {
    # El temporal tiene una ruta propia generada por este proceso y se conserva si hubo error.
    if ($exitCode -eq 0 -and (Test-Path -LiteralPath $temporaryDir)) {
        $resolved = [IO.Path]::GetFullPath($temporaryDir)
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved).StartsWith('NotificadorWSP-update-')) {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
    if (!$NoPause) { [void](Read-Host 'Presiona Enter para cerrar') }
}
exit $exitCode
