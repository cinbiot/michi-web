/* Michi Cinemática — estantes de recuerdos y portadas fotográficas reales.
   No registra eventos, no expone archivos y no carga fotografías antes del acceso.
   Usa exclusivamente las mismas rutas privadas que la galería existente. */
(() => {
  'use strict';

  let started=false;
  const MAX_RECIENTES=6;
  const root=document.getElementById('cinema-root');
  const hero=document.getElementById('cinema-hero');
  const heroPhoto=document.getElementById('cinema-hero-image');
  const audio=document.getElementById('bg-music');
  const view=document.getElementById('screen-reveal');
  const catalog={
    fotos:{track:'cinema-fotos-track',all:'fotos'},
    cartas:{track:'cinema-cartas-track',all:'cartas'},
    videos:{track:'cinema-videos-track',all:'videos'},
    sorpresas:{track:'cinema-sorpresas-track',all:'sorpresas'}
  };

  function el(tag,cls,txt){
    const element=document.createElement(tag);
    if(cls)element.className=cls;
    if(txt!==undefined)element.textContent=txt;
    return element;
  }
  function trim(value,max=80){
    const text=String(value??'').replace(/\s+/g,' ').trim();
    return text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
  }
  function fechaGuardada(v){
    const date=new Date(v);
    if(!Number.isFinite(date.getTime())||date.getTime()===0)return '';
    return date.toLocaleDateString('es-BO',{month:'long',year:'numeric'});
  }
  function fotoUrl(foto){
    return '/api/foto-ver?id='+encodeURIComponent(String(foto.id||''));
  }
  function miniaturaUrl(foto,hero=false){
    return '/api/foto-ver?id='+encodeURIComponent(String(foto.id||''))+
      '&mini=1'+(hero?'&size=hero':'');
  }
  function imagenYoutube(raw){
    try{
      const u=new URL(String(raw));
      if(u.protocol!=='https:')return null;
      const host=u.hostname.toLowerCase();
      let id='';
      if(host==='youtu.be'||host==='www.youtu.be')id=u.pathname.split('/')[1]||'';
      else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
        id=u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]||'';
      }
      return /^[a-zA-Z0-9_-]{11}$/.test(id)?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':null;
    }catch(e){return null;}
  }
  function makeCard(kind,title,detail,imageUrl,action,excerpt,isNewest=false,priority=false){
    const card=el('button','cinema-card '+kind);
    card.type='button';
    card.setAttribute('aria-label','Abrir '+(title||'recuerdo'));
    if(isNewest){
      const marker=el('span','cinema-card-featured','Más reciente');
      card.appendChild(marker);
    }
    if(imageUrl){
      const pic=el('img');
      pic.alt=''; // El título de la tarjeta comunica el contenido.
      pic.width=kind==='photo'?600:480;
      pic.height=kind==='photo'?460:270;
      pic.decoding='async';
      pic.loading=kind==='photo'&&(isNewest||priority)?'eager':'lazy';
      pic.fetchPriority=kind==='photo'&&(isNewest||priority)?'high':'auto';
      pic.addEventListener('load',()=>card.classList.add('is-ready'));
      pic.addEventListener('error',()=>{
        // La vista previa puede fallar si el original es demasiado grande o no es JPG/PNG/WebP.
        // En ese caso se usa el endpoint original, sin borrar el archivo existente.
        if(kind==='photo'&&!pic.dataset.originalTried){
          pic.dataset.originalTried='1';
          const id=card.dataset.photoId;
          if(id){pic.src='/api/foto-ver?id='+encodeURIComponent(id);return;}
        }
        pic.remove();
        card.classList.add('image-unavailable');
      });
      card.appendChild(pic);
      pic.src=imageUrl;
    }
    if(kind==='video')card.appendChild(el('span','cinema-play','▶'));
    const content=el('span','cinema-card-text');
    const categories={photo:'Una fotografía',letter:'Una carta',video:'Un video',surprise:'Una sorpresa'};
    content.appendChild(el('span','cinema-card-top',categories[kind]||'Para recordar'));
    content.appendChild(el('span','cinema-card-title',trim(title,72)));
    if(detail)content.appendChild(el('span','cinema-card-detail',trim(detail,115)));
    if(excerpt && kind==='letter' && !detail)content.appendChild(el('span','cinema-card-detail',trim(excerpt,78)));
    card.appendChild(content);
    card.addEventListener('click',action);
    return card;
  }
  function openSection(name){
    if(name==='fotos'&&typeof abrirFotos==='function')abrirFotos();
    else if(name==='cartas'&&typeof abrirPanelCartas==='function')abrirPanelCartas();
    else if(name==='videos'&&typeof abrirVideos==='function')abrirVideos();
    else if(name==='sorpresas'&&typeof abrirSorpresas==='function')abrirSorpresas();
  }
  function empty(track,what,copy,action){
    const card=el('div','cinema-empty');
    const content=el('div','cinema-empty-copy');
    content.appendChild(el('h3','',what));
    content.appendChild(el('p','',copy));
    card.appendChild(content);
    const link=el('button','cinema-viewall','Ver sección  ›');
    link.type='button';
    link.addEventListener('click',()=>openSection(action));
    card.appendChild(link);
    track.appendChild(card);
  }
  function fill(kind,items,error){
    const track=document.getElementById(catalog[kind].track);
    if(!track)return;
    track.replaceChildren();
    if(error){
      empty(track,'Contenido no disponible','No pudimos cargar esta sección. Puedes intentar abrirla nuevamente.',kind);
      return;
    }
    const recientes=items.slice(0,MAX_RECIENTES);
    if(!recientes.length){
      const copy={
        fotos:'Los momentos que guardemos aparecerán aquí, con sus fotografías originales.',
        cartas:'Las cartas anteriores estarán aquí; la más reciente permanece en la portada.',
        videos:'Nuestros videos aparecerán aquí cuando los guardemos.',
        sorpresas:'Los próximos detalles especiales tendrán aquí su lugar.'
      };
      empty(track,'Nuestro espacio sigue creciendo',copy[kind],kind);
      return;
    }
    const description=document.getElementById('cinema-'+kind+'-count');
    if(description){
      const noun={fotos:'fotografías',cartas:'cartas',videos:'videos',sorpresas:'sorpresas'}[kind];
      const article=kind==='videos'?'Los ':'Las ';
      description.textContent=article+recientes.length+' '+noun+' más recientes · Toca para abrir';
    }
    for(const [position,item] of recientes.entries()){
      let card;
      if(kind==='fotos'){
        card=makeCard('photo',item.descripcion||'Un momento nuestro',
          (fechaGuardada(item.created_at)?'Guardada en '+fechaGuardada(item.created_at):'Nuestra galería'),
          miniaturaUrl(item,position===0),()=>{
            const visor=window.MichiFotoVisor;
            if(!visor?.abrirPorUrl(fotoUrl(item),item.descripcion||'Un momento nuestro')){
              openSection('fotos');
            }
          },null,position===0,position===1);
        card.dataset.photoId=String(item.id||'');
      }else if(kind==='cartas'){
        card=makeCard('letter',item.titulo||'Unas palabras para ti',
          fechaGuardada(item.created_at),null,
          ()=>{if(typeof abrirCarta==='function')abrirCarta(item);},item.contenido,position===0);
      }else if(kind==='videos'){
        card=makeCard('video',item.descripcion||'Un momento para volver a ver',
          'Reproducir en nuestros videos',imagenYoutube(item.url),
          ()=>{
            if(typeof abrirVideos==='function')abrirVideos(item.id);
          },null,position===0);
      }else{
        const pendiente=item.vista===false;
        card=makeCard('surprise',
          pendiente?'Una sorpresa por descubrir':(item.titulo||'Algo especial para ti'),
          pendiente?'Abre este detalle especial':trim(item.descripcion,68),
          null,()=>{
            if(typeof mostrarSorpresa==='function')mostrarSorpresa(item);
          },null,position===0);
      }
      track.appendChild(card);
    }
  }

  function setupHero(fotos){
    if(!hero||!heroPhoto||!fotos.length)return;
    // Únicamente recursos privados de /api/foto-ver (autorización en servidor).
    const first=fotos[0];
    heroPhoto.onload=()=>hero.classList.add('has-photo');
    heroPhoto.onerror=()=>{
      if(!heroPhoto.dataset.originalTried){
        heroPhoto.dataset.originalTried='1';
        heroPhoto.src=fotoUrl(first);
      }else hero.classList.remove('has-photo');
    };
    heroPhoto.loading='eager';
    heroPhoto.fetchPriority='high';
    // La misma variante se utiliza en la primera tarjeta para compartir
    // descarga y caché privada del navegador.
    heroPhoto.src=miniaturaUrl(first,true);
  }

  function setupControls(){
    document.querySelectorAll('[data-cinema-go]').forEach(button=>{
      button.addEventListener('click',()=>{
        const action=button.dataset.cinemaGo;
        if(action==='inicio')view?.scrollTo({top:0,behavior:'smooth'});
        else if(action==='ultima'){
          document.getElementById('cinema-ultima-carta')?.scrollIntoView({
            behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
            block:'start'
          });
        }else if(action==='salir')document.getElementById('private-logout')?.click();
        else if(action==='musica'&&typeof toggleMusic==='function')toggleMusic();
        else openSection(action);
      });
    });
    document.querySelectorAll('[data-cinema-scroll]').forEach(button=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.cinemaScroll;
        const track=document.getElementById('cinema-'+id+'-track');
        if(!track)return;
        const direction=button.dataset.cinemaDirection==='previous'?-1:1;
        track.scrollBy({left:direction*Math.max(track.clientWidth*.84,225),
          behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      });
    });
    const musicButton=document.getElementById('cinema-music');
    if(musicButton&&audio){
      const update=()=>{
        const active=!audio.paused;
        musicButton.textContent=active?'♫ Pausar música':'♫ Música';
        musicButton.setAttribute('aria-pressed',String(active));
      };
      audio.addEventListener('play',update);
      audio.addEventListener('pause',update);
      update();
    }
  }

  async function loadHighlights(){
    // Cada colección se recupera una sola vez tras desbloquear; fallos aislados
    // nunca impiden ver las otras secciones.
    const queries=[
      Promise.resolve(sb.from('fotos').select('*').order('created_at',{ascending:false}).limit(MAX_RECIENTES)),
      Promise.resolve(sb.from('carta').select('*').order('created_at',{ascending:false}).limit(MAX_RECIENTES+1)),
      Promise.resolve(sb.from('videos').select('*').order('created_at',{ascending:false}) .limit(MAX_RECIENTES)),
      Promise.resolve(sb.from('sorpresas').select('*').order('created_at',{ascending:false}) .limit(MAX_RECIENTES))
    ];
    const results=await Promise.allSettled(queries);
    const values=results.map(r=>{
      if(r.status!=='fulfilled'||r.value?.error||!Array.isArray(r.value?.data))
        return {items:[],error:true};
      return {items:r.value.data,error:false};
    });
    const photos=values[0];
    if(!photos.error)setupHero(photos.items);
    fill('fotos',photos.items,photos.error);
    // La carta más reciente queda exclusivamente en el espacio destacado.
    fill('cartas',values[1].items.slice(1),values[1].error);
    fill('videos',values[2].items,values[2].error);
    fill('sorpresas',values[3].items,values[3].error);
  }

  function init(){
    if(started||!root)return;
    started=true;
    setupControls();
    loadHighlights().catch(error=>{
      console.warn('Michi: algunas portadas todavía no se pudieron cargar.',error);
      for(const kind of Object.keys(catalog)){
        const track=document.getElementById(catalog[kind].track);
        if(track&&!track.children.length)fill(kind,[],true);
      }
    });
  }
  window.MichiCinema={init};
})();
