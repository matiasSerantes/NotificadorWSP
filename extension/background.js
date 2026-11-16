/**
 * Background Service Worker - Notificador Revisión WhatsApp
 * Pre-configurado con las URLs oficiales del usuario.
 */

const ALARM_NAME = 'wsp_check_alarm';
const FAST_POLL_ALARM = 'wsp_fast_poll_alarm';
const NOTIFICATION_ID = 'wsp_review_alert';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziC1cvnny7cw_vgvinHD1-6G0VIRmjgGyDTCjp-MevQGcC6wBQkanDyUOJ14NvpmAujw/exec';
const DEFAULT_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA/edit';

let ultimoEstado = {
  ok: true,
  enHorario: false,
  turnoActual: '',
  horaTurno: '',
  fase: 'PENDIENTE',
  atendidoPor: null,
  correoAtendiendo: null,
  horaInicioAtencion: null,
  revisado: false,
  revisadoPor: null,
  correo: null,
  horaRevision: null,
  ultimosLogs: []
};

// Al instalar o iniciar
chrome.runtime.onInstalled.addListener(() => {
  inicializarConfiguracionDefecto();
  detectarCorreoGoogle();
  verificarEstadoBadge();
});

chrome.runtime.onStartup.addListener(() => {
  inicializarConfiguracionDefecto();
  detectarCorreoGoogle();
  verificarEstadoBadge();
});

function inicializarConfiguracionDefecto() {
  chrome.storage.local.get(['scriptUrl', 'sheetsUrl'], (res) => {
    const toSet = {};
    if (!res.scriptUrl) toSet.scriptUrl = DEFAULT_SCRIPT_URL;
    if (!res.sheetsUrl) toSet.sheetsUrl = DEFAULT_SHEETS_URL;
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });
}

function detectarCorreoGoogle() {
  try {
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
        if (userInfo && userInfo.email) {
          chrome.storage.local.get(['userEmail'], (res) => {
            if (!res.userEmail) {
              chrome.storage.local.set({ userEmail: userInfo.email });
            }
          });
        }
      });
    }
  } catch (e) {
    console.log('[NotificadorWSP] Identity error:', e);
  }
}

async function obtenerConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['scriptUrl', 'sheetsUrl', 'userName', 'userEmail', 'servicioActivo'], (res) => {
      const scriptUrl = res.scriptUrl || DEFAULT_SCRIPT_URL;
      const sheetsUrl = res.sheetsUrl || DEFAULT_SHEETS_URL;

      if (!res.scriptUrl || !res.sheetsUrl) {
        chrome.storage.local.set({ scriptUrl, sheetsUrl });
      }

      resolve({
        scriptUrl: scriptUrl,
        sheetsUrl: sheetsUrl,
        userName: res.userName || '',
        userEmail: res.userEmail || '',
        servicioActivo: res.servicioActivo === true
      });
    });
  });
}

async function verificarEstadoBadge() {
  const config = await obtenerConfig();
  if (!config.servicioActivo) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
    chrome.alarms.clear(ALARM_NAME);
    chrome.alarms.clear(FAST_POLL_ALARM);
    return;
  }

  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
    }
  });

  verificarEstado();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const config = await obtenerConfig();
  if (!config.servicioActivo) return;

  if (alarm.name === ALARM_NAME || alarm.name === FAST_POLL_ALARM) {
    verificarEstado();
  }
});

async function verificarEstado() {
  const config = await obtenerConfig();
  if (!config.servicioActivo) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
    return;
  }

  if (!config.scriptUrl) {
    chrome.action.setBadgeText({ text: '⚙️' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    return;
  }

  try {
    const url = `${config.scriptUrl}?action=status&t=${Date.now()}`;
    const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
    const data = await resp.json();

    if (!data.ok) return;

    const estadoAnterior = { ...ultimoEstado };
    ultimoEstado = data;

    difundirEstadoATabs(data);

    if (!data.enHorario) {
      chrome.action.setBadgeText({ text: '🌙' });
      chrome.action.setBadgeBackgroundColor({ color: '#4b5563' });
      chrome.alarms.clear(FAST_POLL_ALARM);
      return;
    }

    const miNombre = (config.userName || '').trim().toLowerCase();
    const soyYoQuienAtiende = data.atendidoPor && data.atendidoPor.toLowerCase() === miNombre;

    // FASE 1: PENDIENTE
    if (data.fase === 'PENDIENTE') {
      chrome.action.setBadgeText({ text: '30m' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });

      mostrarNotificacionPendiente(data.horaTurno);
      chrome.alarms.create(FAST_POLL_ALARM, { periodInMinutes: 0.25 });
      return;
    }

    // FASE 2: EN PROCESO
    if (data.fase === 'EN_PROCESO') {
      chrome.alarms.create(FAST_POLL_ALARM, { periodInMinutes: 0.25 });

      if (soyYoQuienAtiende) {
        chrome.action.setBadgeText({ text: 'REV' });
        chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
        mostrarNotificacionEnProcesoPropia();
      } else {
        chrome.action.setBadgeText({ text: 'WSP' });
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
        mostrarNotificacionEnProcesoOtros(data.atendidoPor);
      }
      return;
    }

    // FASE 3: COMPLETADO
    if (data.fase === 'COMPLETADO') {
      chrome.alarms.clear(FAST_POLL_ALARM);

      if (estadoAnterior.fase !== 'COMPLETADO') {
        mostrarNotificacionFinalizado(data.revisadoPor, data.horaRevision);
      }

      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
    }

  } catch (err) {
    console.error('[NotificadorWSP] Error de conexión:', err);
  }
}

function mostrarNotificacionPendiente(horaTurno) {
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '🔔 ¡Hora de revisar WhatsApp!',
    message: `Turno ${horaTurno || 'actual'} pendiente. Toca 'Responder notificación' para atenderlo.`,
    priority: 2,
    requireInteraction: true,
    buttons: [
      { title: '🙋 Responder notificación' }
    ]
  });
}

function mostrarNotificacionEnProcesoPropia() {
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '👀 Revisando WhatsApp...',
    message: 'Presiona el botón al terminar de revisar para asentar en el Excel.',
    priority: 2,
    requireInteraction: true,
    buttons: [
      { title: '✅ Terminé de revisar' }
    ]
  });
}

function mostrarNotificacionEnProcesoOtros(nombre) {
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '🟡 Revisión en curso',
    message: `${nombre} estará revisando WhatsApp.`,
    priority: 1
  });

  setTimeout(() => {
    chrome.notifications.clear(NOTIFICATION_ID);
  }, 6000);
}

function mostrarNotificacionFinalizado(nombre, hora) {
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '🟢 WhatsApp revisado',
    message: `Turno finalizado por ${nombre} a las ${hora} hs.`,
    priority: 1
  });

  setTimeout(() => {
    chrome.notifications.clear(NOTIFICATION_ID);
  }, 5000);
}

chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  if (notifId === NOTIFICATION_ID) {
    if (ultimoEstado.fase === 'PENDIENTE') {
      await tomarRevision();
    } else if (ultimoEstado.fase === 'EN_PROCESO') {
      await finalizarRevision();
    }
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === NOTIFICATION_ID) {
    chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        chrome.tabs.create({ url: 'https://web.whatsapp.com' });
      }
    });
  }
});

async function tomarRevision(nombreParam, correoParam) {
  const config = await obtenerConfig();
  const nombre = nombreParam || config.userName;
  const correo = correoParam || config.userEmail || 'Sin correo';

  if (!nombre) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: '⚠️ Falta tu Nombre',
      message: 'Abre la extensión y escribe tu Nombre y Apellido.'
    });
    return { ok: false, error: 'Sin nombre configurado' };
  }

  if (!config.scriptUrl) {
    return { ok: false, error: 'Sin URL de Google Apps Script' };
  }

  try {
    const resp = await fetch(config.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'tomar_revision',
        nombre: nombre,
        correo: correo,
        slotId: ultimoEstado.turnoActual
      })
    });

    const data = await resp.json();

    if (data.ok) {
      ultimoEstado.fase = 'EN_PROCESO';
      ultimoEstado.atendidoPor = data.atendidoPor;
      ultimoEstado.correoAtendiendo = data.correoAtendiendo;
      ultimoEstado.horaInicioAtencion = data.horaInicioAtencion;

      mostrarNotificacionEnProcesoPropia();
      chrome.action.setBadgeText({ text: 'REV' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

      difundirEstadoATabs(ultimoEstado);
      return { ok: true, data: data };
    } else {
      return { ok: false, error: data.error };
    }
  } catch (err) {
    console.error('[NotificadorWSP] Error al tomar revisión:', err);
    return { ok: false, error: err.message };
  }
}

async function finalizarRevision(nombreParam, correoParam) {
  const config = await obtenerConfig();
  const nombre = nombreParam || config.userName;
  const correo = correoParam || config.userEmail || 'Sin correo';

  if (!config.scriptUrl) return { ok: false, error: 'Sin URL' };

  try {
    const resp = await fetch(config.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'finalizar_revision',
        nombre: nombre,
        correo: correo,
        slotId: ultimoEstado.turnoActual
      })
    });

    const data = await resp.json();

    if (data.ok) {
      ultimoEstado.fase = 'COMPLETADO';
      ultimoEstado.revisado = true;
      ultimoEstado.revisadoPor = data.revisadoPor;
      ultimoEstado.correo = data.correo;
      ultimoEstado.horaRevision = data.horaRevision;

      chrome.alarms.clear(FAST_POLL_ALARM);
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });

      mostrarNotificacionFinalizado(data.revisadoPor, data.horaRevision);
      difundirEstadoATabs(ultimoEstado);
      return { ok: true, data: data };
    } else {
      return { ok: false, error: data.error };
    }
  } catch (err) {
    console.error('[NotificadorWSP] Error al finalizar:', err);
    return { ok: false, error: err.message };
  }
}

function difundirEstadoATabs(estado) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          tipo: 'ESTADO_ACTUALIZADO',
          estado: estado
        }).catch(() => {});
      } catch (e) {}
    }
  });
}

chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje.tipo === 'GET_ESTADO') {
    obtenerConfig().then((cfg) => {
      sendResponse({ estado: ultimoEstado, config: cfg });
      if (cfg.servicioActivo) verificarEstado();
    });
    return true;
  }

  if (mensaje.tipo === 'TOGGLE_SERVICIO') {
    chrome.storage.local.set({ servicioActivo: mensaje.activo }, () => {
      verificarEstadoBadge();
      sendResponse({ ok: true, activo: mensaje.activo });
    });
    return true;
  }

  if (mensaje.tipo === 'TOMAR_REVISION') {
    tomarRevision(mensaje.nombre, mensaje.correo).then((res) => {
      sendResponse(res);
    });
    return true;
  }

  if (mensaje.tipo === 'FINALIZAR_REVISION') {
    finalizarRevision(mensaje.nombre, mensaje.correo).then((res) => {
      sendResponse(res);
    });
    return true;
  }

  if (mensaje.tipo === 'FORZAR_SINCRONIZACION') {
    verificarEstado().then(() => {
      sendResponse({ estado: ultimoEstado });
    });
    return true;
  }

  if (mensaje.tipo === 'PROBAR_NOTIFICACION') {
    mostrarNotificacionPendiente('10:30 (Prueba)');
    sendResponse({ ok: true });
    return true;
  }
});
