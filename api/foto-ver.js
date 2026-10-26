// Proyecto Michi — acceso autenticado a las fotos registradas en la galería.
// Compatible con las fotos antiguas en el bucket "media" y las nuevas en "chat-archivos".
const C = require('../lib/michi-common');
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
    const firmado=await C.supabaseRequest('/storage/v1/object/sign/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120})
    });
    const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
    const target=urlFirmada(base,firmado?.signedURL||firmado?.signedUrl);
    res.setHeader('Cache-Control','private, no-store');
    return res.redirect(302,target);
  }catch(e){
    console.error('Galería Michi:',e.message);
    return C.fail(res,404,'No se pudo abrir el archivo original de esta foto. Comprueba el bucket y la ruta guardada en Supabase.');
  }
};
