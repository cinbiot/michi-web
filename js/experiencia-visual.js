/* Michi: experiencia visual. No se modifican autenticación, carta ni archivos. */
(function(){
  'use strict';
  const ui = {
    search: document.getElementById('biblioteca-busqueda'),
    summary: document.getElementById('biblioteca-resumen'),
    target: document.getElementById('lista-cartas')
  };
  let cartasGuardadas = [];
  let cartaEnPortada = null;

  const normalizar = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();

  function fechaValida(c){
    const date=new Date(c?.created_at || 0);
    return Number.isNaN(date.getTime())?new Date(0):date;
  }
  function limpiar(node){
    while(node?.firstChild)node.removeChild(node.firstChild);
  }
  function crear(tag,className,text){
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=text;
    return element;
  }
  function fechaCorta(date){
    return date.getTime()===0?'Sin fecha':date.toLocaleDateString('es-BO',{
      day:'numeric',month:'long',year:'numeric'
    });
  }
  function mesLargo(date){
    return date.getTime()===0?'Sin fecha':date.toLocaleDateString('es-BO',{
      month:'long',year:'numeric'
    });
  }

  function filtrar(){
    if(!ui.target)return;
    limpiar(ui.target);
    const query=normalizar(ui.search?.value);
    const resultado=cartasGuardadas.filter(c=>{
      const texto=[c.titulo,c.contenido,c.firma,fechaCorta(fechaValida(c))].join(' ');
      return normalizar(texto).includes(query);
    });
    if(ui.summary)ui.summary.textContent=resultado.length===1
      ? 'Una carta para recordar'
      : resultado.length+' cartas en nuestra biblioteca';

    if(!resultado.length){
      ui.target.appendChild(crear('p','biblioteca-vacio',
        query?'No encontramos una carta con esas palabras. Prueba con otra búsqueda.':
        'La carta más reciente te espera en la portada. Aquí iremos guardando las anteriores.'));
      return;
    }
    const groups=new Map();
    for(const carta of resultado){
      const fecha=fechaValida(carta);
      const key=fecha.getTime()===0?'desconocido':fecha.getFullYear()+'-'+fecha.getMonth();
      if(!groups.has(key))groups.set(key,{fecha,items:[]});
      groups.get(key).items.push(carta);
    }
    for(const group of groups.values()){
      const section=crear('section','biblioteca-mes');
      const heading=crear('h3','',mesLargo(group.fecha));
      section.appendChild(heading);
      const grid=crear('div','biblioteca-grid');
      for(const carta of group.items){
        const date=fechaValida(carta);
        const btn=crear('button','biblioteca-libro');
        btn.type='button';
        if(typeof temaDeCarta==='function')btn.dataset.tema=temaDeCarta(carta);
        btn.setAttribute('aria-label','Abrir carta: '+(carta.titulo||'Sin título'));
        btn.appendChild(crear('span','biblioteca-fecha',fechaCorta(date)));
        btn.appendChild(crear('span','biblioteca-titulo',carta.titulo||'Una carta para ti'));
        const preview=String(carta.contenido||'').replace(/\s+/g,' ').trim();
        if(preview)btn.appendChild(crear('span','biblioteca-fragmento',preview));
        btn.appendChild(crear('span','biblioteca-abrir','Abrir carta  ›'));
        btn.addEventListener('click',()=>typeof abrirCarta==='function'&&abrirCarta(carta));
        grid.appendChild(btn);
      }
      section.appendChild(grid);
      ui.target.appendChild(section);
    }
  }

  function mostrarBiblioteca(cartas,featuredId){
    // La última carta permanece en portada; en la biblioteca aparecen las anteriores.
    const ordenadas=(Array.isArray(cartas)?cartas:[])
      .slice().sort((a,b)=>fechaValida(b).getTime()-fechaValida(a).getTime());
    cartaEnPortada=featuredId===undefined||featuredId===null
      ? (ordenadas.length?String(ordenadas[0].id):null)
      : String(featuredId);
    cartasGuardadas=ordenadas.filter(c=>!cartaEnPortada||String(c.id)!==cartaEnPortada);
    if(ui.search)ui.search.value='';
    filtrar();
  }

  if(ui.search)ui.search.addEventListener('input',filtrar);
  const huella=document.getElementById('fp-wrap');
  if(huella){
    huella.setAttribute('role','button');
    huella.setAttribute('tabindex','0');
    huella.setAttribute('aria-label','Desbloquear nuestra página');
    huella.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        if(typeof startScan==='function')startScan();
      }
    });
  }
  const hoja=document.querySelector('.hoja-btn');
  if(hoja)hoja.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      if(typeof abrirPanelCartas==='function')abrirPanelCartas();
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||document.querySelector('.video-ampliado'))return;
    const active=['carta-abierta','panel-videos','panel-fotos',
      'panel-sorpresas','panel-cartas'].find(id=>document.getElementById(id)?.classList.contains('open'));
    if(active&&typeof cerrarPanel==='function'){
      cerrarPanel(active);
      event.preventDefault();
    }
  });
  window.MichiVisual={mostrarBiblioteca};
})();