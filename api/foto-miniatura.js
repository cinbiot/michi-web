// Michi · URLs temporales de miniaturas privadas.
// No expone buckets ni objetos sin sesión: solo firma el identificador registrado.
// Si las transformaciones no están habilitadas en Supabase, el cliente vuelve
// automáticamente a /api/foto-ver, conservando el original.
const C=require('../lib/michi-common');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function origenStorage(item){
  let path=String(item.storage_path||'');
  let bucket=path.startsWith('galeria/')?'chat-archivos':'media';
  if(!path){
    const base=new URL(process.env.SUPABASE_URL);
    const target=new URL(item.url||'',base);
    if(target.origin!==base.origin)throw Error('Enlace externo');
    const match=target.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/(media|Media|chat-archivos)\/(.+)$/);
    if(!match)throw Error('Ruta no admitida');
    bucket=match[1];path=decodeURIComponent(match[2]);
  }
  if(!['media','Media','chat-archivos'].includes(bucket)||
    !/^(?:galeria|fotos)\/[A-Za-z0-9._/-]{1,450}$/.test(path)||
    path.split('/').some(p=>p==='.'||p==='..'))throw Error('Ruta no permitida');
  return {bucket,path};
}
function firmada(base,value){
  if(typeof value!=='string')throw Error('Firma no disponible');
  let target=value.startsWith('/storage/v1/')?base+value:
    value.startsWith('/object/')?base+'/storage/v1'+value:value;
  const url=new URL(target);
  if(url.origin!==base||url.protocol!=='https:'||
    !/^\/storage\/v1\/(?:render\/image\/sign|object\/sign)\//.test(url.pathname))
    throw Error('Firma no confiable');
  return url.toString();
}
module.exports=async function handler(req,res){
  C.noCache(res);
  if(req.method!=='GET')return C.fail(res,405,'Método no permitido');
  if(!C.isAuthorized(req))return C.fail(res,401,'Entra para ver nuestras fotos');
  const id=req.query.id;
  if(typeof id!=='string'||!UUID.test(id))return C.fail(res,400,'Foto incorrecta');
  try{
    const data=await C.supabaseRequest('/rest/v1/fotos?select=id,storage_path,url&id=eq.'+
      encodeURIComponent(id)+'&limit=1');
    const item=Array.isArray(data)?data[0]:null;
    if(!item)return C.fail(res,404,'Foto no registrada');
    const {bucket,path}=origenStorage(item);
    const hero=req.query.size==='hero';
    const transform=hero?
      {width:1280,height:720,resize:'cover',quality:78}:
      {width:600,height:460,resize:'cover',quality:70};
    const result=await C.supabaseRequest('/storage/v1/object/sign/'+bucket+'/'+
      path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expiresIn:120,transform})
    });
    const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
    let signed=firmada(base,result.signedURL||result.signedUrl);
    // Supabase firma la transformación dentro del token. Si devuelve object/sign,
    // usar la ruta de render con el mismo token (transformación firmada).
    const url=new URL(signed);
    if(url.pathname.startsWith('/storage/v1/object/sign/')){
      url.pathname=url.pathname.replace('/storage/v1/object/sign/','/storage/v1/render/image/sign/');
      signed=url.toString();
    }
    res.setHeader('Cache-Control','private, max-age=120');
    res.setHeader('Vary','Cookie');
    return res.redirect(302,signed);
  }catch(error){
    console.error('Miniatura Michi:',error.message);
    return C.fail(res,503,'No se pudo generar la miniatura. Usa el visor de la fotografía original.');
  }
};
