// Proyecto Michi — acceso autenticado a las fotos registradas en la galería.
// Compatible con las fotos antiguas en el bucket "media" y las nuevas en "chat-archivos".
const C = require('../lib/michi-common');
const Thumb=require('../lib/michi-photo-thumbnails');
const PREVIEW_BUCKET='chat-archivos';
const SOURCE_MAX=22*1024*1024;
function storageBase(){
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(!base.startsWith('https://')||!key)throw Error('Configuración de almacenamiento no disponible');
  return {base,key};
}
function headersFor(key){
  return {apikey:key,Authorization:'Bearer '+key};
}
async function existsThumbnail(bucket,path){
  const {base,key}=storageBase();
  const url=base+'/storage/v1/object/info/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/');
  const resp=await fetch(url,{headers:headersFor(key),signal:AbortSignal.timeout(9000)});
  if(resp.ok)return true;
  if([400,404].includes(resp.status))return false;
  throw Error('Error consultando miniatura privada: '+resp.status);
}
async function signedObject(bucket,path,expiresIn=240){
  const {base}=storageBase();
  const d=await C.supabaseRequest('/storage/v1/object/sign/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn})
  });
  return urlFirmada(base,d?.signedURL||d?.signedUrl);
}
async function originalBytes(source){
  const r=await fetch(source,{signal:AbortSignal.timeout(19000)});
  if(!r.ok||!r.body)throw Error('No se pudo obtener la foto original');
  const stated=Number(r.headers.get('content-length')||0);
  if(stated>SOURCE_MAX)throw Error('Original demasiado grande para miniatura');
  const chunks=[];let size=0;
  for await (const chunk of r.body){
    size+=chunk.byteLength;
    if(size>SOURCE_MAX)throw Error('Original supera límite de vista previa');
    chunks.push(Buffer.from(chunk));
  }
  if(size<16)throw Error('Archivo de fotografía vacío');
  return Buffer.concat(chunks,size);
}
async function saveThumbnail(bucket,path,bytes){
  const {base,key}=storageBase();
  const target=base+Thumb.remotePath(bucket,path);
  const response=await fetch(target,{
    method:'POST',
    headers:{...headersFor(key),'Content-Type':'image/webp','cache-control':'3600','x-upsert':'false'},
    body:bytes,signal:AbortSignal.timeout(14000)
  });
  // Dos dispositivos pueden pedir a la vez la misma foto. El segundo upload
  // puede recibir 400/409 porque ya existe; eso no invalida la miniatura.
  if(!response.ok){
    if([400,409].includes(response.status)&&await existsThumbnail(bucket,path))return true;
    const msg=(await response.text()).slice(0,180);
    throw Error('No se pudo guardar la miniatura: '+response.status+' '+msg);
  }
  return true;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function origenStorage(item) {
  const ruta = String(item.storage_path || '');
  let bucket = ruta.startsWith('galeria/') ? 'chat-archivos' : 'media';
  let path = ruta;
  // Si el registro antiguo no guardó storage_path, intentar recuperar la ubicación de url.
  if (!path) {
    const urlBase = new URL(process.env.SUPABASE_URL);
    const u = new URL(item.url || '', urlBase);
    if (u.host !== urlBase.host) throw Error('El enlace no corresponde a Supabase');
    const match = u.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/(media|Media|chat-archivos)\/(.+)$/);
    if (!match) throw Error('No se encontró la ubicación del archivo');
    bucket = match[1];
    path = decodeURIComponent(match[2]);
  }
  if (!['media', 'Media', 'chat-archivos'].includes(bucket) ||
      !/^(?:galeria|fotos)\/[A-Za-z0-9._/-]{1,450}$/.test(path) ||
      path.split('/').some(p => p === '..' || p === '.')) {
    throw Error('Ruta de fotografía no admitida');
  }
  return {bucket, path};
}

function urlFirmada(base, signed) {
  if(typeof signed!=='string') throw Error('Supabase no devolvió un enlace');
  if(signed.startsWith('/storage/v1/')) return base+signed;
  if(signed.startsWith('/object/')) return base+'/storage/v1'+signed;
  if(signed.startsWith('https://')) {
    const target = new URL(signed);
    if(target.origin===base) return signed;
  }
  throw Error('Supabase devolvió un enlace inesperado');
}

module.exports=async function handler(req,res){
  C.noCache(res);
  if(req.method!=='GET') return C.fail(res,405,'Método no permitido.');
  if(!C.isAuthorized(req)) return C.fail(res,401,'Entra a Michi para ver las fotos.');
  const id=req.query.id;
  if(typeof id!=='string'||!UUID.test(id)) return C.fail(res,400,'Fotografía incorrecta.');
  try {
    const fotos=await C.supabaseRequest('/rest/v1/fotos?select=id,storage_path,url&id=eq.'+encodeURIComponent(id)+'&limit=1');
    const foto=Array.isArray(fotos)?fotos[0]:null;
    if(!foto) return C.fail(res,404,'Esta fotografía no está registrada.');
    const {bucket,path}=origenStorage(foto);
    // Las miniaturas quedan guardadas UNA sola vez en el bucket privado.
    // El original y el acceso con sesión permanecen como estaban.
    const mini=req.query.mini==='1';
    const hero=req.query.size==='hero';
    if(!mini){
      res.setHeader('Cache-Control','private, no-store');
      return res.redirect(302,await signedObject(bucket,path));
    }
    const thumbPath=Thumb.pathFor(bucket,path,hero);
    try{
      if(await existsThumbnail(PREVIEW_BUCKET,thumbPath)){
        res.setHeader('Cache-Control','private, max-age=45');
        res.setHeader('Vary','Cookie');
        return res.redirect(302,await signedObject(PREVIEW_BUCKET,thumbPath));
      }
    }catch(existsError){
      // Si la consulta de metadatos falla, reintentamos generar la miniatura
      // sin impedir que el usuario vea la foto.
      console.warn('Consulta de miniatura Michi:',existsError.message);
    }

    const original=await originalBytes(await signedObject(bucket,path));
    const sharp=require('sharp');
    const output=await sharp(original,{limitInputPixels:40000000})
      .rotate()
      .resize(hero?1280:600,hero?720:460,
        {fit:'cover',position:'attention',withoutEnlargement:true})
      .webp({quality:hero?78:70,effort:3}).toBuffer();
    try{
      await saveThumbnail(PREVIEW_BUCKET,thumbPath,output);
    }catch(writeError){
      // Una miniatura nueva sigue siendo útil si falla su persistencia.
      console.warn('No se pudo persistir miniatura Michi:',writeError.message);
    }
    res.setHeader('Content-Type','image/webp');
    res.setHeader('Cache-Control','private, max-age=600');
    res.setHeader('Vary','Cookie');
    res.setHeader('Content-Length',String(output.length));
    return res.status(200).end(output);
  }catch(e){
    console.error('Galería Michi:',e.message);
    if(req.query.mini==='1')return C.fail(res,503,'La miniatura no está disponible. Se puede abrir la fotografía original.');
    return C.fail(res,404,'No se pudo abrir el archivo original de esta foto. Comprueba el bucket y la ruta guardada en Supabase.');
  }
};
