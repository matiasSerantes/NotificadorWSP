/**
 * Background Service Worker - Notificador Revisión WhatsApp
 * Pre-configurado con las URLs oficiales del usuario.
 */

const ALARM_NAME = 'wsp_check_alarm';
const FAST_POLL_ALARM = 'wsp_fast_poll_alarm';
const NOTIFICATION_ID = 'wsp_review_alert';
const PREAVISO_ALARM = 'wsp_preaviso';
const PREAVISO_NOTIFICATION = 'wsp_preaviso_alert';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziC1cvnny7cw_vgvinHD1-6G0VIRmjgGyDTCjp-MevQGcC6wBQkanDyUOJ14NvpmAujw/exec';
const DEFAULT_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA/edit';

let consultaEnCurso = false;
let consultaPendiente = null;
let accionEnCurso = false;
let ultimaNotificacion = '';

async function notificarCambio(data, mostrar) {
  const clave = [data.turnoActual, data.fase, data.atendidoPor || '', data.revisadoPor || ''].join('|');
  const previo = await chrome.storage.local.get(['ultimaNotificacion']);
  if (clave === ultimaNotificacion || clave === previo.ultimaNotificacion) return;
  ultimaNotificacion = clave;
  await chrome.storage.local.set({ ultimaNotificacion: clave });
  mostrar();
}

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
    chrome.alarms.clear('wsp_proxima_revision');
    chrome.alarms.clear(PREAVISO_ALARM);
    chrome.notifications.clear(PREAVISO_NOTIFICATION);
    chrome.notifications.clear(NOTIFICATION_ID);
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

  if (alarm.name === ALARM_NAME || alarm.name === FAST_POLL_ALARM || alarm.name === 'wsp_proxima_revision' || alarm.name === PREAVISO_ALARM) {
    verificarEstado();
  }
});

function verificarEstado() {
  if (!consultaPendiente) {
    consultaPendiente = consultarEstadoServidor().finally(() => { consultaPendiente = null; });
  }
  return consultaPendiente;
}

async function consultarEstadoServidor() {
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

  if (consultaEnCurso) return;
  consultaEnCurso = true;
  try {
    const url = `${config.scriptUrl}?action=status&t=${Date.now()}`;
    const resp = await fetch(url, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const data = await resp.json();

    if (accionEnCurso) return;
    if (!data.ok) throw new Error(data.error || 'El servidor no respondio correctamente');
    if (data.sheetsUrl) await chrome.storage.local.set({sheetsUrl:data.sheetsUrl});

    ultimoEstado = data;

    difundirEstadoATabs(data);

    if (!data.enHorario) {
      chrome.action.setBadgeText({ text: '🌙' });
      chrome.action.setBadgeBackgroundColor({ color: '#4b5563' });
      chrome.alarms.clear(FAST_POLL_ALARM);
      chrome.alarms.clear(PREAVISO_ALARM);
      chrome.notifications.clear(PREAVISO_NOTIFICATION);
      return;
    }

    if (data.fase === 'PENDIENTE') {
      chrome.action.setBadgeText({text:'WSP'});
      chrome.action.setBadgeBackgroundColor({color:'#dc2626'});
      await notificarCambio(data, mostrarNotificacionPendiente);
      chrome.alarms.create(FAST_POLL_ALARM,{periodInMinutes:0.5});
    } else {
      chrome.alarms.clear(FAST_POLL_ALARM);
      chrome.action.setBadgeText({text:'OK'});
      chrome.action.setBadgeBackgroundColor({color:'#16a34a'});
      await notificarCambio(data, () => mostrarNotificacionFinalizado(data.revisadoPor,data.horaRevision));
    }
    programarProximoAviso(data);
    await notificarPreaviso(data);
  } catch(err) {
    console.error('[NotificadorWSP] Error de conexion:',err);
    ultimoEstado = {...ultimoEstado, ok: false, error: err.message};
    difundirEstadoATabs(ultimoEstado);
  } finally {
    consultaEnCurso = false;
  }
}

function programarProximoAviso(data) {
  const restante = data.proximaRevisionMs - Date.now();
  if (restante > 0) {
    chrome.alarms.create('wsp_proxima_revision', {when: data.proximaRevisionMs});
  } else {
    chrome.alarms.clear('wsp_proxima_revision');
  }
  if (data.enHorario && restante > 10 * 60000) {
    chrome.alarms.create(PREAVISO_ALARM, {when: data.proximaRevisionMs - 10 * 60000});
    chrome.notifications.clear(PREAVISO_NOTIFICATION);
  } else {
    chrome.alarms.clear(PREAVISO_ALARM);
    if (restante <= 0) chrome.notifications.clear(PREAVISO_NOTIFICATION);
  }
}

async function notificarPreaviso(data) {
  const restante = data.proximaRevisionMs - Date.now();
  if (!data.enHorario || data.fase !== 'COMPLETADO' || restante <= 0 || restante > 10 * 60000) return;
  const clave = String(data.proximaRevisionMs);
  const guardado = await chrome.storage.local.get(['ultimoPreaviso']);
  if (guardado.ultimoPreaviso === clave) return;
  await chrome.storage.local.set({ultimoPreaviso: clave});
  const minutos = Math.ceil(restante / 60000);
  chrome.notifications.create(PREAVISO_NOTIFICATION, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Proxima revision de WhatsApp',
    message: `En ${minutos} minutos hay que revisar WhatsApp.`,
    priority: 1
  });
}

function mostrarNotificacionPendiente() {
  chrome.notifications.create(NOTIFICATION_ID, {
    type:'basic',iconUrl:'icons/icon-128.png',title:'Hora de revisar WhatsApp',
    message:'Revisa los mensajes y toca "Ya revise WhatsApp" para registrarlo.',
    priority:2,requireInteraction:true,buttons:[{title:'Ya revise WhatsApp'}]
  });
}

function mostrarNotificacionFinalizado(nombre, hora) {
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '🟢 WhatsApp revisado',
    message: `Revisado por ${nombre} a las ${hora}.`,
    priority: 1
  });

  setTimeout(() => {
    chrome.notifications.clear(NOTIFICATION_ID);
  }, 5000);
}

chrome.notifications.onButtonClicked.addListener(async (notifId) => {
  if (notifId !== NOTIFICATION_ID) return;
  const res = await registrarRevision();
  if (!res.ok) mostrarErrorAccion(res.error);
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

async function registrarRevision(nombreParam,correoParam) {
  if (accionEnCurso) return {ok:false,error:'El registro se esta guardando.'};
  accionEnCurso = true;
  try {
    const cfg = await obtenerConfig();
    const nombre = (nombreParam || cfg.userName).trim();
    const correo = (correoParam || cfg.userEmail || '').trim();
    if (!nombre) throw new Error('Primero guarda tu nombre en la extension.');
    const pendientes = await chrome.storage.local.get(['registroPendiente']);
    let registro = pendientes.registroPendiente;
    if (!registro || registro.nombre !== nombre || registro.correo !== correo) {
      registro = {action:'registrar_revision',nombre,correo,requestId:crypto.randomUUID()};
      await chrome.storage.local.set({registroPendiente:registro});
    }
    const resp = await fetch(cfg.scriptUrl,{
      method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(registro)
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'No se pudo guardar la revision');
    await chrome.storage.local.remove('registroPendiente');
    ultimoEstado = data;
    chrome.notifications.clear(NOTIFICATION_ID);
    chrome.action.setBadgeText({text:'OK'});
    chrome.action.setBadgeBackgroundColor({color:'#16a34a'});
    await notificarCambio(data,()=>mostrarNotificacionFinalizado(data.revisadoPor,data.horaRevision));
    programarProximoAviso(data);
    difundirEstadoATabs(data);
    return {ok:true,data};
  } catch(err) { return {ok:false,error:err.message}; }
  finally { accionEnCurso = false; }
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
    obtenerConfig().then(async (cfg) => {
      if (cfg.servicioActivo) await verificarEstado();
      sendResponse({ estado: ultimoEstado, config: cfg });
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

  if (mensaje.tipo === 'REGISTRAR_REVISION') {
    registrarRevision(mensaje.nombre,mensaje.correo).then(sendResponse);
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

function mostrarErrorAccion(error) {
  chrome.notifications.create('wsp_error_guardado', {
    type:'basic', iconUrl:'icons/icon-128.png', title:'No se pudo registrar la revision',
    message:error || 'Reintenta cuando se restablezca la conexion.', requireInteraction:true
  });
}
