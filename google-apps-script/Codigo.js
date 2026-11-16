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
  return match ? match[1] : s;
}

function obtenerSpreadsheetRegistro() {
  if (_ssRegistro) return _ssRegistro;

  if (CONFIG_BASE.ID_SPREADSHEET_REGISTRO) {
    try {
      const ss1 = SpreadsheetApp.openById(CONFIG_BASE.ID_SPREADSHEET_REGISTRO);
      if (ss1.getSheetByName(CONFIG_BASE.HOJA_REGISTRO) || ss1.getSheetByName('Registro Detallado')) {
        _ssRegistro = ss1;
        return _ssRegistro;
      }
    } catch (e) {
      Logger.log('Error abriendo ID_SPREADSHEET_REGISTRO: ' + e.message);
    }
  }

  if (CONFIG_BASE.ID_SPREADSHEET_LOGS) {
    try {
      const ss2 = SpreadsheetApp.openById(CONFIG_BASE.ID_SPREADSHEET_LOGS);
      if (ss2.getSheetByName(CONFIG_BASE.HOJA_REGISTRO) || ss2.getSheetByName('Registro Detallado')) {
        _ssRegistro = ss2;
        return _ssRegistro;
      }
    } catch (e) {}
  }

  try {
    _ssRegistro = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

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
         ss.getSheets()[0];
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
      const v = String(filas[i][1]).trim();

      if (p.indexOf('hora inicio') !== -1) {
        const h = parseInt(v.split(':')[0], 10);
        if (!isNaN(h)) config.horaInicio = h;
      } else if (p.indexOf('hora fin') !== -1) {
        const h = parseInt(v.split(':')[0], 10);
        if (!isNaN(h)) config.horaFin = h;
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
  const dStr = Utilities.formatDate(f, cfg.timezone, 'yyyy-MM-dd');
  const horas = parseInt(Utilities.formatDate(f, cfg.timezone, 'HH'), 10);
  const minutos = parseInt(Utilities.formatDate(f, cfg.timezone, 'mm'), 10);

  const freq = cfg.frecuenciaMin;
  const slotInicioMin = Math.floor(minutos / freq) * freq;
  const slotFinTotalMin = slotInicioMin + freq;
  const slotFinHora = Math.floor(slotFinTotalMin / 60) > 0 ? horas + Math.floor(slotFinTotalMin / 60) : horas;
  const slotFinMin = slotFinTotalMin % 60;

  const minStr = ('0' + slotInicioMin).slice(-2);
  const finMinStr = ('0' + slotFinMin).slice(-2);
  const horaStr = ('0' + horas).slice(-2);
  const finHoraStr = ('0' + slotFinHora).slice(-2);

  const franjaTexto = `${horaStr}:${minStr} - ${finHoraStr}:${finMinStr}`;
  const slotId = `${dStr} ${horaStr}:${minStr}`;

  const diaNum = parseInt(Utilities.formatDate(f, cfg.timezone, 'u'), 10);
  const diaNombre = DIAS_SEMANA[f.getDay()];
  const esDiaLaboral = !cfg.soloLunesAViernes || (diaNum >= 1 && diaNum <= 5);
  const enHorario = esDiaLaboral && (horas >= cfg.horaInicio && horas < cfg.horaFin);

  const minutosTranscurridos = minutos - slotInicioMin;

  return {
    slotId: slotId,
    franjaTexto: franjaTexto,
    horaPad: `${horaStr}:${minStr}`,
    enHorario: enHorario,
    diaNombre: diaNombre,
    diaNum: diaNum,
    fechaStr: dStr,
    minutosDemora: minutosTranscurridos,
    cfg: cfg
  };
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

    if ((rowFecha + ' ' + rowTurno).indexOf(slotId) !== -1 || (rowTurno.indexOf(slotId.split(' ')[1]) !== -1 && rowFecha === slotId.split(' ')[0])) {
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

/**
 * Endpoint GET: Estado en tiempo real y configuración activa
 */
function doGet(e) {
  try {
    const ahora = new Date();
    const info = calcularIntervaloActual(ahora);
    const estadoSheet = buscarEstadoSlot(info.slotId);

    let fase = 'PENDIENTE';
    let atendidoPor = null;
    let correoAtendiendo = null;
    let horaInicioAtencion = null;
    let revisadoPor = null;
    let correo = null;
    let horaRevision = null;

    if (estadoSheet.completado) {
      fase = 'COMPLETADO';
      revisadoPor = estadoSheet.revisadoPor;
      correo = estadoSheet.correo;
      horaRevision = estadoSheet.horaFin || estadoSheet.horaInicio;
    } else {
      const props = PropertiesService.getScriptProperties();
      const rawEnProceso = props.getProperty('EN_PROCESO_' + info.slotId);
      if (rawEnProceso) {
        try {
          const parsed = JSON.parse(rawEnProceso);
          fase = 'EN_PROCESO';
          atendidoPor = parsed.nombre;
          correoAtendiendo = parsed.correo;
          horaInicioAtencion = parsed.horaInicio;
        } catch (err) {}
      }
    }

    const sheet = obtenerHojaRegistro();
    const ultFila = sheet.getLastRow();
    const ultimosLogs = [];

    if (ultFila >= 5) {
      const cantidad = Math.min(15, ultFila - 4);
      const inicio = ultFila - cantidad + 1;
      const datos = sheet.getRange(inicio, 1, cantidad, 10).getValues();

      for (let i = datos.length - 1; i >= 0; i--) {
        const fStr = extraerFechaLimpia(datos[i][1], info.cfg.timezone);
        const hInicio = extraerHoraLimpia(datos[i][4], info.cfg.timezone);
        const hFin = extraerHoraLimpia(datos[i][5], info.cfg.timezone);
        ultimosLogs.push({
          id: datos[i][0],
          fecha: fStr,
          dia: String(datos[i][2]),
          turno: String(datos[i][3]),
          horaInicio: hInicio,
          horaFin: hFin,
          nombre: String(datos[i][6]),
          correo: String(datos[i][7]),
          demora: String(datos[i][8]),
          estado: String(datos[i][9])
        });
      }
    }

    const respuesta = {
      ok: true,
      enHorario: info.enHorario,
      turnoActual: info.slotId,
      horaTurno: info.franjaTexto,
      diaSemana: info.diaNombre,
      fase: fase,
      atendidoPor: atendidoPor,
      correoAtendiendo: correoAtendiendo,
      horaInicioAtencion: horaInicioAtencion,
      revisado: fase === 'COMPLETADO',
      revisadoPor: revisadoPor,
      correo: correo,
      horaRevision: horaRevision,
      configuracion: {
        horaInicio: info.cfg.horaInicio,
        horaFin: info.cfg.horaFin,
        frecuenciaMin: info.cfg.frecuenciaMin,
        diasConservar: info.cfg.diasConservar
      },
      ultimosLogs: ultimosLogs,
      servidorHora: Utilities.formatDate(ahora, info.cfg.timezone, 'yyyy-MM-dd HH:mm:ss')
    };

    return ContentService.createTextOutput(JSON.stringify(respuesta))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Endpoint POST: Registro de acciones
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    let datos = {};
    if (e && e.postData && e.postData.contents) {
      try {
        datos = JSON.parse(e.postData.contents);
      } catch (err) {
        datos = e.parameter || {};
      }
    } else if (e && e.parameter) {
      datos = e.parameter;
    }

    const accion = datos.action || 'checkin';
    const ahora = new Date();
    const info = calcularIntervaloActual(ahora);
    const props = PropertiesService.getScriptProperties();
    const keyEnProceso = 'EN_PROCESO_' + info.slotId;

    const estadoPrevio = buscarEstadoSlot(info.slotId);
    if (estadoPrevio.completado) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        yaCompletado: true,
        revisadoPor: estadoPrevio.revisadoPor,
        horaRevision: estadoPrevio.horaFin,
        mensaje: 'Este turno ya fue completado por ' + estadoPrevio.revisadoPor
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // PASO 1: Tomar revisión
    if (accion === 'tomar_revision') {
      const nombre = (datos.nombre || datos.name || 'Anónimo').trim();
      const correo = (datos.correo || datos.email || 'Sin correo').trim();

      const rawActual = props.getProperty(keyEnProceso);
      if (rawActual) {
        try {
          const act = JSON.parse(rawActual);
          return ContentService.createTextOutput(JSON.stringify({
            ok: true,
            yaTomadoPorOtro: true,
            atendidoPor: act.nombre,
            correoAtendiendo: act.correo,
            horaInicioAtencion: act.horaInicio,
            mensaje: act.nombre + ' ya está revisando este turno'
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {}
      }

      const horaInicioStr = Utilities.formatDate(ahora, info.cfg.timezone, 'HH:mm:ss');
      props.setProperty(keyEnProceso, JSON.stringify({
        nombre: nombre,
        correo: correo,
        horaInicio: horaInicioStr
      }));

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        fase: 'EN_PROCESO',
        atendidoPor: nombre,
        correoAtendiendo: correo,
        horaInicioAtencion: horaInicioStr,
        mensaje: nombre + ' comenzó a revisar WhatsApp'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // PASO 2: Finalizar revisión
    if (accion === 'finalizar_revision' || accion === 'checkin') {
      const rawActual = props.getProperty(keyEnProceso);
      let nombre = (datos.nombre || datos.name || 'Anónimo').trim();
      let correo = (datos.correo || datos.email || 'Sin correo').trim();
      let horaInicioStr = Utilities.formatDate(ahora, info.cfg.timezone, 'HH:mm:ss');

      if (rawActual) {
        try {
          const act = JSON.parse(rawActual);
          if (act.nombre) nombre = act.nombre;
          if (act.correo) correo = act.correo;
          if (act.horaInicio) horaInicioStr = act.horaInicio;
        } catch (err) {}
      }

      const horaFinStr = Utilities.formatDate(ahora, info.cfg.timezone, 'HH:mm:ss');
      const sheet = obtenerHojaRegistro();
      const ultFila = sheet.getLastRow();
      const nuevoId = ultFila >= 5 ? (ultFila - 4 + 1) : 1;
      const estadoTexto = info.minutosDemora <= 5 ? '✅ A tiempo' : '⚠️ Con demora';

      sheet.appendRow([
        nuevoId,
        info.fechaStr,
        info.diaNombre,
        info.franjaTexto,
        horaInicioStr,
        horaFinStr,
        nombre,
        correo,
        info.minutosDemora,
        estadoTexto
      ]);

      actualizarMatrizSemanal(info.franjaTexto, info.diaNum, nombre, horaFinStr);
      props.deleteProperty(keyEnProceso);
      purgarRegistrosAntiguos(sheet);

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        fase: 'COMPLETADO',
        revisadoPor: nombre,
        correo: correo,
        horaInicio: horaInicioStr,
        horaRevision: horaFinStr,
        turno: info.franjaTexto,
        mensaje: '¡Revisión completada y guardada en Excel!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Acción desconocida' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
