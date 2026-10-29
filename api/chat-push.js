// Administración privada de notificaciones Push para Michi/Coquito.
const crypto = require('crypto');
const C = require('../lib/michi-common');
const NAMES = ['Michi','Coquito'];
function endpointValid(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length < 20 || endpoint.length > 2048) return false;
  try {
    const u = new URL(endpoint);
    const h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && (
      h === 'fcm.googleapis.com' ||
      h === 'updates.push.services.mozilla.com' ||
      h === 'notify.windows.com' || h.endsWith('.notify.windows.com') ||
      h === 'web.push.apple.com' || h.endsWith('.push.apple.com')
    );
  } catch (_) { return false; }
}
function validSubscription(s) {
  return s && typeof s === 'object' && endpointValid(s.endpoint) &&
    s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' &&
    /^[A-Za-z0-9_-]{70,180}$/.test(s.keys.p256dh) &&
    /^[A-Za-z0-9_-]{12,60}$/.test(s.keys.auth);
}
function requestHost(req) {
  const h = String(req.headers.host || '').split(':')[0].toLowerCase();
  return /^[a-z0-9.-]{3,200}$/.test(h) ? h : null;
}
module.exports = async function handler(req,res) {
  C.noCache(res);
  if (!C.isAuthorized(req)) return C.fail(res,401,'Entra a Michi para activar notificaciones.');
  const publicKey = process.env.MICHI_VAPID_PUBLIC_KEY;
  if (req.method === 'GET') {
    return res.status(200).json({ available: !!(publicKey && process.env.MICHI_VAPID_PRIVATE_KEY), publicKey: publicKey || null });
  }
  if (!C.sameOrigin(req)) return C.fail(res,403,'Solicitud no permitida.');
  if (!['POST','DELETE'].includes(req.method)) return C.fail(res,405,'Método no permitido.');
  const host=requestHost(req);
  if (!host) return C.fail(res,400,'Sitio no válido.');
  const b=C.jsonBody(req);
  try {
    if (req.method === 'POST') {
      if (!NAMES.includes(b.nombre) || !validSubscription(b.subscription))
        return C.fail(res,400,'Suscripción no válida.');
      const data={ endpoint:b.subscription.endpoint, keys:{p256dh:b.subscription.keys.p256dh,auth:b.subscription.keys.auth} };
      const id=crypto.createHash('sha256').update(data.endpoint).digest('hex');
      await C.supabaseRequest('/rest/v1/michi_push_suscripciones?on_conflict=id', {
        method:'POST',
        headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},
        body:JSON.stringify({id,nombre:b.nombre,site_host:host,datos:data,updated_at:new Date().toISOString()})
      });
      return res.status(200).json({ok:true});
    }
    if (!endpointValid(b.endpoint)) return C.fail(res,400,'Suscripción no válida.');
    const id=crypto.createHash('sha256').update(b.endpoint).digest('hex');
    await C.supabaseRequest('/rest/v1/michi_push_suscripciones?id=eq.'+id, {method:'DELETE'});
    return res.status(200).json({ok:true});
  } catch(e) {
    console.error('Registro push Michi:',e.message);
    return C.fail(res,503,'No se pudo guardar el permiso de notificaciones.');
  }
};
