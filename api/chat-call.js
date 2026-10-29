// Michi V10: gestion de llamadas; cookies firmadas y Supabase via service role.
const C = require('../lib/michi-common');
const notifyCall = require('../lib/michi-call-push');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAMES = ['Michi', 'Coquito'];
const FIELDS = 'id,site_host,origen,destino,modo,estado,creada_en,expira_en';
function hostFor(req) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  return /^[a-z0-9.-]{3,200}$/.test(host) ? host : null;
}
function other(name) { return name === 'Michi' ? 'Coquito' : 'Michi'; }
function activeQuery(host) {
  return '/rest/v1/michi_llamadas?select=' + FIELDS +
    '&site_host=eq.' + encodeURIComponent(host) +
    '&estado=in.(sonando,aceptada)&order=creada_en.desc&limit=1';
}
async function purgeSignals(id) {
  try { await C.supabaseRequest('/rest/v1/michi_llamada_senales?llamada_id=eq.'+id,{method:'DELETE'}); }
  catch(e){ console.error('Limpieza señales:',e.message); }
}
async function activeCall(host) {
  const rows = await C.supabaseRequest(activeQuery(host));
  const call = rows?.[0] || null;
  if (!call) return null;
  if (Date.parse(call.expira_en) <= Date.now()) {
    await C.supabaseRequest('/rest/v1/michi_llamadas?id=eq.'+call.id+'&estado=in.(sonando,aceptada)', {
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({estado:'finalizada',actualizada_en:new Date().toISOString()})
    });
    await purgeSignals(call.id);
    return null;
  }
  return call;
}
async function callById(id, host) {
  const rows = await C.supabaseRequest('/rest/v1/michi_llamadas?select='+FIELDS+
    '&id=eq.'+id+'&site_host=eq.'+encodeURIComponent(host)+'&limit=1');
  return rows?.[0] || null;
}
function respondCall(res, call) {
  return res.status(200).json({call:call ? {
    id:call.id, origen:call.origen,destino:call.destino,modo:call.modo,
    estado:call.estado,creada_en:call.creada_en,expira_en:call.expira_en
  } : null});
}
module.exports = async function handler(req,res) {
  C.noCache(res);
  if (!C.isAuthorized(req)) return C.fail(res,401,'Entra a Michi para utilizar las llamadas.');
  const host = hostFor(req);
  if (!host) return C.fail(res,400,'Dominio incorrecto.');
  if (req.method === 'GET') {
    if (!NAMES.includes(req.query.nombre)) return C.fail(res,400,'Selecciona Michi o Coquito.');
    try { return respondCall(res,await activeCall(host)); }
    catch(e) {console.error('Llamadas V10 GET:',e.message);return C.fail(res,503,'No se pudo comprobar la llamada.');}
  }
  if (req.method !== 'POST') return C.fail(res,405,'Método no permitido.');
  if (!C.sameOrigin(req)) return C.fail(res,403,'Solicitud no permitida.');
  const b = C.jsonBody(req);
  if (!b || !NAMES.includes(b.nombre)) return C.fail(res,400,'Selecciona tu nombre primero.');
  try {
    if (b.accion === 'iniciar') {
      if (!['voz','video'].includes(b.modo)) return C.fail(res,400,'Tipo de llamada no válido.');
      if (await activeCall(host)) return C.fail(res,409,'Ya existe una llamada en curso.');
      const expira = new Date(Date.now()+120000).toISOString();
      const rows = await C.supabaseRequest('/rest/v1/michi_llamadas',{
        method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({site_host:host,origen:b.nombre,destino:other(b.nombre),modo:b.modo,
          estado:'sonando',expira_en:expira})
      });
      const call = rows?.[0];
      if (!call) return C.fail(res,503,'No se pudo crear la llamada.');
      try {await notifyCall(other(b.nombre),b.nombre,b.modo,call.id,host);} catch(err){console.error('Push llamada:',err.message);}
      return respondCall(res,call);
    }
    if (!['aceptar','rechazar','colgar'].includes(b.accion) ||
        typeof b.id !== 'string' || !UUID.test(b.id)) return C.fail(res,400,'Operación de llamada no válida.');
    const call = await callById(b.id,host);
    if (!call || ![call.origen,call.destino].includes(b.nombre)) return C.fail(res,404,'Llamada no encontrada.');
    if (!['sonando','aceptada'].includes(call.estado) || Date.parse(call.expira_en)<=Date.now())
      return C.fail(res,409,'La llamada ya terminó.');
    if (b.accion === 'aceptar' && (b.nombre !== call.destino || call.estado !== 'sonando'))
      return C.fail(res,409,'La llamada no puede aceptarse.');
    if (b.accion === 'rechazar' && (b.nombre !== call.destino || call.estado !== 'sonando'))
      return C.fail(res,409,'La llamada no puede rechazarse.');
    const state = b.accion==='aceptar'?'aceptada':b.accion==='rechazar'?'rechazada':'finalizada';
    const old = b.accion === 'aceptar' || b.accion === 'rechazar' ? 'sonando' : call.estado;
    const rows = await C.supabaseRequest('/rest/v1/michi_llamadas?id=eq.'+b.id+'&estado=eq.'+old+
      '&site_host=eq.'+encodeURIComponent(host),{
      method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({estado:state,actualizada_en:new Date().toISOString(),
        ...(state==='aceptada'?{expira_en:new Date(Date.now()+3*60*60*1000).toISOString()}:{})})
    });
    if (!rows?.length) return C.fail(res,409,'La llamada cambió de estado.');
    if(state==='rechazada'||state==='finalizada')await purgeSignals(call.id);
    return respondCall(res,rows[0]);
  } catch(e) {
    console.error('Llamadas V10 POST:',e.message);
    return C.fail(res,503,'No fue posible completar la operación de llamada.');
  }
};
