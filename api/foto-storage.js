const C=require('../lib/michi-common');
const crypto=require('node:crypto');
const Thumb=require('../lib/michi-photo-thumbnails');
const BUCKET='chat-archivos';
const PREFIX='galeria/';
module.exports=async function handler(req,res){
 C.noCache(res);
 if(!C.isAdmin(req))return C.fail(res,403,'Acceso de administrador requerido.');
 if(!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
 try{
  if(req.method==='POST'){
   const b=C.jsonBody(req);
   const name=String(b.name||'foto.jpg').slice(0,100).replace(/[^a-zA-Z0-9._-]/g,'_');
   if(!/\.(jpe?g|png|webp|gif)$/i.test(name)||!/^image\/(jpeg|png|webp|gif)$/.test(b.type||''))return C.fail(res,400,'Formato de fotografía no permitido.');
   if(!Number.isFinite(b.size)||b.size>5*1024*1024||b.size<=0)return C.fail(res,400,'Máximo 5 MB.');
   const path=PREFIX+crypto.randomUUID()+'_'+name;
   const d=await C.supabaseRequest('/storage/v1/object/upload/sign/'+BUCKET+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   const token=new URL(d.url,'https://example.com').searchParams.get('token');
   if(!token)return C.fail(res,503,'Error al preparar la foto.');
   return res.status(200).json({path,token});
  }
  if(req.method==='DELETE'){
   const b=C.jsonBody(req);
   const path=b.path;
   if(typeof path!=='string'||!path.startsWith(PREFIX)||!/^[a-zA-Z0-9/._-]+$/.test(path))return C.fail(res,400,'Ruta incorrecta.');
   // Al borrar una fotografía nueva, borrar también sus dos miniaturas.
   // El borrado sucede exclusivamente dentro del mismo bucket privado.
   const previewPaths=[
     Thumb.pathFor(BUCKET,path,false),
     Thumb.pathFor(BUCKET,path,true)
   ];
   await C.supabaseRequest('/storage/v1/object/'+BUCKET,{
     method:'DELETE',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({prefixes:[path,...previewPaths]})
   });
   return res.status(200).json({ok:true});
  }
  return C.fail(res,405,'Método no permitido.');
 }catch(error){console.error('Foto Michi:',error.message);return C.fail(res,503,'No se pudo administrar la fotografía.');}
};
