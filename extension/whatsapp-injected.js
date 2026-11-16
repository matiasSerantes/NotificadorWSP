/**
 * Content Script inyectado exclusivamente en web.whatsapp.com
 * Muestra la barra flotante con el flujo en 2 pasos:
 *   1. "Responder notificación"
 *   2. "Terminé de revisar"
 */

(function () {
  let barraElement = null;
  let miNombreLocal = '';

  chrome.storage.local.get(['userName'], (res) => {
    if (res.userName) miNombreLocal = res.userName.trim().toLowerCase();
  });

  function crearBarra() {
    if (document.getElementById('wsp-notificador-bar')) {
      barraElement = document.getElementById('wsp-notificador-bar');
      return;
    }

    barraElement = document.createElement('div');
    barraElement.id = 'wsp-notificador-bar';
    barraElement.style.display = 'none';
    document.body.appendChild(barraElement);
  }

  function actualizarUI(estado, servicioActivo) {
    if (!barraElement) crearBarra();
    if (!estado) return;

    if (servicioActivo === false) {
      barraElement.style.display = 'none';
      return;
    }

    if (!estado.enHorario) {
      barraElement.className = 'fuera-horario';
      barraElement.innerHTML = `
        <span class="wsp-icono">🌙</span>
        <span class="wsp-texto">Fuera de horario laboral (8 a 18hs)</span>
      `;
      barraElement.style.display = 'flex';
      return;
    }

    const soyYo = estado.atendidoPor && estado.atendidoPor.toLowerCase() === miNombreLocal;
    const fase = estado.fase || 'PENDIENTE';

    // 1. PENDIENTE
    if (fase === 'PENDIENTE') {
      barraElement.className = 'alerta';
      barraElement.innerHTML = `
        <span class="wsp-icono">🔔</span>
        <span class="wsp-texto">¡Turno <strong>${estado.horaTurno || ''}</strong> sin atender!</span>
        <button id="wsp-btn-injected" class="wsp-btn-revisar">🙋 Responder notificación</button>
      `;
      barraElement.style.display = 'flex';

      const btn = document.getElementById('wsp-btn-injected');
      if (btn) {
        btn.onclick = () => {
          btn.disabled = true;
          btn.innerText = 'Avisando...';
          chrome.runtime.sendMessage({ tipo: 'TOMAR_REVISION' });
        };
      }
      return;
    }

    // 2. EN PROCESO
    if (fase === 'EN_PROCESO') {
      if (soyYo) {
        // Yo estoy revisando
        barraElement.className = 'alerta';
        barraElement.innerHTML = `
          <span class="wsp-icono">👀</span>
          <span class="wsp-texto">Estás revisando WhatsApp</span>
          <button id="wsp-btn-injected" class="wsp-btn-revisar" style="background:#25d366;color:#ffffff;">✅ Terminé de revisar</button>
        `;
        barraElement.style.display = 'flex';

        const btn = document.getElementById('wsp-btn-injected');
        if (btn) {
          btn.onclick = () => {
            btn.disabled = true;
            btn.innerText = 'Guardando...';
            chrome.runtime.sendMessage({ tipo: 'FINALIZAR_REVISION' });
          };
        }
      } else {
        // Otro compañero está revisando
        barraElement.className = 'resuelto';
        barraElement.innerHTML = `
          <span class="wsp-icono">🟡</span>
          <span class="wsp-texto"><strong>${estado.atendidoPor}</strong> estará revisando WhatsApp</span>
        `;
        barraElement.style.display = 'flex';

        setTimeout(() => {
          if (barraElement && estado.fase === 'EN_PROCESO') {
            barraElement.style.display = 'none';
          }
        }, 8000);
      }
      return;
    }

    // 3. COMPLETADO
    if (fase === 'COMPLETADO') {
      barraElement.className = 'resuelto';
      barraElement.innerHTML = `
        <span class="wsp-icono">🟢</span>
        <span class="wsp-texto">Turno ${estado.horaTurno || ''} completado por <strong>${estado.revisadoPor || 'un compañero'}</strong></span>
      `;
      barraElement.style.display = 'flex';
    }
  }

  chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje.tipo === 'ESTADO_ACTUALIZADO') {
      chrome.storage.local.get(['servicioActivo', 'userName'], (res) => {
        if (res.userName) miNombreLocal = res.userName.trim().toLowerCase();
        actualizarUI(mensaje.estado, res.servicioActivo);
      });
    }
  });

  setTimeout(() => {
    crearBarra();
    chrome.runtime.sendMessage({ tipo: 'GET_ESTADO' }, (res) => {
      if (res && res.estado) {
        const activo = res.config ? res.config.servicioActivo : false;
        if (res.config && res.config.userName) miNombreLocal = res.config.userName.trim().toLowerCase();
        actualizarUI(res.estado, activo);
      }
    });
  }, 2000);
})();
