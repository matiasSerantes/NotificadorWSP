# 🔔 Notificador de Revisión de WhatsApp (NotificadorWSP)

Sistema de alerta y auditoría para equipos de trabajo. Notifica automáticamente cada **30 minutos** (entre las **08:00 y las 18:00 hs**) la obligación de revisar WhatsApp, sincroniza en tiempo real a todos los miembros conectados y registra en planillas de **Google Sheets (Drive)** la hora de inicio, hora de fin y quién atendió.

---

## 💻 2 Opciones de Uso (Elige o combina ambas)

### 1. 🪟 Aplicación Nativa de Windows (Bandeja del sistema)
- **100% independiente de Chrome**: No necesitas tener el navegador abierto.
- Funciona directamente en Windows 10 y 11 con **cero instalaciones adicionales**.
- **Icono en la barra de tareas** (al lado del reloj de Windows).
- Lanza una **ventana emergente flotante en pantalla** (por encima de cualquier programa que uses) con sonido:
  - `[ 🙋 Responder notificación ]`
  - Al hacer clic cambia a: `[ ✅ Terminé de revisar ]`
- **Auto-Arranque**: Se inicia automáticamente al encender la computadora.
- Se ejecuta directamente con [`IniciarNotificadorWindows.bat`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/IniciarNotificadorWindows.bat).

### 2. 🌐 Extensión para Google Chrome
- Ubicada en la carpeta [`extension/`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/extension).
- Barra flotante interactiva dentro de `web.whatsapp.com` y ventana emergente de Chrome.
- Ambas opciones (Windows y Chrome) están sincronizadas con la misma base de datos.

---

## ⚡ Instalador y Actualizador Todo en Uno: [`autoupdate.bat`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/autoupdate.bat)

El archivo `autoupdate.bat` hace todo automáticamente en la computadora del técnico:
1. **Descarga la última versión** desde tu repositorio de GitHub (`matiasSerantes/NotificadorWSP`).
2. **Crea el acceso directo** en el Escritorio.
3. **Configura el inicio automático** con Windows en la carpeta `Startup`.
4. **Inicia el programa** en segundo plano al lado del reloj.

---

## 🔄 Flujo de Trabajo en 2 Pasos

```
[ ALERTA CADA 30 MIN (08:00 a 18:00 hs) ]
                  │
                  ▼
   A todo el equipo le salta la notificación:
   "🔔 ¡Hora de revisar WhatsApp!"
   Botón: [ 🙋 Responder notificación ]
                  │
     Matias hace clic en el botón:
                  │
                  ├──> 👥 AL RESTO DEL EQUIPO:
                  │    Les aparece: "🟡 Matias estará revisando WhatsApp"
                  │    (Dura 6 segundos y se cierra sola para no molestar).
                  │
                  └──> 👤 A MATIAS (Quien atiende):
                       Le queda visible:
                       "👀 Revisando WhatsApp... Presiona el botón al terminar de revisar."
                       Botón: [ ✅ Terminé de revisar ]
                              │
                              ▼
           Cuando Matias termina de atender los mensajes y toca "Terminé de revisar":
           1. Se guarda en el Excel: Fecha, Día, Turno, Hora Inicio, Hora Fin, Nombre y Gmail.
           2. El turno queda COMPLETADO para todos.
```

---

## 📊 Planillas en Google Drive (Pre-configuradas)

- **Planilla de Registro:** [Registro Revisión WhatsApp](https://docs.google.com/spreadsheets/d/1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA/edit)  
  *ID:* `1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA`
- **Planilla de Auditoría:** [Log Fallas y Errores WhatsApp](https://docs.google.com/spreadsheets/d/1AuYtFE6QV-TdJPL8-FjPy56iIh6wiTdpF4LBBsmn0fM/edit)  
  *ID:* `1AuYtFE6QV-TdJPL8-FjPy56iIh6wiTdpF4LBBsmn0fM`
- **API Apps Script:**  
  `https://script.google.com/macros/s/AKfycbziC1cvnny7cw_vgvinHD1-6G0VIRmjgGyDTCjp-MevQGcC6wBQkanDyUOJ14NvpmAujw/exec`
