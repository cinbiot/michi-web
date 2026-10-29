// Aviso de llamada entrante a los dispositivos ya suscritos en la V9.
// No incluye contenido de chat; el destinatario debe abrir Michi para contestar.
const C = require('./michi-common');
const webpush = require('web-push');
module.exports=async function notifyCall(destino,origen,modo,id,host){
 if(!['Michi','Coquito'].includes(destino)||!['Michi','Coquito'].includes(origen))return;
 const publicKey=process.env.MICHI_VAPID_PUBLIC_KEY,privateKey=process.env.MICHI_VAPID_PRIVATE_KEY;
 if(!publicKey||!privateKey)return;
 webpush.setVapidDetails(process.env.MICHI_VAPID_SUBJECT||'https://michi-web-neon.vercel.app',publicKey,privateKey);
 const rows=await C.supabaseRequest('/rest/v1/michi_push_suscripciones?select=id,datos&nombre=eq.'+encodeURIComponent(destino)+
  '&site_host=eq.'+encodeURIComponent(host)+'&limit=10');
 const payload=JSON.stringify({tipo:'llamada',nombre:origen,modo,id});
 await Promise.allSettled((rows||[]).map(async row=>{
  try{await webpush.sendNotification(row.datos,payload,{TTL:90,urgency:'high',timeout:3500});}
  catch(e){if([404,410].includes(e.statusCode)){
   try{await C.supabaseRequest('/rest/v1/michi_push_suscripciones?id=eq.'+encodeURIComponent(row.id),{method:'DELETE'});}catch(_){}
  }else console.error('Notificación de llamada V10:',e.statusCode||e.message);}
 }));
};
