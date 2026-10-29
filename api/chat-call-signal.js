// Señales WebRTC efímeras. Nunca se entregan por accesos públicos a Supabase.
const C = require('../lib/michi-common');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requestHost(req){const h=String(req.headers.host||'').split(':')[0].toLowerCase();return /^[a-z0-9.-]{3,200}$/.test(h)?h:'';}
async function existing(id,host){const rows=await C.supabaseRequest('/rest/v1/michi_llamadas?select=origen,destino,estado,expira_en&id=eq.'+id+'&site_host=eq.'+encodeURIComponent(host)+'&limit=1');return rows?.[0]||null;}
module.exports=async function handler(req,res){
 C.noCache(res);
 if(!C.isAuthorized(req))return C.fail(res,401,'Inicia sesión en Michi.');
 const host=requestHost(req),id=req.method==='GET'?req.query.id:C.jsonBody(req)?.id;
 const name=req.method==='GET'?req.query.nombre:C.jsonBody(req)?.nombre;
 if(!host||typeof id!=='string'||!UUID.test(id)||!['Michi','Coquito'].includes(name))return C.fail(res,400,'Solicitud de llamada no válida.');
 if(!['GET','POST'].includes(req.method))return C.fail(res,405,'Método no permitido.');
 if(req.method==='POST'&&!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
 try{
  const call=await existing(id,host);
  if(!call||![call.origen,call.destino].includes(name)||!['sonando','aceptada'].includes(call.estado)||Date.parse(call.expira_en)<=Date.now())
    return C.fail(res,409,'La llamada ya no está activa.');
  if(req.method==='GET'){
    const after=Number(req.query.after||0);
    if(!Number.isSafeInteger(after)||after<0)return C.fail(res,400,'Cursor incorrecto.');
    const rows=await C.supabaseRequest('/rest/v1/michi_llamada_senales?select=id,origen,tipo,datos&llamada_id=eq.'+id+
      '&id=gt.'+after+'&order=id.asc&limit=60');
    return res.status(200).json({signals:rows||[]});
  }
  const b=C.jsonBody(req);
  if(!['offer','answer','candidate'].includes(b.tipo)||!b.datos||typeof b.datos!=='object'||Array.isArray(b.datos))
    return C.fail(res,400,'Señal de llamada incorrecta.');
  if(b.tipo==='offer'&&(name!==call.origen||call.estado!=='sonando'))return C.fail(res,409,'No corresponde enviar esta oferta.');
  if(b.tipo==='answer'&&(name!==call.destino||call.estado!=='aceptada'))return C.fail(res,409,'No corresponde responder a esta oferta.');
  const encoded=JSON.stringify(b.datos);
  if(encoded.length>(b.tipo==='candidate'?4500:50000)||encoded.length<2)
    return C.fail(res,413,'Señal de llamada demasiado grande.');
  if((b.tipo==='offer'||b.tipo==='answer')&&
     (b.datos.type!==b.tipo||typeof b.datos.sdp!=='string'||b.datos.sdp.length>45000))
    return C.fail(res,400,'Descripción WebRTC inválida.');
  if(b.tipo==='candidate'&&(typeof b.datos.candidate!=='string'||b.datos.candidate.length>3500))
    return C.fail(res,400,'Candidato WebRTC inválido.');
  await C.supabaseRequest('/rest/v1/michi_llamada_senales',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({llamada_id:id,origen:name,tipo:b.tipo,datos:b.datos})
  });
  return res.status(201).json({ok:true});
 }catch(e){console.error('Señales WebRTC V10:',e.message);return C.fail(res,503,'No se pudo intercambiar la conexión.');}
};
