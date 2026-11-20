// Registro unico desde WhatsApp Web.
(() => {
  let barra, guardando = false;
  let posicion = null;
  let arrastre = null;
  let estadoActual = null;
  let servicioActivo = false;
  let consultaPendiente = false;
  let textoEstado = null;
  let inicioPendiente = null;

  function colocarBarra(x, y) {
    const margen = 8;
    const anchoDisponible = Math.max(margen, window.innerWidth - barra.offsetWidth - margen);
    const altoDisponible = Math.max(margen, window.innerHeight - barra.offsetHeight - margen);
    posicion = {
      x: Math.min(Math.max(margen, x), anchoDisponible),
      y: Math.min(Math.max(margen, y), altoDisponible)
    };
    barra.style.left = `${posicion.x}px`;
    barra.style.top = `${posicion.y}px`;
    barra.style.right = 'auto';
  }

  function habilitarArrastre() {
    barra.title = 'Arrastra la barra para moverla';
    barra.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = barra.getBoundingClientRect();
      arrastre = {id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top};
      barra.setPointerCapture(event.pointerId);
      barra.dataset.arrastrando = 'true';
      event.preventDefault();
    });
    barra.addEventListener('pointermove', event => {
      if (!arrastre || arrastre.id !== event.pointerId) return;
      colocarBarra(event.clientX - arrastre.x, event.clientY - arrastre.y);
    });
    function terminarArrastre(event) {
      if (!arrastre || arrastre.id !== event.pointerId) return;
      arrastre = null;
      delete barra.dataset.arrastrando;
      if (barra.hasPointerCapture(event.pointerId)) barra.releasePointerCapture(event.pointerId);
      if (posicion) chrome.storage.local.set({posicionBarra: posicion});
    }
    barra.addEventListener('pointerup', terminarArrastre);
    barra.addEventListener('pointercancel', terminarArrastre);
    barra.addEventListener('lostpointercapture', terminarArrastre);
    window.addEventListener('resize', () => {
      if (posicion && barra.style.display !== 'none') colocarBarra(posicion.x, posicion.y);
    });
    chrome.storage.local.get(['posicionBarra'], resultado => {
      const guardada = resultado.posicionBarra;
      if (!arrastre && !posicion && guardada && Number.isFinite(guardada.x) && Number.isFinite(guardada.y)) {
        colocarBarra(guardada.x, guardada.y);
      }
    });
  }
  function actualizarMensaje() {
    if (!textoEstado || !estadoActual || !servicioActivo) return;
    const estado = estadoActual;
    const ahora = Date.now();
    const nombre = (estado.revisadoPor || '').trim().split(/\s+/)[0];
    const vencimiento = Number(estado.proximaRevisionMs);
    const tieneVencimiento = Number.isFinite(vencimiento) && vencimiento > 0;
    const restante = vencimiento - ahora;
    const vencido = estado.fase === 'PENDIENTE' || (tieneVencimiento && restante <= 0);
    barra.className = vencido ? 'alerta' : 'resuelto';

    if (vencido) {
      if (inicioPendiente === null) inicioPendiente = tieneVencimiento ? vencimiento : ahora;
      const minutosVencido = Math.max(0, Math.floor((ahora - inicioPendiente) / 60000));
      textoEstado.textContent = minutosVencido % 2 === 0 ? 'Se excedio el tiempo' : 'Revisar urgente';
      return;
    }

    inicioPendiente = null;
    const frecuencia = Number(estado.configuracion && estado.configuracion.frecuenciaMin) || 60;
    const transcurrido = tieneVencimiento ? ahora - (vencimiento - frecuencia * 60000) : 0;
    if (transcurrido < 60000 || !tieneVencimiento) {
      textoEstado.textContent = nombre ? `Revisado por ${nombre}` : 'WhatsApp revisado';
    } else if (transcurrido >= 5 * 60000 && transcurrido < 6 * 60000 && nombre) {
      textoEstado.textContent = `Ultima revision ${nombre}`;
    } else {
      textoEstado.textContent = `Proxima alarma en ${Math.ceil(restante / 60000)} m`;
    }
  }

  function actualizar(estado, activo) {
    estadoActual = estado;
    servicioActivo = activo;
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'wsp-notificador-bar';
      document.body.appendChild(barra);
      habilitarArrastre();
    }
    if (!barra.isConnected) document.body.appendChild(barra);
    barra.replaceChildren();
    textoEstado = null;
    if (!activo) { barra.style.display = 'none'; return; }
    barra.style.display = 'flex';
    if (!estado || !estado.ok) {
      barra.className = 'fuera-horario';
      barra.textContent = estado && estado.error ? 'No se pudo sincronizar. Reintentando...' : 'Conectando con el notificador de WhatsApp...';
      if (posicion) colocarBarra(posicion.x, posicion.y);
      return;
    }
    if (!estado.enHorario) {
      barra.className = 'fuera-horario';
      barra.textContent = 'Fuera del horario de revision de WhatsApp';
      if (posicion) colocarBarra(posicion.x, posicion.y);
      return;
    }
    barra.className=estado.fase === 'PENDIENTE' ? 'alerta' : 'resuelto';
    const texto=document.createElement('span');
    texto.className='wsp-texto';
    textoEstado = texto;
    actualizarMensaje();
    const btn=document.createElement('button');
    btn.className='wsp-btn-revisar';
    btn.textContent=guardando ? 'Guardando...' : 'Ya revise WhatsApp';
    btn.disabled=guardando;
    btn.onclick=() => {
      if(guardando) return;
      guardando=true; btn.disabled=true; btn.textContent='Guardando...';
      chrome.runtime.sendMessage({tipo:'REGISTRAR_REVISION'},res => {
        guardando=false;
        if (!res || !res.ok) { btn.disabled=false; btn.textContent='Reintentar registro'; alert((res && res.error) || 'No se pudo guardar.'); }
        else actualizar(res.data,true);
      });
    };
    barra.append(texto,btn);
    if (posicion) colocarBarra(posicion.x, posicion.y);
  }
  function consultarEstado() {
    if (consultaPendiente || !chrome.runtime.id) return;
    consultaPendiente = true;
    try {
      chrome.runtime.sendMessage({tipo: 'GET_ESTADO'}, respuesta => {
        consultaPendiente = false;
        if (chrome.runtime.lastError || !respuesta) {
          actualizar({ok: false, error: 'Sin respuesta'}, servicioActivo);
          return;
        }
        actualizar(respuesta.estado, respuesta.config.servicioActivo);
      });
    } catch (error) {
      consultaPendiente = false;
      if (barra) {
        barra.style.display = 'flex';
        barra.textContent = 'Notificador actualizado. Recarga WhatsApp Web para activarlo.';
      }
    }
  }

  chrome.runtime.onMessage.addListener(mensaje => {
    if (mensaje.tipo === 'ESTADO_ACTUALIZADO') {
      chrome.storage.local.get(['servicioActivo'], resultado => actualizar(mensaje.estado, resultado.servicioActivo));
    }
  });
  chrome.storage.onChanged.addListener((cambios, area) => {
    if (area !== 'local' || !cambios.servicioActivo) return;
    actualizar(estadoActual, cambios.servicioActivo.newValue);
    if (cambios.servicioActivo.newValue) consultarEstado();
  });

  // WhatsApp puede reemplazar sus nodos al volver a conectar o cambiar de vista.
  const observador = new MutationObserver(() => {
    if (barra && !barra.isConnected && document.body) {
      document.body.appendChild(barra);
      if (posicion && servicioActivo) colocarBarra(posicion.x, posicion.y);
    }
  });
  observador.observe(document.body, {childList: true});
  chrome.storage.local.get(['servicioActivo'], resultado => {
    actualizar(null, resultado.servicioActivo);
    consultarEstado();
  });
  const intervalo = setInterval(consultarEstado, 30000);
  const relojMensajes = setInterval(actualizarMensaje, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') consultarEstado();
  });
  window.addEventListener('pagehide', () => {
    clearInterval(intervalo);
    clearInterval(relojMensajes);
    observador.disconnect();
  }, {once: true});
})();
