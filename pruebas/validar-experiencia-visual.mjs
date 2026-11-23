const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const html=readFileSync('index.html','utf8');
const css=readFileSync('css/experiencia-visual.css','utf8');
const js=readFileSync('js/experiencia-visual.js','utf8');

function once(value,what){
  assert.equal(html.split(value).length-1,1,what+' debe aparecer una vez');
}
const requiredIds=['private-entry','private-form','fp-wrap','screen-reveal','page-title',
  'carta-container','carta-portada-meta','firma-txt','panel-cartas','lista-cartas',
  'biblioteca-busqueda','panel-fotos','foto-grid','panel-sorpresas','panel-videos',
  'sorpresa-overlay','panel-chat','chat-frame','music-btn'];
for(const id of requiredIds)once('id="'+id+'"','Elemento '+id);
for(const path of ['/css/experiencia-visual.css','/js/experiencia-visual.js',
  '/js/visor-fotos.js'])assert(html.includes(path),'Debe mantener '+path);
for(const target of ['abrirPanelCartas()','abrirFotos()','abrirSorpresas()','abrirVideos()']){
  assert(html.includes(target),'Navegación '+target);
}
assert(html.includes('let cartaEnPortadaId=null;'),'Conservar última carta');
assert(js.includes('String(c.id)!==cartaEnPortada'),'No duplicar carta de portada');
assert(js.includes("addEventListener('input',filtrar)"),'Búsqueda reactiva');
assert(js.includes("c.titulo,c.contenido"),'Buscar título y contenido');
assert(!css.includes('body{background:#fff'),'No sustituir fondo');
assert(css.includes('prefers-reduced-motion'),'Respetar movimiento reducido');
assert(html.includes('/api/auth'),'Conservar validación de acceso');
assert(html.includes('/api/foto-ver'),'Conservar galería existente');
assert(html.includes('silenciarPorContenido'),'Conservar música');

// Detectar errores de sintaxis en cada script JavaScript, sin ejecutar su código.
for(const [i,match] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()){
  if(match[1].trim())new vm.Script(match[1],{filename:'index-inline-'+i+'.js'});
}
new vm.Script(js,{filename:'js/experiencia-visual.js'});
console.log('✓ Experiencia visual: HTML esencial, navegación, biblioteca, privacidad y JavaScript válidos.');
