const crypto=require('node:crypto');
const C=require('../lib/michi-common');
module.exports=async function handler(req,res){
 C.noCache(res);
 if(!C.isAuthorized(req))return C.fail(res,401,'Acceso restringido.');
 if(req.method!=='POST')return C.fail(res,405,'Método no permitido.');
 if(!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
 try{
  const body=C.jsonBody(req);
  const name=String(body.name||'archivo').slice(0,140).replace(/[^a-zA-Z0-9._-]/g,'_')||'archivo';
  const size=Number(body.size),type=String(body.type||'application/octet-stream');
  if(!Number.isInteger(size)||size<=0||size>10*1024*1024)return C.fail(res,400,'El archivo no puede superar 10 MB.');
  if(!/^(image\/|audio\/|video\/|application\/pdf$|text\/plain$|application\/vnd.openxmlformats-officedocument\.)/.test(type))return C.fail(res,400,'Tipo de archivo no permitido.');
  const path='chat/'+crypto.randomUUID()+'_'+name;
  const d=await C.supabaseRequest('/storage/v1/object/upload/sign/chat-archivos/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const token=new URL(d.url,'https://michi.example').searchParams.get('token');
  if(!token)throw Error('No se generó el enlace.');
  return res.status(200).json({path,token});
 }catch(_){return C.fail(res,503,'No se pudo preparar la subida. Comprueba el bucket chat-archivos.');}
};
