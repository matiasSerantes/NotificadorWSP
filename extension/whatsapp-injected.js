// Registro unico desde WhatsApp Web.
(() => {
  let barra, guardando = false;
  function actualizar(estado, activo) {
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'wsp-notificador-bar';
      document.body.appendChild(barra);
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
  }
  chrome.runtime.onMessage.addListener(m => {
    if(m.tipo === 'ESTADO_ACTUALIZADO') chrome.storage.local.get(['servicioActivo'],r=>actualizar(m.estado,r.servicioActivo));
  });
  chrome.runtime.sendMessage({tipo:'GET_ESTADO'},r=>{if(r) actualizar(r.estado,r.config.servicioActivo);});
})();
