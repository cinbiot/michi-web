import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
const css=readFileSync('css/experiencia-cinematica.css','utf8');
const script=readFileSync('js/experiencia-cinematica.js','utf8');
const visor=readFileSync('js/visor-fotos.js','utf8');
new vm.Script(script,{filename:'experiencia-cinematica.js'});

assert(html.includes('/css/experiencia-cinematica.css'),'El estilo cinematográfico debe cargarse');
assert(html.includes('/js/experiencia-cinematica.js'),'El motor de portadas debe cargarse');
assert(html.includes('id="cinema-root"'),'La portada debe existir');
assert(html.includes('id="cinema-hero-image"'),'La foto de portada debe existir');
for(const kind of ['fotos','cartas','videos','sorpresas']){
  assert(html.includes('id="cinema-'+kind+'-track"'),'Falta colección '+kind);
  assert(html.includes('data-cinema-go="'+kind+'"'),'Falta navegación '+kind);
  assert(html.includes('id="cinema-'+kind+'-count"'),'Falta resumen '+kind);
}
assert(html.includes('id="cinema-music"'),'La música debe permanecer accesible');
assert(html.includes('data-cinema-go="salir"'),'Debe poder cerrarse la sesión');
assert(css.includes('#btn-corazon,#btn-gatito,#btn-video,#btn-chat,'),'Ocultar botones flotantes redundantes');
assert(css.includes('display:none!important'),'Ocultar los botones que tenían estilos inline');
assert(css.includes('prefers-reduced-motion'),'Respetar movimiento reducido');
assert(css.includes('.cinema-card-featured'),'Distinguir el recuerdo más reciente');
assert(html.includes('if(window.MichiCinema)window.MichiCinema.init();'),'La portada solo debe consultar al desbloquear');
assert(html.includes("document.getElementById('featured-title')"),'El título del hero no debe reemplazarse con el de la carta');
assert(html.includes('async function abrirVideos(videoId=null)'),'Permitir elegir un video específico');
assert(html.includes('const selected=videoId==null'),'Dar prioridad al video elegido');
assert(html.includes('function enlaceVideoEmbed'),'Usar enlaces compatibles de YouTube y Drive');
assert(visor.includes('window.MichiFotoVisor={abrirPorUrl}'),'Visor abre directamente fotografía específica');
assert(script.includes('/api/foto-ver?id='),'Fotos solo mediante ruta privada');
assert(!script.includes('storage/v1/object/public/'),'No usar almacenamiento público de fotos');
assert(script.includes('Promise.allSettled'),'Falla de una sección no debe bloquear las demás');

class Node {
  constructor(tag='div'){
    this.tagName=tag;this.children=[];this.attrs={};this.handlers={};this.dataset={};
    this.classList={add(){},remove(){}};
  }
  appendChild(child){this.children.push(child);return child;}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(key,value){this.attrs[key]=value;}
  addEventListener(type,handler){this.handlers[type]=handler;}
  remove(){}
}
const names=['cinema-root','cinema-hero','cinema-hero-image','screen-reveal','bg-music',
  'cinema-fotos-track','cinema-cartas-track','cinema-videos-track','cinema-sorpresas-track',
  'cinema-fotos-count','cinema-cartas-count','cinema-videos-count','cinema-sorpresas-count'];
const nodes=Object.fromEntries(names.map(n=>[n,new Node()]));
const firstId='11111111-1111-4111-8111-111111111111';
const rows={
  fotos:Array.from({length:9},(_,i)=>({
    id:i===0?firstId:'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'),
    descripcion:'Paseo '+i,created_at:'2026-11-01T12:00:00Z'
  })),
  carta:Array.from({length:9},(_,i)=>({
    id:'c'+i,titulo:'Carta '+i,contenido:'Historia '+i,created_at:'2026-11-01T12:00:00Z'
  })),
  videos:Array.from({length:9},(_,i)=>({
    id:'v'+i,descripcion:'Video '+i,
    url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })),
  sorpresas:Array.from({length:9},(_,i)=>({
    id:'s'+i,titulo:'Una sorpresa '+i,descripcion:'Un regalo '+i,vista:i!==0
  }))
};
let requests=0;
const limits={};
const sb={from(table){
  let limit=Infinity;
  const chain={
    select(){return chain;},order(){return chain;},
    limit(n){limit=n;limits[table]=n;return chain;},
    then(resolve){requests++;resolve({data:(rows[table]||[]).slice(0,limit),error:null});}
  };
  return chain;
}};
const opened={photos:[],videos:[],letters:[],surprises:[]};
const window={
  matchMedia:()=>({matches:false}),
  MichiFotoVisor:{abrirPorUrl:(url,alt)=>{opened.photos.push({url,alt});return true;}}
};
const document={
  getElementById:id=>nodes[id]||null,
  querySelectorAll:()=>[],
  createElement:tag=>new Node(tag)
};
const context=vm.createContext({
  window,document,sb,console,URL,Promise,encodeURIComponent,
  abrirCarta:item=>opened.letters.push(item.id),
  abrirVideos:id=>opened.videos.push(id),
  mostrarSorpresa:item=>opened.surprises.push(item.id)
});
vm.runInContext(script,context);
assert.equal(requests,0,'No consultar fotos privadas antes de desbloquear');
assert.equal(nodes['cinema-hero-image'].src,undefined,'No descargar portada antes de desbloquear');
assert.equal(typeof window.MichiCinema?.init,'function','Debe exportar inicialización');
window.MichiCinema.init();
await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(requests,4,'Consultar cuatro colecciones, una vez');
assert.deepEqual(limits,{fotos:6,carta:7,videos:6,sorpresas:6},'Descargar solo los seis recientes y siete cartas incluyendo portada');
for(const type of ['fotos','cartas','videos','sorpresas'])
  assert.equal(nodes['cinema-'+type+'-track'].children.length,6,'Deben verse exactamente seis '+type);
assert.equal(nodes['cinema-hero-image'].src,
  '/api/foto-ver?id='+firstId+'&mini=1&size=hero','Portada con imagen optimizada autenticada');
nodes['cinema-fotos-track'].children[0].handlers.click();
nodes['cinema-cartas-track'].children[0].handlers.click();
nodes['cinema-videos-track'].children[0].handlers.click();
nodes['cinema-sorpresas-track'].children[0].handlers.click();
assert.equal(opened.photos[0].url,'/api/foto-ver?id='+firstId,'Abrir fotografía seleccionada, no lista');
assert(nodes['cinema-fotos-track'].children[0].children.some(n=>n.tagName==='img'&&n.src.startsWith('/api/foto-ver?') && n.src.includes('&mini=1')), 'Tarjeta usa miniatura WebP privada');
assert.equal(opened.letters[0],'c1','Abrir carta exacta, excluyendo última de portada');
assert.equal(opened.videos[0],'v0','Abrir video seleccionado');
assert.equal(opened.surprises[0],'s0','Abrir sorpresa seleccionada');
assert(nodes['cinema-videos-count'].textContent.includes('Los 6 videos'),'Etiqueta natural para videos');
window.MichiCinema.init();
assert.equal(requests,4,'No duplicar consultas de portadas');
// Lectura de cartas: sobre animado, texto legible y contenido conservado.
const cartaCss=readFileSync('css/cartas-premium.css','utf8');
const miniaturaApi=readFileSync('api/foto-ver.js','utf8');
const packageInfo=JSON.parse(readFileSync('package.json','utf8'));
new vm.Script(miniaturaApi,{filename:'api/foto-ver.js'});
assert(html.includes('css/cartas-premium.css'),'Falta estilo de carta premium');
assert(html.includes('class="carta-sobre-solapa"'),'Falta la apertura de sobre');
assert(html.includes('class="carta-sobre-sello"'),'Falta el lacre decorativo');
assert(html.includes('id="ca-contenido"'),'No debe perderse el texto original');
assert(html.includes('contenido.replaceChildren()'),'Actualizar carta sin inyección HTML');
assert(html.includes("panel.setAttribute('aria-hidden','false')"),'Carta accesible al abrir');
assert(html.includes("panel.classList.add('open')"),'Debe abrirse la carta');
assert(cartaCss.includes('carta-hoja-desplegar'),'La hoja debe desplegarse');
assert(cartaCss.includes('prefers-reduced-motion'),'Respeto por movimiento reducido');
assert(miniaturaApi.includes('C.isAuthorized(req)'),'Miniaturas deben exigir sesión');
assert(miniaturaApi.includes("select=id,storage_path,url"),'Solo fotos registradas');
assert(miniaturaApi.includes("req.query.mini==='1'"),'Miniatura opcional integrada al endpoint existente');
assert(miniaturaApi.includes("const sharp=require('sharp')"),'Miniatura WebP generada desde la función existente');
assert(miniaturaApi.includes(".webp({quality:hero?78:70"),'Vista previa comprimida, original intacto');
assert(miniaturaApi.includes("if(!mini){"),'La foto completa mantiene el flujo original');
assert(packageInfo.dependencies.sharp==='0.35.4','Instalar conversor Sharp actualizado');
const {readdirSync}=await import('node:fs');
const funciones=readdirSync('api').filter(name=>name.endsWith('.js'));
assert(funciones.length<=12,'Vercel Hobby admite como máximo 12 funciones');
assert(nodes['cinema-fotos-track'].children[0].children.some(n=>
  n.tagName==='img' && n.src.startsWith('/api/foto-ver?') && n.src.includes('&mini=1')),
  'La tarjeta debe pedir una miniatura en lugar de la foto completa');
console.log('✓ Michi: seis recientes, miniaturas privadas, sobre animado y cartas seguras.');
