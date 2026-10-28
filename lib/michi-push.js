// Llamado DESPUÉS de guardar correctamente el mensaje.
// Los fallos del servicio Push no impiden enviar mensajes del chat.
const C = require('./michi-common');
const webpush = require('web-push');
function safeHost(host) {
  const h = String(host || '').split(':')[0].toLowerCase();
  return /^[a-z0-9.-]{3,200}$/.test(h) ? h : '';
}
async function notifyRecipient(nombre, id, requestHost) {
  if (!['Michi','Coquito'].includes(nombre)) return;
  const host=safeHost(requestHost);
  const publicKey=process.env.MICHI_VAPID_PUBLIC_KEY;
  const privateKey=process.env.MICHI_VAPID_PRIVATE_KEY;
  if (!host || !publicKey || !privateKey) return;
  webpush.setVapidDetails(process.env.MICHI_VAPID_SUBJECT || 'https://michi-web-neon.vercel.app',publicKey,privateKey);
  const url='/rest/v1/michi_push_suscripciones?select=id,datos&nombre=eq.'+encodeURIComponent(nombre)+
    '&site_host=eq.'+encodeURIComponent(host)+'&order=updated_at.desc&limit=10';
  const subs=await C.supabaseRequest(url);
  const payload=JSON.stringify({nombre: nombre === 'Michi' ? 'Coquito' : 'Michi', id});
  await Promise.allSettled(subs.map(async s=> {
    try {
      await webpush.sendNotification(s.datos,payload,{TTL:120,urgency:'normal',timeout:3500});
    } catch(err) {
      if ([404,410].includes(err.statusCode)) {
        await C.supabaseRequest('/rest/v1/michi_push_suscripciones?id=eq.'+encodeURIComponent(s.id),{method:'DELETE'});
      } else {
        console.error('Notificación Michi no enviada:',err.statusCode || err.message);
      }
    }
  }));
}
module.exports=notifyRecipient;
