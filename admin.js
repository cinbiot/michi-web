const C=require('../lib/michi-common');
module.exports=async function handler(req,res){
 C.noCache(res);
 if(!C.isAuthorized(req))return C.fail(res,401,'Primero entra con tu código en la página principal.');
 if(req.method==='GET')return res.status(200).json({admin:C.isAdmin(req)});
 if(req.method!=='POST')return C.fail(res,405,'Método no permitido.');
 if(!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
 if(!process.env.MICHI_ADMIN_CODE)return C.fail(res,503,'Falta configurar MICHI_ADMIN_CODE en Vercel.');
 const body=C.jsonBody(req);
 if(!C.safeCompare(body.code,process.env.MICHI_ADMIN_CODE))return C.fail(res,403,'Código de administrador incorrecto.');
 res.setHeader('Set-Cookie',C.cookie('michi_admin',C.token('admin'),7*24*3600));
 return res.status(200).json({admin:true});
};
