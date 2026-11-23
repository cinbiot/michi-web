import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
const css=readFileSync('css/experiencia-cinematica.css','utf8');
const script=readFileSync('js/experiencia-cinematica.js','utf8');
new vm.Script(script,{filename:'experiencia-cinematica.js'});
assert(html.includes('/css/experiencia-cinematica.css'),'Debe cargar estilo cinematográfico');
assert(html.includes('/js/experiencia-cinematica.js'),'Debe cargar el motor de portadas');
assert(html.includes('id="cinema-root"'),'Debe conservar portada cinematográfica');
assert(html.includes('id="cinema-hero-image"'),'Debe haber fotografía principal');
for(const name of ['fotos','cartas','videos','sorpresas']){
  assert(html.includes('id="cinema-'+name+'-track"'),'Falta colección '+name);
  assert(html.includes('data-cinema-go="'+name+'"'),'Falta navegación '+name);
}
assert(html.includes('id="cinema-music"'),'La música debe permanecer accesible');
assert(html.includes('data-cinema-go="salir"'),'Debe poder cerrarse sesión');
assert(css.includes('#btn-corazon,#btn-gatito,#btn-video,#btn-chat,'),'Ocultar botones flotantes redundantes');
assert(css.includes('display:none!important'),'Ocultar botones aunque tenían estilo inline');
assert(css.includes('prefers-reduced-motion'),'Respetar movimiento reducido');
assert(html.includes('if(window.MichiCinema)window.MichiCinema.init();'),'Solo cargar portadas al desbloquear');
assert(html.includes('document.getElementById(\'featured-title\')'),'No reemplazar título del hero por una carta');
assert(script.includes('/api/foto-ver?id='),'Foto privada autenticada');
assert(!script.includes('storage/v1/object/public/'),'No revelar recursos públicos en el frontend');
assert(script.includes("Promise.allSettled"),'La falla de una colección no bloquea otras');
assert(script.includes("textContent"),'El contenido dinámico debe insertarse como texto');

class MockNode {
  constructor(tag='div'){
    this.tagName=tag;
    this.children=[];
    this.attrs={};
    this.handlers={};
    this.classList={add(){},remove(){}};
    this.dataset={};
  }
  appendChild(child){this.children.push(child);return child;}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(key,value){this.attrs[key]=value;}
  addEventListener(type,listener){this.handlers[type]=listener;}
  remove(){}
}
const ids=['cinema-root','cinema-hero','cinema-hero-image','screen-reveal','bg-music',
  'cinema-fotos-track','cinema-cartas-track','cinema-videos-track','cinema-sorpresas-track'];
const nodes=Object.fromEntries(ids.map(id=>[id,new MockNode()]));
const uuid='11111111-1111-4111-8111-111111111111';
const records={
  fotos:[{id:uuid,descripcion:'Nuestro paseo',created_at:'2026-10-18T12:00:00Z'}],
  carta:[
    {id:'c1',titulo:'Carta de hoy',contenido:'Última carta',created_at:'2026-11-01T12:00:00Z'},
    {id:'c0',titulo:'Carta anterior',contenido:'Recuerdo de ayer',created_at:'2026-10-01T12:00:00Z'}
  ],
  videos:[{url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',descripcion:'Nuestro video'}],
  sorpresas:[{id:'s1',titulo:'Un regalo especial',descripcion:'Una nota'}]
};
let requests=0;
const sb={from(table){
  const chain={
    select(){return chain;},order(){return chain;},limit(){return chain;},
    then(resolve){requests++;resolve({data:records[table]||[],error:null});}
  };
  return chain;
}};
const document={
  getElementById:id=>nodes[id]||null,
  querySelectorAll:()=>[],
  createElement:tag=>new MockNode(tag)
};
const window={matchMedia:()=>({matches:false})};
const ctx=vm.createContext({document,window,sb,console,URL,encodeURIComponent,Promise});
vm.runInContext(script,ctx);
assert.equal(requests,0,'La galería no debe consultarse antes de la entrada privada.');
assert.equal(nodes['cinema-hero-image'].src,undefined,'No cargar foto antes del acceso.');
assert.equal(typeof window.MichiCinema?.init,'function','El módulo debe poder iniciarse');
window.MichiCinema.init();
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(requests,4,'Consultar 4 colecciones, una sola vez');
assert.equal(nodes['cinema-fotos-track'].children.length,1,'Mostrar las fotografías reales');
assert.equal(nodes['cinema-cartas-track'].children.length,1,'No duplicar última carta en la colección');
assert.equal(nodes['cinema-videos-track'].children.length,1,'Mostrar videos');
assert.equal(nodes['cinema-sorpresas-track'].children.length,1,'Mostrar sorpresas');
assert.equal(nodes['cinema-hero-image'].src,'/api/foto-ver?id='+uuid,'Foto principal de la galería privada');
window.MichiCinema.init();
assert.equal(requests,4,'Evitar cargar portadas dos veces');
console.log('✓ Cine Michi: accesibilidad, privacidad, estantes, imagen real, música y JS válidos.');
