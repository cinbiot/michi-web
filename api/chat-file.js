const C=require('../lib/michi-common');
module.exports=async function handler(req,res){
 C.noCache(res);
 if(!C.isAuthorized(req))return C.fail(res,401,'Acceso restringido.');
 if(req.method!=='GET')return C.fail(res,405,'Método no permitido.');
 const path=req.query.path;
 if(typeof path!=='string'||!/^chat\/[0-9a-f-]{36}_[a-zA-Z0-9._-]+$/.test(path))return C.fail(res,400,'Archivo incorrecto.');
 try{
  const data=await C.supabaseRequest('/storage/v1/object/sign/chat-archivos/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900})});
  const {url}=C.supabaseConfig();
  if(!data?.signedURL)return C.fail(res,404,'Archivo no disponible.');
  return res.status(200).json({url:url+'/storage/v1'+data.signedURL});
 }catch(e){return C.fail(res,404,'No se pudo abrir el archivo.');}
};
