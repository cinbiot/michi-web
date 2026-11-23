// Michi · Vista previa privada WebP. Los originales nunca se sustituyen.
// Requiere sesión válida, id registrado y origen Supabase verificado.
const sharp=require('sharp');
const C=require('../lib/michi-common');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES=22*1024*1024;
const MAX_WIDTH=600;
const MAX_HEIGHT=460;
const HERO_WIDTH=1280;
const HERO_HEIGHT=720;

function origenStorage(item) {
  let path=String(item.storage_path||'');
  let bucket=path.startsWith('galeria/')?'chat-archivos':'media';
  if(!path){
    const base=new URL(process.env.SUPABASE_URL);
    const raw=new URL(item.url||'',base);
    if(raw.origin!==base.origin)throw Error('Enlace fuera de Supabase');
    const match=raw.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/(media|Media|chat-archivos)\/(.+)$/);
    if(!match)throw Error('Archivo sin ruta válida');
    bucket=match[1];path=decodeURIComponent(match[2]);
  }
  if(!['media','Media','chat-archivos'].includes(bucket)||
    !/^(?:galeria|fotos)\/[A-Za-z0-9._/-]{1,450}$/.test(path)||
    path.split('/').some(p=>p==='.'||p==='..'))throw Error('Archivo no autorizado');
  return {bucket,path};
}

function signedUrl(base,signed){
  if(typeof signed!=='string')throw Error('Firma inválida');
  let target;
  if(signed.startsWith('/storage/v1/'))target=base+signed;
  else if(signed.startsWith('/object/'))target=base+'/storage/v1'+signed;
  else target=signed;
  const url=new URL(target);
  if(url.origin!==base||url.protocol!=='https:'||
    !url.pathname.startsWith('/storage/v1/object/sign/'))
    throw Error('URL firmada inesperada');
  return url.toString();
}

module.exports=async function handler(req,res){
  C.noCache(res);
  if(req.method!=='GET')return C.fail(res,405,'Método no permitido.');
  if(!C.isAuthorized(req))return C.fail(res,401,'Ingresa para ver nuestros recuerdos.');
  const id=req.query.id;
  if(typeof id!=='string'||!UUID.test(id))return C.fail(res,400,'Fotografía inválida.');
  try{
    const data=await C.supabaseRequest('/rest/v1/fotos?select=id,storage_path,url&id=eq.'+
      encodeURIComponent(id)+'&limit=1');
    const item=Array.isArray(data)?data[0]:null;
    if(!item)return C.fail(res,404,'Fotografía no encontrada.');
    const {bucket,path}=origenStorage(item);
    const signed=await C.supabaseRequest('/storage/v1/object/sign/'+bucket+'/'+
      path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expiresIn:90})
    });
    const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
    const target=signedUrl(base,signed.signedURL||signed.signedUrl);
    const source=await fetch(target,{
      redirect:'error',signal:AbortSignal.timeout(18000),
      headers:{Accept:'image/avif,image/webp,image/*;q=0.8'}
    });
    if(!source.ok||!source.body)throw Error('Foto original inaccesible');
    const reported=Number(source.headers.get('content-length')||0);
    if(reported>MAX_BYTES)throw Error('La foto es demasiado grande para la vista previa');
    const chunks=[];
    let total=0;
    for await(const chunk of source.body){
      total+=chunk.byteLength;
      if(total>MAX_BYTES){
        await source.body.cancel().catch(()=>{});
        throw Error('Foto demasiado grande');
      }
      chunks.push(Buffer.from(chunk));
    }
    if(total<16)throw Error('Fotografía incompleta');
    const input=Buffer.concat(chunks,total);
    const hero=req.query.size==='hero';
    const output=await sharp(input,{limitInputPixels:36000000,failOn:'warning'})
      .rotate().resize(hero?HERO_WIDTH:MAX_WIDTH,hero?HERO_HEIGHT:MAX_HEIGHT,
        {fit:'cover',position:'attention',withoutEnlargement:true})
      .webp({quality:hero?78:70,effort:3}).toBuffer();
    res.setHeader('Content-Type','image/webp');
    res.setHeader('Cache-Control','private, max-age=600');
    res.setHeader('Vary','Cookie');
    res.setHeader('Content-Length',String(output.length));
    return res.status(200).end(output);
  }catch(error){
    console.error('Miniatura Michi:',error.message);
    return C.fail(res,503,'No se pudo preparar la miniatura; la foto original sigue disponible.');
  }
};
