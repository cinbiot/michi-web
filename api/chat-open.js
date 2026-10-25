const C = require('../lib/michi-common');
module.exports = async function handler(req,res){
  C.noCache(res);
  if(!C.isAuthorized(req))return C.fail(res,401,'Acceso restringido.');
  if(req.method!=='GET')return C.fail(res,405,'Método no permitido.');
  const path=req.query.path;
  if(typeof path!=='string'||!/^chat\/[0-9a-f-]{36}_[a-zA-Z0-9._-]+$/.test(path))return C.fail(res,400,'Archivo incorrecto.');
  try{
    // La dirección se firma cada vez que se abre: no caduca el enlace dentro del chat.
    const info=await C.supabaseRequest('/storage/v1/object/sign/chat-archivos/'+path,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900})
    });
    if(!info?.signedURL)return C.fail(res,404,'Archivo no disponible.');
    const {url}=C.supabaseConfig();
    res.setHeader('Referrer-Policy','no-referrer');
    return res.redirect(302,url+'/storage/v1'+info.signedURL);
  }catch(e){return C.fail(res,404,'No se pudo abrir el archivo.');}
};
