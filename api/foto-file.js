const C=require('../lib/michi-common');
module.exports=async function handler(req,res){
 C.noCache(res);
 if(!C.isAuthorized(req))return C.fail(res,401,'Acceso restringido.');
 const path=req.query.path;
 if(req.method!=='GET')return C.fail(res,405,'Método no permitido.');
 if(typeof path!=='string'||!/^galeria\/[a-f0-9-]{36}_[A-Za-z0-9._-]+$/.test(path))return C.fail(res,400,'Archivo incorrecto.');
 try{
  const data=await C.supabaseRequest('/storage/v1/object/sign/chat-archivos/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});
  if(!data?.signedURL)return C.fail(res,404,'Imagen no encontrada.');
  const url=process.env.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1'+data.signedURL;
  res.setHeader('Cache-Control','no-store');
  return res.redirect(302,url);
 }catch(error){return C.fail(res,404,'No se pudo abrir la imagen.');}
};
