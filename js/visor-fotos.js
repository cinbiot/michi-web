/* Proyecto Michi — visor de fotos V7.1
   Mejora visual: sin texto inferior, zoom controlado y opción permanente de reducir.
   La galería, el chat, el administrador y las rutas de almacenamiento no cambian. */
(() => {
  'use strict';
  if (window.__michiVisorFotosActivo) return;
  window.__michiVisorFotosActivo = true;

  const MINIATURAS = '#foto-grid img, #fotos-grid .foto-item img, .attachment img';
  const FACTOR_ZOOM = 1.6; // Ampliación moderada; nunca muestra dimensiones nativas gigantes.
  let visor, escenario, contenedor, imagen, botonZoom, botonCerrar;
  let miniaturaAnterior = null;
  let ampliada = false;
  let generacionImagen = 0;

  function iniciar() {
    const estilos = document.createElement('style');
    estilos.textContent = `
      ${MINIATURAS} { cursor: zoom-in; }
      ${MINIATURAS}:focus-visible { outline: 3px solid #ff93bd; outline-offset: 3px; }
      #michi-visor-fotos[hidden] { display: none !important; }
      #michi-visor-fotos {
        position: fixed; inset: 0; z-index: 2000;
        display: flex; flex-direction: column;
        box-sizing: border-box;
        background: radial-gradient(circle at 45% 15%, #211225 0%, #070914 70%);
        color: #f9eff9; font-family: Montserrat, Arial, sans-serif;
        padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
                 max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
        animation: michiAparece .18s ease-out;
      }
      @keyframes michiAparece { from { opacity: 0; } to { opacity: 1; } }
      #michi-visor-fotos * { box-sizing: border-box; }
      .michi-visor-barra {
        display: flex; justify-content: space-between; align-items: center;
        gap: 10px; padding: 5px 6px 12px; flex-shrink: 0;
      }
      .michi-visor-titulo {
        font-size: clamp(13px, 2.5vw, 16px); color: #f4d5e7;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .michi-visor-controles { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
      .michi-visor-boton {
        font: inherit; font-size: 12px; color: #fff; cursor: pointer;
        border: 1px solid #805270; background: rgba(80,32,71,.5);
        border-radius: 999px; min-height: 40px; padding: 8px 14px;
      }
      .michi-visor-boton:hover, .michi-visor-boton:focus-visible {
        background: #753855; outline: 2px solid #f1a0c9; outline-offset: 2px;
      }
      .michi-visor-cerrar { font-size: 23px; width: 42px; padding: 0; line-height: 1; }
      #michi-visor-escenario {
        flex: 1; min-height: 0; min-width: 0; overflow: auto; position: relative;
        overscroll-behavior: contain; touch-action: pan-x pan-y;
        border: 1px solid rgba(255,180,220,.12); border-radius: 16px;
        background: rgba(0,0,0,.23);
      }
      #michi-visor-contenido {
        display: flex; align-items: center; justify-content: center;
        width: max-content; height: max-content;
        min-width: 100%; min-height: 100%; padding: 10px;
      }
      #michi-visor-imagen {
        display: block; width: auto; height: auto;
        max-width: none; max-height: none; object-fit: contain; flex-shrink: 0;
        border-radius: 5px; box-shadow: 0 8px 32px rgba(0,0,0,.42);
        cursor: zoom-in;
      }
      #michi-visor-escenario.michi-acercado #michi-visor-imagen { cursor: zoom-out; }
      @media (max-width: 520px) {
        .michi-visor-boton { font-size: 11px; padding: 7px 10px; }
        .michi-visor-cerrar { padding: 0; }
      }
    `;
    document.head.appendChild(estilos);

    visor = document.createElement('div');
    visor.id = 'michi-visor-fotos';
    visor.setAttribute('role', 'dialog');
    visor.setAttribute('aria-modal', 'true');
    visor.setAttribute('aria-label', 'Fotografía ampliada');
    visor.hidden = true;
    visor.innerHTML = `
      <div class="michi-visor-barra">
        <span class="michi-visor-titulo">📷 Nuestros recuerdos</span>
        <div class="michi-visor-controles">
          <button type="button" class="michi-visor-boton" id="michi-visor-zoom" aria-pressed="false">Acercar +</button>
          <button type="button" class="michi-visor-boton michi-visor-cerrar" id="michi-visor-cerrar" aria-label="Cerrar foto">×</button>
        </div>
      </div>
      <div id="michi-visor-escenario">
        <div id="michi-visor-contenido">
          <img id="michi-visor-imagen" alt="Fotografía ampliada">
        </div>
      </div>`;
    document.body.appendChild(visor);
    escenario = document.getElementById('michi-visor-escenario');
    contenedor = document.getElementById('michi-visor-contenido');
    imagen = document.getElementById('michi-visor-imagen');
    botonZoom = document.getElementById('michi-visor-zoom');
    botonCerrar = document.getElementById('michi-visor-cerrar');

    botonCerrar.addEventListener('click', cerrar);
    botonZoom.addEventListener('click', cambiarZoom);
    imagen.addEventListener('click', cambiarZoom);
    escenario.addEventListener('click', e => {
      if (e.target === escenario || e.target === contenedor) cerrar();
    });
    imagen.addEventListener('load', () => {
      if (!visor.hidden && imagen.complete && imagen.naturalWidth) {
        dimensionar();
        imagen.style.visibility = 'visible';
      }
    });
    imagen.addEventListener('error', () => {
      if (!visor.hidden) imagen.style.visibility = 'hidden';
    });
    window.addEventListener('resize', () => {
      if (!visor.hidden && imagen.naturalWidth) dimensionar();
    });
    document.addEventListener('keydown', e => {
      if (!visor.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
      } else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches(MINIATURAS)) {
        e.preventDefault(); abrir(e.target);
      }
    });
    document.addEventListener('click', e => {
      const mini = e.target.closest(MINIATURAS);
      if (!mini) return;
      e.preventDefault();
      e.stopPropagation();
      abrir(mini);
    });

    // Las miniaturas llegan dinámicamente desde la galería y el chat.
    let programado = false;
    const prepararMiniaturas = () => {
      if (programado) return;
      programado = true;
      requestAnimationFrame(() => {
        programado = false;
        document.querySelectorAll(MINIATURAS).forEach(img => {
          if (!img.hasAttribute('tabindex') && !img.closest('a')) img.tabIndex = 0;
          if (!img.closest('a')) img.setAttribute('role', 'button');
          if (!img.hasAttribute('title')) img.title = 'Ver foto completa';
          if (!img.hasAttribute('aria-label')) img.setAttribute('aria-label', 'Ampliar fotografía');
        });
      });
    };
    const observador = new MutationObserver(prepararMiniaturas);
    ['foto-grid', 'fotos-grid', 'messages', 'mensajes', 'chat-messages'].forEach(id => {
      const el = document.getElementById(id);
      if (el) observador.observe(el, { childList: true, subtree: true });
    });
    prepararMiniaturas();
  }

  function actualizarBoton() {
    escenario.classList.toggle('michi-acercado', ampliada);
    botonZoom.textContent = ampliada ? 'Reducir −' : 'Acercar +';
    botonZoom.setAttribute('aria-pressed', String(ampliada));
  }

  function centrarDesplazamiento() {
    // Solo pequeños desplazamientos de una ampliación controlada, no miles de píxeles.
    escenario.scrollLeft = Math.max(0, (escenario.scrollWidth - escenario.clientWidth) / 2);
    escenario.scrollTop = Math.max(0, (escenario.scrollHeight - escenario.clientHeight) / 2);
  }

  function dimensionar() {
    if (!imagen.naturalWidth || visor.hidden) return;
    const disponibleAncho = Math.max(1, escenario.clientWidth - 24);
    const disponibleAlto = Math.max(1, escenario.clientHeight - 24);
    const ajuste = Math.min(1,
      disponibleAncho / imagen.naturalWidth,
      disponibleAlto / imagen.naturalHeight
    );
    const factor = ajuste * (ampliada ? FACTOR_ZOOM : 1);
    imagen.style.width = Math.max(1, Math.round(imagen.naturalWidth * factor)) + 'px';
    imagen.style.height = Math.max(1, Math.round(imagen.naturalHeight * factor)) + 'px';
    requestAnimationFrame(centrarDesplazamiento);
  }

  function abrir(mini) {
    const src = mini.currentSrc || mini.src;
    if (!src) return;
    miniaturaAnterior = mini;
    ampliada = false;
    actualizarBoton();
    escenario.scrollLeft = 0;
    escenario.scrollTop = 0;
    imagen.style.visibility = 'hidden';
    imagen.style.width = '1px';
    imagen.style.height = '1px';
    imagen.alt = mini.alt || 'Fotografía ampliada';
    visor.hidden = false;
    // Evita reutilizar dimensiones de la fotografía anterior mientras carga otra.
    const generacion = ++generacionImagen;
    imagen.onload = () => {
      if (generacion !== generacionImagen || visor.hidden) return;
      dimensionar();
      imagen.style.visibility = 'visible';
    };
    imagen.src = src;
    if (imagen.complete && imagen.naturalWidth) imagen.onload();
    botonCerrar.focus({ preventScroll: true });
  }

  function cambiarZoom() {
    if (visor.hidden || !imagen.naturalWidth) return;
    ampliada = !ampliada;
    actualizarBoton();
    dimensionar();
  }

  function cerrar() {
    if (visor.hidden) return;
    visor.hidden = true;
    ++generacionImagen;
    imagen.onload = null;
    imagen.removeAttribute('src');
    imagen.style.visibility = 'hidden';
    ampliada = false;
    actualizarBoton();
    if (miniaturaAnterior && miniaturaAnterior.isConnected) {
      miniaturaAnterior.focus({ preventScroll: true });
    }
    miniaturaAnterior = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else iniciar();
})();
