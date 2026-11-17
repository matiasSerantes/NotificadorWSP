/**
 * ==============================================================================
 * SISTEMA DE CONTROL, REGISTRO Y LOG DE REVISIÓN DE WHATSAPP
 * Google Apps Script para Google Sheets (Drive)
 * ==============================================================================
 */

const CONFIG_BASE = {
  ID_SPREADSHEET_REGISTRO: '1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA',
  ID_SPREADSHEET_LOGS: '1AuYtFE6QV-TdJPL8-FjPy56iIh6wiTdpF4LBBsmn0fM',

  HOJA_REGISTRO: '📋 Registro Detallado',
  HOJA_MATRIZ: '📅 Matriz Semanal (Día y Hora)',
  HOJA_METRICAS: '📊 Métricas y Resumen',
  HOJA_CONFIG: '⚙️ Configuración',
  HOJA_FALLAS: '⚠️ Turnos Sin Revisar',

  HORA_INICIO: 8,
  HORA_FIN: 18,
  FRECUENCIA_MIN: 30,
  DIAS_CONSERVAR: 7,
  SOLO_LUNES_A_VIERNES: true,
  TIMEZONE: 'America/Argentina/Buenos_Aires'
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

let _ssRegistro = null;
let _ssLogs = null;

function esFecha(v) {
  return v && (v instanceof Date || Object.prototype.toString.call(v) === '[object Date]' || typeof v.getTime === 'function');
}

function extraerHoraLimpia(v, tz) {
  if (!v) return '';
  if (esFecha(v)) {
    try { return Utilities.formatDate(v, tz, 'HH:mm:ss'); } catch (e) {}
  }
  const s = String(v).trim();
  const match = s.match(/(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : s;
}

function extraerFechaLimpia(v, tz) {
  if (!v) return '';
  if (esFecha(v)) {
    try { return Utilities.formatDate(v, tz, 'yyyy-MM-dd'); } catch (e) {}
  }
  const s = String(v).trim();
  const match = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const fecha = new Date(s);
  return isNaN(fecha.getTime()) ? s : Utilities.formatDate(fecha, tz, 'yyyy-MM-dd');
}

function obtenerSpreadsheetRegistro() {
  if (!_ssRegistro) {
    _ssRegistro = SpreadsheetApp.openById(CONFIG_BASE.ID_SPREADSHEET_REGISTRO);
  }
  return _ssRegistro;
}

function obtenerSpreadsheetLogs() {
  if (_ssLogs) return _ssLogs;

  if (CONFIG_BASE.ID_SPREADSHEET_LOGS) {
    try {
      const ssLog = SpreadsheetApp.openById(CONFIG_BASE.ID_SPREADSHEET_LOGS);
      if (ssLog.getSheetByName(CONFIG_BASE.HOJA_FALLAS) || ssLog.getSheetByName('Turnos Sin Revisar')) {
        _ssLogs = ssLog;
        return _ssLogs;
      }
    } catch (e) {
      Logger.log('Error abriendo ID_SPREADSHEET_LOGS: ' + e.message);
    }
  }

  _ssLogs = obtenerSpreadsheetRegistro();
  return _ssLogs;
}

function obtenerHojaRegistro() {
  const ss = obtenerSpreadsheetRegistro();
  if (!ss) throw new Error('No se pudo acceder a la planilla de registro.');
  return ss.getSheetByName(CONFIG_BASE.HOJA_REGISTRO) ||
         ss.getSheetByName('Registro Detallado') ||
         ss.getSheetByName('Historial') ||
         (() => { throw new Error('No existe la hoja Registro Detallado en la planilla configurada.'); })();
}

function obtenerHojaMatriz() {
  const ss = obtenerSpreadsheetRegistro();
  if (!ss) return null;
  return ss.getSheetByName(CONFIG_BASE.HOJA_MATRIZ) || ss.getSheetByName('Matriz Semanal (Día y Hora)');
}

function obtenerConfiguracionDinamica() {
  const config = {
    horaInicio: CONFIG_BASE.HORA_INICIO,
    horaFin: CONFIG_BASE.HORA_FIN,
    frecuenciaMin: CONFIG_BASE.FRECUENCIA_MIN,
    diasConservar: CONFIG_BASE.DIAS_CONSERVAR,
    soloLunesAViernes: CONFIG_BASE.SOLO_LUNES_A_VIERNES,
    timezone: CONFIG_BASE.TIMEZONE
  };

  try {
    const ss = obtenerSpreadsheetRegistro();
    if (!ss) return config;
    const wsCfg = ss.getSheetByName(CONFIG_BASE.HOJA_CONFIG) || ss.getSheetByName('Configuración');
    if (!wsCfg) return config;

    const filas = wsCfg.getRange(4, 1, Math.max(1, wsCfg.getLastRow() - 3), 2).getValues();
    for (let i = 0; i < filas.length; i++) {
      const p = String(filas[i][0]).toLowerCase().trim();
      const valor = filas[i][1];
      const v = esFecha(valor) ? Utilities.formatDate(valor, config.timezone, 'HH:mm') : String(valor).trim();

      if (p.indexOf('hora inicio') !== -1) {
        const h = parseInt(v.split(':')[0], 10);
        if (!isNaN(h) && h >= 0 && h < 24) config.horaInicio = h;
      } else if (p.indexOf('hora fin') !== -1) {
        const h = parseInt(v.split(':')[0], 10);
        if (!isNaN(h) && h > 0 && h <= 24) config.horaFin = h;
      } else if (p.indexOf('frecuencia') !== -1) {
        const m = parseInt(v, 10);
        if (!isNaN(m) && m > 0) config.frecuenciaMin = m;
      } else if (p.indexOf('conservar') !== -1 || p.indexOf('días de historial') !== -1) {
        const d = parseInt(v, 10);
        if (!isNaN(d) && d > 0) config.diasConservar = d;
      } else if (p.indexOf('zona horaria') !== -1 && v.length > 3) {
        config.timezone = v;
      }
    }
  } catch (e) {
    Logger.log('Error leyendo config dinámica: ' + e.message);
  }
  return config;
}

function purgarRegistrosAntiguos(sheet) {
  try {
    const cfg = obtenerConfiguracionDinamica();
    const diasLimite = cfg.diasConservar;
    const ultFila = sheet.getLastRow();
    if (ultFila < 6) return;

    const fechaCorte = new Date();
    fechaCorte.setDate(fechaCorte.getDate() - diasLimite);
    fechaCorte.setHours(0, 0, 0, 0);

    const filas = sheet.getRange(5, 2, ultFila - 4, 1).getValues();
    let filasAEliminar = 0;

    for (let i = 0; i < filas.length; i++) {
      let fVal = filas[i][0];
      let fRow = null;

      if (esFecha(fVal)) {
        fRow = fVal;
      } else if (typeof fVal === 'string' && fVal.trim().length >= 10) {
        fRow = new Date(fVal.trim().substring(0, 10));
      }

      if (fRow && !isNaN(fRow.getTime()) && fRow < fechaCorte) {
        filasAEliminar++;
      } else {
        break;
      }
    }

    if (filasAEliminar > 0) {
      sheet.deleteRows(5, filasAEliminar);
      Logger.log('Se purgaron ' + filasAEliminar + ' filas antiguas.');
    }
  } catch (e) {
    Logger.log('Error purgando registros: ' + e.message);
  }
}

function calcularIntervaloActual(fecha) {
  const cfg = obtenerConfiguracionDinamica();
  const f = fecha || new Date();
  const fechaStr = Utilities.formatDate(f, cfg.timezone, 'yyyy-MM-dd');
  const diaNum = Number(Utilities.formatDate(f, cfg.timezone, 'u'));
  const total = Number(Utilities.formatDate(f, cfg.timezone, 'HH')) * 60 + Number(Utilities.formatDate(f, cfg.timezone, 'mm'));
  const inicio = cfg.horaInicio * 60;
  const slot = inicio + Math.floor((total - inicio) / cfg.frecuenciaMin) * cfg.frecuenciaMin;
  const hora = m => ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2);
  return { slotId: fechaStr + ' ' + hora(slot), franjaTexto: hora(slot) + ' - ' + hora(Math.min(slot + cfg.frecuenciaMin, cfg.horaFin * 60)),
    horaPad: hora(slot), enHorario: (!cfg.soloLunesAViernes || diaNum <= 5) && total >= inicio && total < cfg.horaFin * 60,
    diaNombre: DIAS_SEMANA[diaNum % 7], diaNum, fechaStr, minutosDemora: total - slot, cfg };
}

function buscarEstadoSlot(slotId) {
  const sheet = obtenerHojaRegistro();
  const ultimaFila = sheet.getLastRow();

  if (ultimaFila < 5) return { completado: false };

  const cfg = obtenerConfiguracionDinamica();
  const filas = sheet.getRange(5, 1, ultimaFila - 4, 10).getValues();

  for (let i = filas.length - 1; i >= 0; i--) {
    const rowFecha = extraerFechaLimpia(filas[i][1], cfg.timezone);
    const rowTurno = String(filas[i][3]).trim();
    const rowInicio = extraerHoraLimpia(filas[i][4], cfg.timezone);
    const rowFin = extraerHoraLimpia(filas[i][5], cfg.timezone);
    const rowResponsable = String(filas[i][6]).trim();
    const rowEmail = String(filas[i][7]).trim();

    const inicioTurno = rowTurno.match(/^(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2})/);
    if (inicioTurno && rowFecha + ' ' + inicioTurno[1] === slotId) {
      return {
        completado: true,
        fecha: rowFecha,
        horaInicio: rowInicio,
        horaFin: rowFin,
        revisadoPor: rowResponsable,
        correo: rowEmail
      };
    }
  }

  return { completado: false };
}

function actualizarMatrizSemanal(franjaTexto, diaNum, nombre, hora) {
  try {
    const wsMatriz = obtenerHojaMatriz();
    if (!wsMatriz) return;

    const colIdx = diaNum + 1;
    if (colIdx < 2 || colIdx > 6) return;

    const ultimaFila = wsMatriz.getLastRow();
    if (ultimaFila < 5) return;

    const filas = wsMatriz.getRange(5, 1, ultimaFila - 4, 1).getValues();
    for (let i = 0; i < filas.length; i++) {
      if (String(filas[i][0]).trim() === franjaTexto.trim()) {
        const filaIdx = i + 5;
        const cell = wsMatriz.getRange(filaIdx, colIdx);
        cell.setValue(nombre + ' (' + hora.substring(0, 5) + ')');
        cell.setBackground('#E8F5E9');
        break;
      }
    }
  } catch (e) {
    Logger.log('Error actualizando matriz: ' + e.message);
  }
}

// La planilla es la fuente de verdad: se escribe al iniciar y se actualiza al terminar.
function respuestaJSON(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

function leerRevisiones(cfg) {
  const sheet = obtenerHojaRegistro();
  const count = sheet.getLastRow() - 4;
  if (count <= 0) return [];
  return sheet.getRange(5, 1, count, 12).getValues().map((r, i) => ({
    fila: i + 5, id: r[0], fecha: extraerFechaLimpia(r[1], cfg.timezone), dia: String(r[2]), turno: String(r[3]),
    horaInicio: extraerHoraLimpia(r[4], cfg.timezone), horaFin: extraerHoraLimpia(r[5], cfg.timezone),
    nombre: String(r[6]), correo: String(r[7]), demora: r[8], estado: String(r[9]),
    revisionId: String(r[10] || ''), inicioISO: esFecha(r[11]) ? r[11].toISOString() : String(r[11] || '')
  })).filter(r => r.id);
}

function inicioMilisegundos(r) {
  return Date.parse(r.inicioISO || r.fecha + 'T' + r.horaInicio + '-03:00');
}

function obtenerEstado(ahora) {
  const info = calcularIntervaloActual(ahora);
  const registros = leerRevisiones(info.cfg);
  const finalizadas = registros.filter(r => r.horaFin);
  const ultima = finalizadas.slice().sort((a,b) => inicioMilisegundos(b) - inicioMilisegundos(a))[0];
  const siguiente = ultima ? inicioMilisegundos(ultima) + info.cfg.frecuenciaMin * 60000 : NaN;
  const cubierta = Number.isFinite(siguiente) && ahora.getTime() < siguiente;
  return { ok:true, version:'2026-11-16.3', modo:'UN_CLIC', enHorario:info.enHorario,
    turnoActual: cubierta ? ultima.revisionId || String(ultima.id) : 'PENDIENTE_' + info.fechaStr + '_' + (ultima ? ultima.id : 'inicial'),
    horaTurno: cubierta ? ultima.turno : info.franjaTexto, diaSemana:info.diaNombre,
    fase: cubierta ? 'COMPLETADO' : 'PENDIENTE', revisado:cubierta,
    revisadoPor:ultima ? ultima.nombre : null, correo:ultima ? ultima.correo : null,
    horaRevision:ultima ? ultima.horaFin : null, ultimaRevisionId:ultima ? ultima.revisionId || String(ultima.id) : null,
    proximaRevision:Number.isFinite(siguiente) ? Utilities.formatDate(new Date(siguiente),info.cfg.timezone,'yyyy-MM-dd HH:mm:ss') : null,
    proximaRevisionMs:Number.isFinite(siguiente) ? siguiente : null,
    puedeRegistrar:info.enHorario, configuracion:info.cfg,
    sheetsUrl:obtenerSpreadsheetRegistro().getUrl(), spreadsheetId:obtenerSpreadsheetRegistro().getId(),
    ultimosLogs:registros.slice(-15).reverse(), servidorHora:Utilities.formatDate(ahora,info.cfg.timezone,'yyyy-MM-dd HH:mm:ss') };
}

function doGet(e) {
  try { return respuestaJSON(obtenerEstado(new Date())); }
  catch (error) { return respuestaJSON({ok:false,error:error.message}); }
}

function escribirRevision(sheet, fila, valores) {
  sheet.getRange(4,11,1,2).setValues([['ID Revision','Inicio ISO']]);
  sheet.getRange(fila,2).setNumberFormat('@');
  sheet.getRange(fila,5,1,2).setNumberFormat('@');
  sheet.getRange(fila,11,1,2).setNumberFormat('@');
  sheet.getRange(fila,1,1,12).setValues([valores]);
  SpreadsheetApp.flush();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let bloqueado = false;
  try {
    lock.waitLock(10000); bloqueado = true;
    const datos = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : (e && e.parameter || {});
    if (datos.action !== 'registrar_revision') throw new Error('Actualiza la extension o la app para usar el registro con un solo clic.');
    const nombre = String(datos.nombre || '').trim();
    const correo = String(datos.correo || '').trim();
    const requestId = String(datos.requestId || '').trim();
    if (!nombre) throw new Error('Configura tu nombre antes de registrar la revision');
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error('Falta el identificador de la revision. Actualiza la aplicacion.');
    const ahora = new Date();
    const info = calcularIntervaloActual(ahora);
    const registros = leerRevisiones(info.cfg);
    // Un reintento de red del mismo clic no debe agregar otra fila ni mover el aviso.
    if (registros.some(r => r.revisionId === requestId)) return respuestaJSON({...obtenerEstado(ahora),yaRegistrado:true});
    if (!info.enHorario) throw new Error('Fuera del horario configurado');
    const hora = Utilities.formatDate(ahora,info.cfg.timezone,'HH:mm:ss');
    const id = registros.reduce((m,r)=>Math.max(m,Number(r.id)||0),0)+1;
    const sheet = obtenerHojaRegistro();
    escribirRevision(sheet,Math.max(5,sheet.getLastRow()+1),[id,info.fechaStr,info.diaNombre,hora.slice(0,5),hora,hora,nombre,correo,info.minutosDemora,'COMPLETADO',requestId,ahora.toISOString()]);
    return respuestaJSON(obtenerEstado(ahora));
  } catch(error) { return respuestaJSON({ok:false,error:error.message}); }
  finally { if (bloqueado) lock.releaseLock(); }
}
