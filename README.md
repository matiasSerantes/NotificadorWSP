# 🔔 Notificador de Revisión de WhatsApp (NotificadorWSP)

Sistema de alerta y auditoría para equipos de trabajo. Notifica automáticamente cada **30 minutos** (entre las **08:00 y las 18:00 hs**) la obligación de revisar WhatsApp, sincroniza en tiempo real a todos los miembros conectados y registra en planillas de **Google Sheets (Drive)** la hora de inicio, hora de fin y quién atendió.

---

## 🔄 Flujo de Trabajo en 2 Pasos

```
[ ALERTA CADA 30 MIN ]
        │
        ▼
   A todos les salta: "🔔 ¡Hora de revisar WhatsApp!"
        │
        ├──> Botón: [ 🙋 Responder notificación ]
        │
   Matias toca el botón:
        │
        ├──> AL RESTO DEL EQUIPO:
        │    Les avisa: "🟡 Matias estará revisando WhatsApp"
        │    (Dura 6 segundos y se va solo para no interrumpir).
        │
        └──> A MATIAS (Quien atiende):
             Le queda activo: "👀 Revisando WhatsApp... Presiona el botón al terminar de revisar."
             Botón: [ ✅ Terminé de revisar ]
                    │
                    ▼
          Al terminar de responder mensajes, Matias toca "Terminé de revisar":
          - Se guarda en el Excel: Fecha, Día, Turno, Hora Inicio, Hora Fin, Nombre y Gmail.
          - Se marca el turno como COMPLETADO para todo el equipo.
```

---

## 📊 Planillas Excel Preparadas (Listas para Google Drive)

### 1. [`Registro Revisión WhatsApp.xlsx`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/Registro%20Revisi%C3%B3n%20WhatsApp.xlsx) (Planilla Principal)
- **`📋 Registro Detallado`**: Historial continuo fila por fila con:
  `ID` | `Fecha` | `Día` | `Turno` | `Hora Inicio` | `Hora Fin` | `Responsable` | `Correo Gmail` | `Demora (min)` | `Estado`
- **`📅 Matriz Semanal (Día y Hora)`**: Grilla visual de 08:00 a 18:00 hs (20 bloques de 30 min) para ubicar rápidamente quién cubrió cada franja horaria de Lunes a Viernes.
- **`📊 Métricas y Resumen`**: KPIs (% cumplimiento rápido) y ranking de participación por persona.
- **`⚙️ Configuración`**: Parámetros de horarios y **Días de Historial a Conservar (7 días por defecto)**.

### 2. [`Log Fallas y Errores WhatsApp.xlsx`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/Log%20Fallas%20y%20Errores%20WhatsApp.xlsx) (Planilla de Auditoría)
- **`⚠️ Turnos Sin Revisar`**: Registra turnos de 30 min donde nadie atendió (turnos vencidos).
- **`🛠️ Errores Técnicos y Red`**: Registra caídas de conexión o reintentos de la extensión.

---

## 🔒 ¿Cómo funcionan los permisos de Google Drive?

> [!IMPORTANT]
> **No necesitas pedir acceso al Drive de los empleados ni te van a llegar solicitudes de acceso.**
>
> Al implementar el script de Google Apps Script como **Aplicación Web**:
> 1. En *Ejecutar como*, se selecciona: **Yo (tu cuenta de Google)**.
> 2. En *Quién tiene acceso*, se selecciona: **Cualquiera (Anyone)**.
>
> De esta forma, el script escribe en la planilla con tus credenciales. Los usuarios no necesitan cuenta de Google ni permisos en tu Drive.

---

## 🚀 Guía Rápida de Instalación

Consulta la guía completa: 👉 [INSTRUCCIONES_DRIVE.md](file:///c:/Users/matias/programas%20personales/NotificadorWSP/google-apps-script/INSTRUCCIONES_DRIVE.md)

1. **Subir los dos archivos a Google Drive**:
   - Sube `Registro Revisión WhatsApp.xlsx` y `Log Fallas y Errores WhatsApp.xlsx`.
2. **Pegar el script**:
   - Abre `Registro Revisión WhatsApp`, ve a **Extensiones** > **Apps Script**, pega el código de [`Codigo.js`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/google-apps-script/Codigo.js) y guarda.
3. **Implementar**:
   - Haz clic en **Implementar** > **Nueva implementación** > Tipo: **Aplicación Web** > Acceso: **Cualquiera** > **Implementar** y copia la URL.
4. **Instalar la Extensión**:
   - En Chrome ve a `chrome://extensions/`, activa el *Modo de desarrollador* y haz clic en *Cargar descomprimida*.
   - Selecciona la carpeta [`extension/`](file:///c:/Users/matias/programas%20personales/NotificadorWSP/extension).
   - Abre la extensión, pon tu Nombre, Correo Gmail y la URL de Apps Script.
   - Haz clic en **INICIAR SERVICIO** para ponerte en línea.
