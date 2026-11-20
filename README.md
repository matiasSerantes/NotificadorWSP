# Notificador WhatsApp - registro con un clic

Despues de revisar los mensajes, tocar **Ya revise WhatsApp**. El sistema guarda
usuario, correo, fecha y hora en Google Sheets y avisa al resto del equipo.
No hay que marcar inicio y fin. Cada clic confirmado programa el proximo aviso
segun la frecuencia de Configuracion (60 minutos actualmente).

Ejemplos: 10:15 -> 11:15; siguiente registro a las 11:25 -> 12:25.
Puede registrarse antes del aviso; ese registro reinicia el contador compartido.
Se respetan el horario laboral y los dias configurados.

## Chrome

Descomprimir, abrir chrome://extensions, activar Modo desarrollador y Cargar
descomprimida seleccionando extension. Si ya estaba instalada, recargarla.
Guardar nombre y correo propios, iniciar el servicio y recargar WhatsApp Web.
La version de la extension es 1.3.3. Todos deben actualizarla para usar un clic.

## Windows

Ejecutar IniciarNotificadorWindows.bat. El menu de la bandeja incluye
Ya revise WhatsApp, disponible tambien antes del aviso. Reiniciar la app despues
de actualizar los archivos.

## Planilla compartida

https://docs.google.com/spreadsheets/d/1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA/edit

Registro Detallado es la fuente de verdad. Para conservar el historial anterior,
las columnas Inicio y Fin guardan la misma hora en el flujo de un clic.
Las revisiones anteriores conservan sus horas originales.

No crear otra planilla ni otro Apps Script para los otros usuarios.
Chrome consulta cada 30/60 segundos en segundo plano y cada 10 segundos con el
popup abierto; programa una alarma para el vencimiento del intervalo.
Windows consulta cada 10 segundos. Internet es necesario para guardar.

## Validacion

node backend-test.cjs
node regression-test.cjs

El codigo del servidor esta en google-apps-script/Codigo.js. Actualizar archivos
locales o ejecutar autoupdate.bat no publica Apps Script automaticamente.

Diez minutos antes del proximo aviso aparece un preaviso. Cada registro muestra
Revisado por el nombre del usuario y la hora. Otro clic del equipo reprograma
el proximo aviso y su preaviso.

La barra flotante de WhatsApp se mueve arrastrando su texto o fondo y recuerda
la posicion al recargar. El boton Ya revise WhatsApp registra la revision.

## Actualizar con doble clic

Ejecutar autoupdate.bat en la carpeta de instalacion. Descargar la ultima
version no requiere Git. El BAT ejecuta Actualizar.ps1, descarga main desde
GitHub y actualiza los archivos del programa conservando la configuracion local.
Si la app Windows estaba abierta, la reinicia despues de actualizar.
Al terminar, recargar la extension en chrome://extensions y WhatsApp Web.

Para instalar este actualizador por primera vez, descargar el ZIP nuevo y
extraerlo en una carpeta. Mantener autoupdate.bat y Actualizar.ps1 juntos.
