const C=require('../lib/michi-common');
module.exports=async function handler(req,res){
 C.noCache(res);
 if(req.method==='GET')return res.status(200).json({authenticated:C.isAuthorized(req)});
 if(req.method==='DELETE'){
  if(!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
  res.setHeader('Set-Cookie',[C.cookie('michi_session','',0),C.cookie('michi_admin','',0)]);
  return res.status(200).json({authenticated:false});
 }
 if(req.method!=='POST')return C.fail(res,405,'Método no permitido.');
 if(!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
 const conf=C.config();
 if(!conf.code||!conf.secret||conf.secret.length<32)return C.fail(res,503,'Falta configurar el acceso en Vercel.');
 let body;try{body=C.jsonBody(req);}catch(_){return C.fail(res,400,'Solicitud incorrecta.');}
 if(!C.safeCompare(body.code,conf.code))return C.fail(res,401,'Código incorrecto.');
 res.setHeader('Set-Cookie',C.cookie('michi_session',C.token('access'),7*24*3600));
 return res.status(200).json({authenticated:true});
};
