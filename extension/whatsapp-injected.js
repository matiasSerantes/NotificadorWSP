// Registro unico desde WhatsApp Web.
(() => {
  let barra, guardando = false;
  let posicion = null;
  let arrastre = null;

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
  function actualizar(estado, activo) {
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'wsp-notificador-bar';
      document.body.appendChild(barra);
      habilitarArrastre();
    }
    barra.replaceChildren();
    if (!activo || !estado || !estado.enHorario) { barra.style.display='none'; return; }
    barra.style.display='flex';
    barra.className=estado.fase === 'PENDIENTE' ? 'alerta' : 'resuelto';
    const texto=document.createElement('span');
    texto.className='wsp-texto';
    texto.textContent=estado.fase === 'PENDIENTE' ? 'Hora de revisar WhatsApp.' : `Revisado por ${estado.revisadoPor} a las ${estado.horaRevision}. Proximo aviso: ${estado.proximaRevision}.`;
    const restante = estado.proximaRevisionMs - Date.now();
    if (estado.fase === 'COMPLETADO' && restante > 0 && restante <= 10 * 60000) {
      texto.textContent = `Revisado por ${estado.revisadoPor} a las ${estado.horaRevision}. En ${Math.ceil(restante / 60000)} minutos hay que revisar WhatsApp.`;
    }
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
  chrome.runtime.onMessage.addListener(m => {
    if(m.tipo === 'ESTADO_ACTUALIZADO') chrome.storage.local.get(['servicioActivo'],r=>actualizar(m.estado,r.servicioActivo));
  });
  chrome.runtime.sendMessage({tipo:'GET_ESTADO'},r=>{if(r) actualizar(r.estado,r.config.servicioActivo);});
})();
