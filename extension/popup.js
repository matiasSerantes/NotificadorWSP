// popup.js - Lógica de interfaz de la extensión pre-configurada

document.addEventListener('DOMContentLoaded', async () => {
  const btnServicio = document.getElementById('btn-servicio');
  const inputNombre = document.getElementById('input-nombre');
  const inputCorreo = document.getElementById('input-correo');
  const btnGuardarUsuario = document.getElementById('btn-guardar-usuario');
  const msgUsuarioGuardado = document.getElementById('msg-usuario-guardado');

  const panelEstado = document.getElementById('panel-estado');
  const statusIcon = document.getElementById('status-icon');
  const statusTitle = document.getElementById('status-title');
  const statusDesc = document.getElementById('status-desc');
  const btnRevisar = document.getElementById('btn-revisar');
  const badgeEstado = document.getElementById('badge-estado');
  const horaServidor = document.getElementById('hora-servidor');
  const horarioLabel = document.getElementById('horario-label');

  const logLista = document.getElementById('log-lista');
  const btnRefrescar = document.getElementById('btn-refrescar');
  const btnAbrirSheets = document.getElementById('btn-abrir-sheets');

  const btnSyncOnline = document.getElementById('btn-sync-online');
  const inputUrl = document.getElementById('input-url');
  const inputSheetsUrl = document.getElementById('input-sheets-url');
  const btnGuardarUrl = document.getElementById('btn-guardar-url');
  const btnProbarNotif = document.getElementById('btn-probar-notif');
  const msgUrlGuardada = document.getElementById('msg-url-guardada');

  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziC1cvnny7cw_vgvinHD1-6G0VIRmjgGyDTCjp-MevQGcC6wBQkanDyUOJ14NvpmAujw/exec';
  const DEFAULT_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA/edit';

  let servicioActivo = false;
  let faseActual = 'PENDIENTE';

  // Cargar configuración inicial (pre-configurada por defecto)
  chrome.storage.local.get(['userName', 'userEmail', 'scriptUrl', 'sheetsUrl', 'servicioActivo', 'horarioTexto'], (res) => {
    const sUrl = res.scriptUrl || DEFAULT_SCRIPT_URL;
    const shUrl = res.sheetsUrl || DEFAULT_SHEETS_URL;

    inputUrl.value = sUrl;
    inputSheetsUrl.value = shUrl;

    if (!res.scriptUrl || !res.sheetsUrl) {
      chrome.storage.local.set({ scriptUrl: sUrl, sheetsUrl: shUrl });
    }

    if (res.userName) inputNombre.value = res.userName;
    if (res.horarioTexto && horarioLabel) horarioLabel.innerText = res.horarioTexto;

    if (res.userEmail) {
      inputCorreo.value = res.userEmail;
    } else if (chrome.identity && chrome.identity.getProfileUserInfo) {
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
        if (info && info.email) {
          inputCorreo.value = info.email;
          chrome.storage.local.set({ userEmail: info.email });
        }
      });
    }

    servicioActivo = res.servicioActivo === true;
    actualizarBotonServicio(servicioActivo);
    actualizarTodo();
  });

  // Botón: Sincronizar desde Excel en línea
  if (btnSyncOnline) {
    btnSyncOnline.addEventListener('click', () => {
      sincronizarDesdeExcelOnline(false);
    });
  }

  function extraerSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : '1aFwQR-S6jEgBvFk9rNBySj8CGbpckWzZotzDqRUs6AA';
  }

  async function sincronizarDesdeExcelOnline(silencioso) {
    const sUrl = (inputSheetsUrl.value || DEFAULT_SHEETS_URL).trim();
    const sheetId = extraerSheetId(sUrl);

    if (btnSyncOnline && !silencioso) {
      btnSyncOnline.disabled = true;
      btnSyncOnline.innerText = '⌛ Leyendo configuración de Google Sheets...';
    }

    try {
      let csvText = '';
      const hojas = ['⚙️%20Configuración', 'Configuración', 'Configuracion'];

      for (const h of hojas) {
        try {
          const resp = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${h}`);
          if (resp.ok) {
            csvText = await resp.text();
            if (csvText && csvText.length > 20) break;
          }
        } catch (e) {}
      }

      if (!csvText) {
        throw new Error('No se pudo acceder a la hoja de configuración del Excel.');
      }

      const lineas = csvText.split('\n');
      let scriptUrlEncontrada = '';
      let horaInicio = '';
      let horaFin = '';

      for (const linea of lineas) {
        const limpia = linea.replace(/"/g, '');
        const partes = limpia.split(',');

        if (partes.length >= 2) {
          const clave = partes[0].toLowerCase().trim();
          const valor = partes[1].trim();

          if (valor.startsWith('https://script.google.com/macros/s/')) {
            scriptUrlEncontrada = valor;
          } else if (clave.indexOf('hora inicio') !== -1) {
            horaInicio = valor;
          } else if (clave.indexOf('hora fin') !== -1) {
            horaFin = valor;
          }
        }
      }

      let guardado = {};
      let msg = [];

      if (scriptUrlEncontrada) {
        inputUrl.value = scriptUrlEncontrada;
        guardado.scriptUrl = scriptUrlEncontrada;
        msg.push('URL del Script actualizada');
      }

      if (horaInicio && horaFin) {
        const horTexto = `Horario: ${horaInicio} a ${horaFin} hs`;
        if (horarioLabel) horarioLabel.innerText = horTexto;
        guardado.horarioTexto = horTexto;
        msg.push(horTexto);
      }

      if (Object.keys(guardado).length > 0) {
        chrome.storage.local.set(guardado, () => {
          if (!silencioso) {
            alert('✅ ¡Sincronizado desde Excel en línea con éxito!\n' + msg.join('\n'));
          }
          actualizarTodo();
        });
      } else {
        if (!silencioso) {
          alert('ℹ️ Se leyó la hoja de Configuración del Excel.');
        }
      }

    } catch (err) {
      console.log('[NotificadorWSP] Error al sincronizar desde Excel:', err);
      if (!silencioso) {
        alert('Asegúrate de que la planilla esté en modo "Cualquiera con el enlace puede ver" en Google Drive.');
      }
    } finally {
      if (btnSyncOnline && !silencioso) {
        btnSyncOnline.disabled = false;
        btnSyncOnline.innerText = '🔄 Sincronizar Configuración desde Excel en línea';
      }
    }
  }

  // Botón: INICIAR / DETENER SERVICIO
  btnServicio.addEventListener('click', () => {
    servicioActivo = !servicioActivo;
    actualizarBotonServicio(servicioActivo);

    chrome.runtime.sendMessage({ tipo: 'TOGGLE_SERVICIO', activo: servicioActivo }, () => {
      actualizarTodo();
    });
  });

  function actualizarBotonServicio(activo) {
    if (activo) {
      btnServicio.className = 'btn-service btn-service-on';
      btnServicio.innerHTML = '<span class="service-icon">🟢</span><span>SERVICIO EN LÍNEA (ACTIVO)</span>';
    } else {
      btnServicio.className = 'btn-service btn-service-off';
      btnServicio.innerHTML = '<span class="service-icon">▶️</span><span>INICIAR SERVICIO</span>';
    }
  }

  // Guardar Nombre y Correo
  btnGuardarUsuario.addEventListener('click', () => {
    const nombre = inputNombre.value.trim();
    const correo = inputCorreo.value.trim();

    if (!nombre) {
      alert('Por favor ingresa tu Nombre y Apellido.');
      inputNombre.focus();
      return;
    }

    chrome.storage.local.set({ userName: nombre, userEmail: correo }, () => {
      msgUsuarioGuardado.style.display = 'inline';
      setTimeout(() => { msgUsuarioGuardado.style.display = 'none'; }, 2500);
    });
  });

  // Guardar URLs manualmente
  btnGuardarUrl.addEventListener('click', () => {
    const url = inputUrl.value.trim();
    const sUrl = inputSheetsUrl ? inputSheetsUrl.value.trim() : '';

    if (url && !url.startsWith('https://script.google.com/')) {
      alert('La URL del Script debe comenzar con https://script.google.com/');
      return;
    }

    chrome.storage.local.set({ scriptUrl: url, sheetsUrl: sUrl }, () => {
      msgUrlGuardada.style.display = 'block';
      setTimeout(() => { msgUrlGuardada.style.display = 'none'; }, 2500);
      actualizarTodo();
    });
  });

  btnProbarNotif.addEventListener('click', () => {
    chrome.runtime.sendMessage({ tipo: 'PROBAR_NOTIFICACION' });
  });

  btnRefrescar.addEventListener('click', () => {
    btnRefrescar.style.transform = 'rotate(180deg)';
    setTimeout(() => { btnRefrescar.style.transform = 'none'; }, 400);
    actualizarTodo();
  });

  // Registro con un solo clic
  let guardando = false;
  btnRevisar.addEventListener('click', () => {
    if (guardando) return;
    const nombre = inputNombre.value.trim();
    const correo = inputCorreo.value.trim();
    if (!nombre) { alert('Primero escribe tu nombre.'); inputNombre.focus(); return; }
    guardando = true;
    btnRevisar.disabled = true;
    btnRevisar.innerText = 'Guardando revision...';
    chrome.runtime.sendMessage({tipo:'REGISTRAR_REVISION',nombre,correo},res => {
      guardando = false;
      btnRevisar.disabled = false;
      if (!res || !res.ok) alert((res && res.error) || 'No se pudo guardar. Reintenta.');
      if (res && res.data) renderizarEstado(res.data);
      else actualizarTodo();
    });
  });

  // Abrir Drive / Sheets
  btnAbrirSheets.addEventListener('click', () => {
    chrome.storage.local.get(['sheetsUrl'], (res) => {
      const url = res.sheetsUrl || DEFAULT_SHEETS_URL;
      chrome.tabs.create({ url: url });
    });
  });

  // Renderizar estado
  function renderizarEstado(estado) {
    if (!estado) return;
    if (estado.sheetsUrl) inputSheetsUrl.value = estado.sheetsUrl;

    if (estado.servidorHora) {
      horaServidor.innerText = estado.servidorHora.split(' ')[1] || '--:--';
    }

    if (estado.configuracion && horarioLabel) {
      const hIni = ('0' + estado.configuracion.horaInicio).slice(-2);
      const hFin = ('0' + estado.configuracion.horaFin).slice(-2);
      horarioLabel.innerText = `Horario: ${hIni}:00 a ${hFin}:00 hs`;
    }

    faseActual = estado.fase || 'PENDIENTE';
    panelEstado.className = 'card status-card';

    // 1. Desconectado
    if (!servicioActivo) {
      panelEstado.classList.add('desconectado');
      statusIcon.innerText = '⚪';
      statusTitle.innerText = 'Servicio Pausado / Desconectado';
      statusDesc.innerText = 'Toca "INICIAR SERVICIO" arriba para ponerte en línea y recibir alertas.';
      badgeEstado.innerText = 'OFF';
      badgeEstado.className = 'badge-pill apagado';
      btnRevisar.style.display = 'none';
      renderizarLogs(estado.ultimosLogs);
      return;
    }

    // 2. Sin URL
    if (!inputUrl.value.trim()) {
      statusIcon.innerText = '⚙️';
      statusTitle.innerText = 'Falta Conectar Google Sheets';
      statusDesc.innerText = 'Toca "Sincronizar desde Excel en línea" abajo para traer la configuración automática.';
      badgeEstado.innerText = 'Sin Conectar';
      badgeEstado.className = 'badge-pill';
      btnRevisar.style.display = 'none';
      return;
    }

    // 3. Fuera de horario
    if (!estado.enHorario) {
      panelEstado.classList.add('fuera');
      statusIcon.innerText = '🌙';
      statusTitle.innerText = 'Fuera de Horario Laboral';
      statusDesc.innerText = 'El control funciona en los horarios configurados en el Excel.';
      badgeEstado.innerText = 'Inactivo';
      badgeEstado.className = 'badge-pill';
      btnRevisar.style.display = 'none';
      renderizarLogs(estado.ultimosLogs);
      return;
    }

    const pendiente = estado.fase === 'PENDIENTE';
    panelEstado.classList.add(pendiente ? 'pendiente' : 'resuelto');
    statusIcon.innerText = pendiente ? '??' : '?';
    statusTitle.innerText = pendiente ? 'Hora de revisar WhatsApp' : 'Revision registrada';
    const ultima = estado.revisadoPor ? `Revisado por ${estado.revisadoPor} a las ${estado.horaRevision}. ` : '';
    statusDesc.innerText = ultima + (pendiente ? 'Revisa los mensajes y registra con un clic.' : `Proximo aviso: ${estado.proximaRevision}. Podes registrar otra revision antes si ya revisaste.`);
    const restante = estado.proximaRevisionMs - Date.now();
    if (!pendiente && restante > 0 && restante <= 10 * 60000) {
      statusDesc.innerText = ultima + `En ${Math.ceil(restante / 60000)} minutos hay que revisar WhatsApp.`;
    }
    badgeEstado.innerText = pendiente ? 'Pendiente' : 'Al dia';
    badgeEstado.className = 'badge-pill ' + (pendiente ? 'alerta' : 'resuelto');
    btnRevisar.style.display = 'block';
    btnRevisar.disabled = guardando;
    btnRevisar.innerText = guardando ? 'Guardando revision...' : 'YA REVISE WHATSAPP';

    renderizarLogs(estado.ultimosLogs);
  }

  function renderizarLogs(logs) {
    if (!logs || logs.length === 0) {
      logLista.innerHTML = '<p class="text-mini text-muted">Aún no hay revisiones registradas en esta semana.</p>';
      return;
    }

    logLista.innerHTML = '';
    logs.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'log-item';
      const duracion = '';
      el.innerHTML = `
        <div class="log-item-left">
          <span class="log-turno">${item.turno}</span>
          <span class="log-persona">👤 ${item.nombre}</span>
        </div>
        <span class="log-hora">${item.horaFin || item.hora}${duracion}</span>
      `;
      logLista.appendChild(el);
    });
  }

  function actualizarTodo() {
    chrome.runtime.sendMessage({ tipo: 'GET_ESTADO' }, (res) => {
      if (res && res.estado) {
        renderizarEstado(res.estado);
      }
    });
  }

  const refresco = setInterval(actualizarTodo, 10000);
  window.addEventListener('unload', () => clearInterval(refresco));

  chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje.tipo === 'ESTADO_ACTUALIZADO') {
      renderizarEstado(mensaje.estado);
    }
  });
});
