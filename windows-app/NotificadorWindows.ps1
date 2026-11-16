# ==============================================================================
# NOTIFICADOR NATIVO DE WHATSAPP PARA WINDOWS (SYSTEM TRAY)
# Funciona en 100% de PCs con Windows 10 y 11 sin instalar nada extra.
# ==============================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $scriptDir "config.json"
$iconFile = Join-Path $scriptDir "icono.ico"

# Valores por defecto
$defaultScriptUrl = "https://script.google.com/macros/s/AKfycbziC1cvnny7cw_vgvinHD1-6G0VIRmjgGyDTCjp-MevQGcC6wBQkanDyUOJ14NvpmAujw/exec"
$defaultSheetsUrl = "https://docs.google.com/spreadsheets/d/1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA/edit"

# Cargar o crear configuración
$config = @{
    scriptUrl = $defaultScriptUrl
    sheetsUrl = $defaultSheetsUrl
    userName = ""
    userEmail = ""
    servicioActivo = $true
    inicioAutomatico = $true
}

if (Test-Path $configFile) {
    try {
        $loaded = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($loaded.scriptUrl) { $config.scriptUrl = $loaded.scriptUrl }
        if ($loaded.sheetsUrl) { $config.sheetsUrl = $loaded.sheetsUrl }
        if ($loaded.userName) { $config.userName = $loaded.userName }
        if ($loaded.userEmail) { $config.userEmail = $loaded.userEmail }
        if ($null -ne $loaded.servicioActivo) { $config.servicioActivo = $loaded.servicioActivo }
        if ($null -ne $loaded.inicioAutomatico) { $config.inicioAutomatico = $loaded.inicioAutomatico }
    } catch {}
}

function Guardar-Configuracion {
    $config | ConvertTo-Json -Depth 4 | Set-Content $configFile -Encoding UTF8
    Actualizar-InicioAutomatico
}

function Actualizar-InicioAutomatico {
    $startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
    $shortcutPath = Join-Path $startupFolder "NotificadorWSP.lnk"

    if ($config.inicioAutomatico) {
        $wshShell = New-Object -ComObject WScript.Shell
        $shortcut = $wshShell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "wscript.exe"
        $shortcut.Arguments = "`"" + (Join-Path $scriptDir "IniciarSilencioso.vbs") + "`""
        $shortcut.WorkingDirectory = $scriptDir
        $shortcut.Description = "Notificador de WhatsApp para Windows"
        if (Test-Path $iconFile) { $shortcut.IconLocation = $iconFile }
        $shortcut.Save()
    } else {
        if (Test-Path $shortcutPath) {
            Remove-Item $shortcutPath -Force
        }
    }
}

# Icono en la bandeja del sistema (System Tray)
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
if (Test-Path $iconFile) {
    $notifyIcon.Icon = New-Object System.Drawing.Icon $iconFile
} else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$notifyIcon.Text = "Notificador WhatsApp (Iniciando...)"
$notifyIcon.Visible = $true

# Menú contextual del System Tray
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$menuItemEstado = $contextMenu.Items.Add("🟢 Servicio: En Línea")
$menuItemToggle = $contextMenu.Items.Add("⏸️ Pausar / Iniciar Servicio")
$menuItemConfig = $contextMenu.Items.Add("👤 Configurar Nombre y Datos")
$menuItemSheets = $contextMenu.Items.Add("📊 Abrir Excel en Drive")
$menuItemWsp = $contextMenu.Items.Add("💬 Abrir WhatsApp Web")
$contextMenu.Items.Add("-") | Out-Null
$menuItemVerificar = $contextMenu.Items.Add("🔄 Verificar Turno Ahora")
$menuItemSalir = $contextMenu.Items.Add("❌ Salir")

$notifyIcon.ContextMenuStrip = $contextMenu

# Variables de estado en memoria
$script:ultimoEstado = $null
$script:ventanaAlerta = $null
$script:alertaCerrandose = $false

# Función para abrir la ventana de configuración
function Mostrar-VentanaConfiguracion {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Configuración - Notificador WhatsApp"
    $form.Size = New-Object System.Drawing.Size(380, 310)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(240, 242, 245)
    if (Test-Path $iconFile) { $form.Icon = New-Object System.Drawing.Icon $iconFile }

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "⚙️ Datos del Técnico / Usuario"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(0, 92, 75)
    $lblTitle.Location = New-Object System.Drawing.Point(20, 15)
    $lblTitle.Size = New-Object System.Drawing.Size(320, 25)
    $form.Controls.Add($lblTitle)

    $lblNombre = New-Object System.Windows.Forms.Label
    $lblNombre.Text = "Nombre y Apellido:"
    $lblNombre.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
    $lblNombre.Location = New-Object System.Drawing.Point(20, 50)
    $lblNombre.Size = New-Object System.Drawing.Size(320, 18)
    $form.Controls.Add($lblNombre)

    $txtNombre = New-Object System.Windows.Forms.TextBox
    $txtNombre.Text = $config.userName
    $txtNombre.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $txtNombre.Location = New-Object System.Drawing.Point(20, 70)
    $txtNombre.Size = New-Object System.Drawing.Size(320, 25)
    $form.Controls.Add($txtNombre)

    $lblCorreo = New-Object System.Windows.Forms.Label
    $lblCorreo.Text = "Correo Gmail / Empresa:"
    $lblCorreo.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
    $lblCorreo.Location = New-Object System.Drawing.Point(20, 105)
    $lblCorreo.Size = New-Object System.Drawing.Size(320, 18)
    $form.Controls.Add($lblCorreo)

    $txtCorreo = New-Object System.Windows.Forms.TextBox
    $txtCorreo.Text = $config.userEmail
    $txtCorreo.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $txtCorreo.Location = New-Object System.Drawing.Point(20, 125)
    $txtCorreo.Size = New-Object System.Drawing.Size(320, 25)
    $form.Controls.Add($txtCorreo)

    $chkInicio = New-Object System.Windows.Forms.CheckBox
    $chkInicio.Text = "Iniciar automáticamente al encender Windows"
    $chkInicio.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $chkInicio.Checked = $config.inicioAutomatico
    $chkInicio.Location = New-Object System.Drawing.Point(20, 165)
    $chkInicio.Size = New-Object System.Drawing.Size(320, 22)
    $form.Controls.Add($chkInicio)

    $btnGuardar = New-Object System.Windows.Forms.Button
    $btnGuardar.Text = "Guardar y Continuar"
    $btnGuardar.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $btnGuardar.BackColor = [System.Drawing.Color]::FromArgb(37, 211, 102)
    $btnGuardar.ForeColor = [System.Drawing.Color]::White
    $btnGuardar.FlatStyle = "Flat"
    $btnGuardar.Location = New-Object System.Drawing.Point(20, 205)
    $btnGuardar.Size = New-Object System.Drawing.Size(320, 36)
    $btnGuardar.Add_Click({
        $nom = $txtNombre.Text.Trim()
        if ([string]::IsNullOrWhiteSpace($nom)) {
            [System.Windows.Forms.MessageBox]::Show("Por favor escribe tu Nombre y Apellido.", "Dato Requerido", "OK", "Warning")
            return
        }
        $config.userName = $nom
        $config.userEmail = $txtCorreo.Text.Trim()
        $config.inicioAutomatico = $chkInicio.Checked
        Guardar-Configuracion
        $form.Close()
        [System.Windows.Forms.MessageBox]::Show("¡Configuración guardada! El notificador está activo.", "Éxito", "OK", "Information")
    })
    $form.Controls.Add($btnGuardar)

    $form.ShowDialog() | Out-Null
}

# Ventana de Alerta Emergente Flotante en Windows (Always On Top)
function Mostrar-VentanaAlerta($estado) {
    if ($null -ne $script:ventanaAlerta -and !$script:ventanaAlerta.IsDisposed) {
        Actualizar-ContenidoAlerta $estado
        return
    }

    $form = New-Object System.Windows.Forms.Form
    $script:ventanaAlerta = $form

    $form.Text = "Alerta WhatsApp"
    $form.Size = New-Object System.Drawing.Size(360, 200)
    $form.FormBorderStyle = "None"
    $form.TopMost = $true
    $form.ShowInTaskbar = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(254, 242, 242)

    # Posicionar abajo a la derecha sobre la barra de tareas
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $form.Location = New-Object System.Drawing.Point(($screen.Right - 375), ($screen.Bottom - 215))

    # Borde rojo
    $panelBorder = New-Object System.Windows.Forms.Panel
    $panelBorder.Dock = "Fill"
    $panelBorder.BorderStyle = "FixedSingle"
    $form.Controls.Add($panelBorder)

    # Encabezado
    $header = New-Object System.Windows.Forms.Panel
    $header.Dock = "Top"
    $header.Height = 36
    $header.BackColor = [System.Drawing.Color]::FromArgb(185, 28, 28)
    $panelBorder.Controls.Add($header)

    $lblHdr = New-Object System.Windows.Forms.Label
    $lblHdr.Text = "🔔 ¡Hora de revisar WhatsApp!"
    $lblHdr.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $lblHdr.ForeColor = [System.Drawing.Color]::White
    $lblHdr.Location = New-Object System.Drawing.Point(10, 8)
    $lblHdr.AutoSize = $true
    $header.Controls.Add($lblHdr)

    $lblClose = New-Object System.Windows.Forms.Label
    $lblClose.Text = "✕"
    $lblClose.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $lblClose.ForeColor = [System.Drawing.Color]::White
    $lblClose.Location = New-Object System.Drawing.Point(335, 8)
    $lblClose.Cursor = [System.Windows.Forms.Cursors]::Hand
    $lblClose.Add_Click({ $form.Close() })
    $header.Controls.Add($lblClose)

    # Cuerpo
    $lblDesc = New-Object System.Windows.Forms.Label
    $lblDesc.Name = "lblDesc"
    $lblDesc.Text = "Turno $($estado.horaTurno) pendiente.`nToca 'Responder notificación' para atenderlo."
    $lblDesc.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $lblDesc.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
    $lblDesc.Location = New-Object System.Drawing.Point(14, 46)
    $lblDesc.Size = New-Object System.Drawing.Size(330, 40)
    $panelBorder.Controls.Add($lblDesc)

    # Botón Principal
    $btnAccion = New-Object System.Windows.Forms.Button
    $btnAccion.Name = "btnAccion"
    $btnAccion.Text = "🙋 Responder notificación"
    $btnAccion.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $btnAccion.BackColor = [System.Drawing.Color]::FromArgb(239, 68, 68)
    $btnAccion.ForeColor = [System.Drawing.Color]::White
    $btnAccion.FlatStyle = "Flat"
    $btnAccion.Location = New-Object System.Drawing.Point(14, 95)
    $btnAccion.Size = New-Object System.Drawing.Size(330, 40)
    $btnAccion.Cursor = [System.Windows.Forms.Cursors]::Hand

    $btnAccion.Add_Click({
        if ($script:ultimoEstado.fase -eq "PENDIENTE") {
            $btnAccion.Text = "Avisando al equipo..."
            $btnAccion.Enabled = $false
            Ejecutar-Accion "tomar_revision"
        } elseif ($script:ultimoEstado.fase -eq "EN_PROCESO") {
            $btnAccion.Text = "Guardando en Excel..."
            $btnAccion.Enabled = $false
            Ejecutar-Accion "finalizar_revision"
        }
    })
    $panelBorder.Controls.Add($btnAccion)

    # Botón secundario abrir WhatsApp
    $lnkWhatsApp = New-Object System.Windows.Forms.LinkLabel
    $lnkWhatsApp.Text = "Abrir WhatsApp Web"
    $lnkWhatsApp.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $lnkWhatsApp.LinkColor = [System.Drawing.Color]::FromArgb(0, 92, 75)
    $lnkWhatsApp.Location = New-Object System.Drawing.Point(14, 145)
    $lnkWhatsApp.AutoSize = $true
    $lnkWhatsApp.Add_Click({
        [System.Diagnostics.Process]::Start("https://web.whatsapp.com")
    })
    $panelBorder.Controls.Add($lnkWhatsApp)

    # Sonido de alerta
    [System.Media.SystemSounds]::Asterisk.Play()

    $form.Show()
}

function Actualizar-ContenidoAlerta($estado) {
    if ($null -eq $script:ventanaAlerta -or $script:ventanaAlerta.IsDisposed) { return }

    $lblDesc = $script:ventanaAlerta.Controls[0].Controls["lblDesc"]
    $btnAccion = $script:ventanaAlerta.Controls[0].Controls["btnAccion"]

    $miNombre = ($config.userName).Trim().ToLower()
    $soyYo = ($estado.atendidoPor -and $estado.atendidoPor.Trim().ToLower() -eq $miNombre)

    if ($estado.fase -eq "EN_PROCESO") {
        if ($soyYo) {
            $lblDesc.Text = "👀 Estás revisando WhatsApp.`nToca el botón al terminar para registrar en el Excel."
            $btnAccion.Text = "✅ Terminé de revisar"
            $btnAccion.BackColor = [System.Drawing.Color]::FromArgb(37, 211, 102)
            $btnAccion.Enabled = $true
        } else {
            $lblDesc.Text = "🟡 $($estado.atendidoPor) estará revisando WhatsApp.`nEsta alerta se cerrará en instantes."
            $btnAccion.Visible = $false
            # Auto-cerrar en 6 segundos
            Start-Sleep -Seconds 6
            if ($script:ventanaAlerta -and !$script:ventanaAlerta.IsDisposed) {
                $script:ventanaAlerta.Close()
            }
        }
    } elseif ($estado.fase -eq "COMPLETADO") {
        $lblDesc.Text = "🟢 Turno completado por $($estado.revisadoPor)."
        $btnAccion.Visible = $false
        Start-Sleep -Seconds 4
        if ($script:ventanaAlerta -and !$script:ventanaAlerta.IsDisposed) {
            $script:ventanaAlerta.Close()
        }
    }
}

function Cerrar-Alerta {
    if ($null -ne $script:ventanaAlerta -and !$script:ventanaAlerta.IsDisposed) {
        $script:ventanaAlerta.Close()
        $script:ventanaAlerta = $null
    }
}

# Llamada a la API de Google Apps Script
function Consultar-Estado {
    if (!$config.servicioActivo) {
        $notifyIcon.Text = "Notificador WhatsApp (Pausado)"
        $menuItemEstado.Text = "⚪ Servicio: Pausado"
        return
    }

    try {
        $url = "$($config.scriptUrl)?action=status&t=" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 10

        if (!$resp.ok) { return }

        $script:ultimoEstado = $resp

        if (!$resp.enHorario) {
            $notifyIcon.Text = "Notificador WhatsApp (Fuera de horario 8-18hs)"
            $menuItemEstado.Text = "🌙 Fuera de horario laboral"
            Cerrar-Alerta
            return
        }

        $notifyIcon.Text = "Notificador WhatsApp (En línea)"
        $menuItemEstado.Text = "🟢 Servicio: En Línea"

        if ($resp.fase -eq "PENDIENTE") {
            Mostrar-VentanaAlerta $resp
        } elseif ($resp.fase -eq "EN_PROCESO") {
            if ($null -ne $script:ventanaAlerta -and !$script:ventanaAlerta.IsDisposed) {
                Actualizar-ContenidoAlerta $resp
            }
        } elseif ($resp.fase -eq "COMPLETADO") {
            Cerrar-Alerta
        }

    } catch {
        # Error silencioso de red / offline
    }
}

function Ejecutar-Accion($accion) {
    if ([string]::IsNullOrWhiteSpace($config.userName)) {
        Mostrar-VentanaConfiguracion
        return
    }

    try {
        $body = @{
            action = $accion
            nombre = $config.userName
            correo = $config.userEmail
            slotId = $script:ultimoEstado.turnoActual
        } | ConvertTo-Json

        $resp = Invoke-RestMethod -Uri $config.scriptUrl -Method Post -Body $body -ContentType "text/plain;charset=utf-8" -TimeoutSec 10

        if ($resp.ok) {
            Consultar-Estado
        }
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Error de conexión al guardar en Excel.", "Aviso", "OK", "Error")
    }
}

# Handlers de menú contextual
$menuItemToggle.Add_Click({
    $config.servicioActivo = !$config.servicioActivo
    Guardar-Configuracion
    Consultar-Estado
})

$menuItemConfig.Add_Click({
    Mostrar-VentanaConfiguracion
})

$menuItemSheets.Add_Click({
    [System.Diagnostics.Process]::Start($config.sheetsUrl)
})

$menuItemWsp.Add_Click({
    [System.Diagnostics.Process]::Start("https://web.whatsapp.com")
})

$menuItemVerificar.Add_Click({
    Consultar-Estado
})

$menuItemSalir.Add_Click({
    Cerrar-Alerta
    $notifyIcon.Visible = $false
    [System.Windows.Forms.Application]::Exit()
})

$notifyIcon.Add_DoubleClick({
    Mostrar-VentanaConfiguracion
})

# Timer periódico (cada 25 segundos)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 25000
$timer.Add_Tick({ Consultar-Estado })
$timer.Start()

# Si es la primera vez que se abre y no tiene nombre, pedirlo
if ([string]::IsNullOrWhiteSpace($config.userName)) {
    Mostrar-VentanaConfiguracion
}

# Verificación inicial
Consultar-Estado

# Iniciar loop de eventos de Windows Forms
[System.Windows.Forms.Application]::Run()
