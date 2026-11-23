import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const Thumb=require('../lib/michi-photo-thumbnails.js');
const fotoApi=readFileSync('api/foto-ver.js','utf8');
const admin=readFileSync('admin/index.html','utf8');
const html=readFileSync('index.html','utf8');
const cartaCss=readFileSync('css/cartas-premium.css','utf8');
const code=readFileSync('js/experiencia-cinematica.js','utf8');
const uuid='a1b2c3d4-1a1b-4c3d-8e9f-a1b2c3d4e5f6';
const store=new Set();
let conversions=0,uploadCount=0;
let lookups=0;
const base='https://private-storage.example.com';
const bucket='media',path='fotos/recuerdo-original.jpg';
const r1=Thumb.pathFor(bucket,path);
const r2=Thumb.pathFor(bucket,path,true);
assert.notEqual(r1,r2,'La portada y tarjeta deben tener tamaños propios');
assert.equal(r1,Thumb.pathFor(bucket,path),'Las rutas deben ser permanentes');
assert(r1.startsWith('galeria/miniaturas/'),'Las miniaturas permanecen en almacenamiento privado');
assert.throws(()=>Thumb.pathFor(bucket,'../secreto'),/Ruta de fotografía/);
assert(readdirSync('api').filter(x=>x.endsWith('.js')).length<=12,
  'No se debe superar el límite de funciones del despliegue Vercel');

const fakeC={
  noCache(res){res.setHeader('Cache-Control','no-store');},
  isAuthorized(req){return req.allowed!==false;},
  fail(res,code,message){return res.status(code).json({error:message});},
  async supabaseRequest(path){
    if(path.startsWith('/rest/v1/fotos?'))return [{
      id:uuid,storage_path:'fotos/recuerdo-original.jpg',url:base+'/object'
    }];
    if(path.startsWith('/storage/v1/object/sign/')){
      const object=path.slice('/storage/v1/object/sign/'.length);
      return {signedURL:'/storage/v1/object/sign/'+object+'?token=demo'};
    }
    throw Error('Unexpected Supabase request: '+path);
  }
};
async function fakeFetch(url,options={}){
  url=String(url);
  if(url.includes('/object/info/chat-archivos/')){
    lookups++;
    const name=url.slice(url.indexOf('/object/info/chat-archivos/')+'/object/info/chat-archivos/'.length);
    return {ok:store.has(decodeURIComponent(name)),status:store.has(decodeURIComponent(name))?200:404};
  }
  if(url.includes('/object/sign/media/')){
    return {
      ok:true,status:200,headers:new Map([['content-length','60']]),
      body:Readable.from([Buffer.alloc(60,4)])
    };
  }
  if(options.method==='POST'&&url.includes('/object/chat-archivos/')){
    const name=url.slice(url.indexOf('/object/chat-archivos/')+'/object/chat-archivos/'.length);
    store.add(decodeURIComponent(name));
    uploadCount++;
    assert(options.body instanceof Buffer,'Debe subir miniatura WebP, no una referencia');
    return {ok:true,status:200};
  }
  throw Error('Unexpected fetch '+url);
}
function fakeSharp(bytes){
  conversions++;
  assert(bytes.length>15,'La conversión recibe datos del original');
  return {
    rotate(){return this;},
    resize(){return this;},
    webp(){return this;},
    async toBuffer(){return Buffer.from('webp-mock-data');}
  };
}
const sandboxModule={exports:{}};
vm.runInNewContext(fotoApi,{
  module:sandboxModule,
  require(id){
    if(id==='../lib/michi-common')return fakeC;
    if(id==='../lib/michi-photo-thumbnails')return Thumb;
    if(id==='sharp')return fakeSharp;
    throw Error('Unexpected import '+id);
  },
  fetch:fakeFetch,Buffer,URL,AbortSignal,console,
  process:{env:{SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:'private-test-key'}}
},{filename:'foto-ver.js'});
const handler=sandboxModule.exports;
function response(){
  return {
    headers:{},statusCode:200,body:null,redirectUrl:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.statusCode=v;return this;},
    json(v){this.body=v;return this;},
    end(v){this.body=v;return this;},
    redirect(code,url){this.statusCode=code;this.redirectUrl=url;return this;}
  };
}
async function request(query,allowed=true){
  const res=response();
  await handler({method:'GET',allowed,query},res);
  return res;
}
const denied=await request({id:uuid,mini:'1'},false);
assert.equal(denied.statusCode,401,'La foto exige sesión');
assert.equal(uploadCount,0,'No debe crear miniaturas para un usuario no autorizado');
const first=await request({id:uuid,mini:'1'});
assert.equal(first.statusCode,200,'La primera consulta genera la miniatura');
assert.equal(first.headers['Content-Type'],'image/webp');
assert(store.has(r1),'La primera miniatura queda persistida en el bucket privado');
assert.equal(conversions,1);
assert.equal(uploadCount,1);
const second=await request({id:uuid,mini:'1'});
assert.equal(second.statusCode,302,'Una segunda visita reutiliza la miniatura guardada');
assert(second.redirectUrl.includes('/storage/v1/object/sign/chat-archivos/'));
assert.equal(conversions,1,'La segunda visita no recompone el archivo original');
assert.equal(uploadCount,1,'La segunda visita no vuelve a subirlo');
const hero=await request({id:uuid,mini:'1',size:'hero'});
assert.equal(hero.statusCode,200,'La portada tiene su propia miniatura');
assert(store.has(r2));
assert.equal(conversions,2);
const original=await request({id:uuid});
assert.equal(original.statusCode,302,'La foto original permanece intacta');
assert(original.redirectUrl.includes('/storage/v1/object/sign/media/'));
const invalid=await request({id:'../../otro',mini:'1'});
assert.equal(invalid.statusCode,400,'Rechaza identificadores inseguros');

assert(admin.includes('optimizarFotosGuardadas()'),
  'La administración debe ofrecer una preparación de fotografías existentes');
assert(admin.includes('await prepararMiniatura(fotoId)'),
  'Al subir una fotografía debe prepararse su miniatura');
assert(admin.includes('prepararMiniatura(newestId,true)'),
  'La foto de portada debe quedar pre-generada');
assert(code.includes("'&mini=1'"),'Las tarjetas deben solicitar imágenes pequeñas');
assert(html.includes("'&mini=1'"),'La galería completa también debe usar imágenes pequeñas');

const themeStart=html.indexOf('const CARTA_TEMAS=');
const themeEnd=html.indexOf('function abrirCarta(c){',themeStart);
assert(themeStart>=0&&themeEnd>themeStart,'Las cartas deben tener paletas asignadas');
const themePanel={dataset:{}};
const themeLabel={textContent:''};
const themeContext=vm.createContext({
  document:{getElementById(id){
    return id==='carta-abierta'?themePanel:themeLabel;
  }},
  Math
});
vm.runInContext(html.slice(themeStart,themeEnd),themeContext);
const colors=new Set();
for(let i=0;i<18;i++){
  const item={id:'carta-recuerdo-'+i};
  const theme=themeContext.temaDeCarta(item);
  assert.equal(theme,themeContext.temaDeCarta(item),
    'Una misma carta debe mantener su color original');
  colors.add(theme);
}
assert(colors.size>=4,'Debe existir diversidad de paletas entre cartas');
themeContext.aplicarColorCarta('lavanda');
assert.equal(themePanel.dataset.tema,'lavanda');
themeContext.cambiarColorCarta();
assert.equal(themePanel.dataset.tema,'durazno','El botón cambia al tema siguiente');
for(const name of ['marfil','lavanda','durazno','salvia','azul'])
  assert(cartaCss.includes('[data-tema="'+name+'"]'),
    'Falta la paleta '+name);
assert(cartaCss.includes('.carta-tema-boton'),'El botón necesita un estilo visual');
console.log('✓ Miniaturas persistentes, originales privados, preparación inicial y seis temas de cartas.');
