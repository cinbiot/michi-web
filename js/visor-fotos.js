/* Proyecto Michi — visor de fotos V7
   Funciona con imágenes de la galería, adjuntos del chat y fotos del administrador.
   No modifica el almacenamiento, Supabase, las rutas ni los mensajes. */
(() => {
  'use strict';
  if (window.__michiVisorFotosActivo) return;
  window.__michiVisorFotosActivo = true;

  const THUMBNAILS = '#foto-grid img, #fotos-grid .foto-item img, .attachment img';
  let visor;
  let escenario;
  let imagenGrande;
  let botonZoom;
  let botonCerrar;
  let elementoAnterior = null;
  let imagenAnterior = null;
  let ampliada = false;

  function iniciar() {
    const estilos = document.createElement('style');
    estilos.textContent = `
      ${THUMBNAILS} { cursor: zoom-in; }
      ${THUMBNAILS}:focus-visible { outline: 3px solid #ff93bd; outline-offset: 3px; }
      #michi-visor-fotos[hidden] { display:none !important; }
      #michi-visor-fotos {
        position:fixed; inset:0; z-index:2000; display:flex; flex-direction:column;
        background:radial-gradient(circle at 45% 15%, #211225 0%, #070914 70%);
        color:#f9eff9; font-family:Montserrat,Arial,sans-serif;
        padding:max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
                max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
        box-sizing:border-box; animation:michiAparece .18s ease-out;
      }
      @keyframes michiAparece { from {opacity:0} to {opacity:1} }
      #michi-visor-fotos * { box-sizing:border-box; }
      .michi-visor-barra { display:flex; justify-content:space-between; align-items:center;
        gap:10px; padding:5px 6px 12px; flex-shrink:0; }
      .michi-visor-titulo {font-size:clamp(13px,2.5vw,16px);color:#f4d5e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .michi-visor-controles {display:flex;align-items:center;gap:9px;flex-shrink:0;}
      .michi-visor-boton {font:inherit;font-size:12px;color:#fff;cursor:pointer;
        border:1px solid #805270;background:rgba(80,32,71,.5);
        border-radius:999px;min-height:40px;padding:8px 14px;}
      .michi-visor-boton:hover,.michi-visor-boton:focus-visible {background:#753855;outline:2px solid #f1a0c9;outline-offset:2px;}
      .michi-visor-cerrar {font-size:23px;width:42px;padding:0;line-height:1;}
      #michi-visor-escenario { flex:1; min-height:0; min-width:0;
        display:flex;align-items:center;justify-content:center;overflow:auto;
        overscroll-behavior:contain; touch-action:pan-x pan-y pinch-zoom;
        border:1px solid rgba(255,180,220,.12);border-radius:16px;
        background:rgba(0,0,0,.23);padding:8px; }
      #michi-visor-imagen { display:block;width:auto;height:auto;
        max-width:100%; max-height:100%; object-fit:contain;
        margin:auto; flex-shrink:0; border-radius:5px;
        box-shadow:0 8px 32px rgba(0,0,0,.42);cursor:zoom-in; }
      #michi-visor-escenario.michi-tamano-real {align-items:flex-start;justify-content:flex-start;}
      #michi-visor-escenario.michi-tamano-real #michi-visor-imagen {
        max-width:none;max-height:none;cursor:zoom-out;
      }
      .michi-visor-ayuda {padding:10px;text-align:center;color:#c7b4ca;font-size:11px;flex-shrink:0;}
      @media (max-width:520px) {
        .michi-visor-boton {font-size:11px;padding:7px 10px;}
        .michi-visor-cerrar {padding:0;}
      }
    `;
    document.head.appendChild(estilos);

    visor = document.createElement('div');
    visor.id = 'michi-visor-fotos';
    visor.setAttribute('role', 'dialog');
    visor.setAttribute('aria-modal', 'true');
    visor.setAttribute('aria-label', 'Foto ampliada');
    visor.hidden = true;
    visor.innerHTML = `
      <div class="michi-visor-barra">
        <span class="michi-visor-titulo">📷 Nuestros recuerdos</span>
        <div class="michi-visor-controles">
          <button type="button" class="michi-visor-boton" id="michi-visor-zoom">Tamaño real</button>
          <button type="button" class="michi-visor-boton michi-visor-cerrar" id="michi-visor-cerrar" aria-label="Cerrar foto">×</button>
        </div>
      </div>
      <div id="michi-visor-escenario">
        <img id="michi-visor-imagen" alt="Fotografía ampliada">
      </div>
      <div class="michi-visor-ayuda">Ver la foto completa · Toca «Tamaño real» para ampliar · Esc para cerrar</div>`;
    document.body.appendChild(visor);
    escenario = document.getElementById('michi-visor-escenario');
    imagenGrande = document.getElementById('michi-visor-imagen');
    botonZoom = document.getElementById('michi-visor-zoom');
    botonCerrar = document.getElementById('michi-visor-cerrar');

    botonCerrar.addEventListener('click', cerrar);
    botonZoom.addEventListener('click', cambiarZoom);
    imagenGrande.addEventListener('click', cambiarZoom);
    escenario.addEventListener('click', e => { if(e.target === escenario) cerrar(); });
    document.addEventListener('keydown', e => {
      if(!visor.hidden) {
        if(e.key === 'Escape') {e.preventDefault(); cerrar();}
      } else if ((e.key==='Enter'||e.key===' ') && e.target.matches(THUMBNAILS)) {
        e.preventDefault(); abrir(e.target);
      }
    });
    document.addEventListener('click', e => {
      const mini = e.target.closest(THUMBNAILS);
      if(!mini) return;
      e.preventDefault();
      e.stopPropagation();
      abrir(mini);
    });
    // Las imágenes se crean dinámicamente al consultar Supabase y los mensajes.
    // Este observador mejora el uso con teclado sin cambiar la lógica de carga.
    let programado = false;
    const prepararMiniaturas = () => {
      if(programado) return;
      programado = true;
      requestAnimationFrame(() => {
        programado = false;
        document.querySelectorAll(THUMBNAILS).forEach(img => {
          if (!img.hasAttribute('tabindex') && !img.closest('a')) img.tabIndex=0;
          if (!img.closest('a')) img.setAttribute('role','button');
          if (!img.hasAttribute('title')) img.title='Ver foto completa';
          if (!img.hasAttribute('aria-label')) img.setAttribute('aria-label','Ampliar fotografía');
        });
      });
    };
    const observar = new MutationObserver(prepararMiniaturas);
    // Observar sólo los contenedores de fotos y el chat si existen.
    ['foto-grid','fotos-grid','messages','mensajes','chat-messages'].forEach(id => {
      const el = document.getElementById(id);
      if(el) observar.observe(el,{childList:true,subtree:true});
    });
    prepararMiniaturas();
  }

  function abrir(mini) {
    const src = mini.currentSrc || mini.src;
    if (!src) return;
    elementoAnterior = mini;
    imagenAnterior = mini.src;
    ampliada = false;
    escenario.classList.remove('michi-tamano-real');
    botonZoom.textContent = 'Tamaño real';
    imagenGrande.alt = mini.alt || 'Fotografía ampliada';
    imagenGrande.src = src;
    visor.hidden = false;
    botonCerrar.focus({preventScroll:true});
  }
  function cambiarZoom() {
    if(visor.hidden) return;
    ampliada=!ampliada;
    escenario.classList.toggle('michi-tamano-real',ampliada);
    botonZoom.textContent = ampliada ? 'Ajustar a pantalla' : 'Tamaño real';
    if(ampliada){ escenario.scrollTop=0; escenario.scrollLeft=0; }
  }
  function cerrar() {
    if(visor.hidden) return;
    visor.hidden=true;
    imagenGrande.removeAttribute('src');
    escenario.classList.remove('michi-tamano-real');
    if(elementoAnterior && elementoAnterior.isConnected) {
      elementoAnterior.focus({preventScroll:true});
    }
    elementoAnterior = null;
    imagenAnterior = null;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
