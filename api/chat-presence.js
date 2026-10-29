const C = require('../lib/michi-common');
const NAMES = ['Michi', 'Coquito'];
module.exports = async function handler(req, res) {
  C.noCache(res);
  if (!C.isAuthorized(req)) return C.fail(res, 401, 'Primero entra a Michi.');
  try {
    if (req.method === 'GET') {
      const rows = await C.supabaseRequest('/rest/v1/michi_presencia?select=nombre,escribiendo_hasta');
      return res.status(200).json({ escribiendo: rows.filter(x => Date.parse(x.escribiendo_hasta) > Date.now()).map(x => x.nombre) });
    }
    if (req.method === 'POST') {
      if (!C.sameOrigin(req)) return C.fail(res, 403, 'Solicitud no permitida.');
      const b = C.jsonBody(req);
      if (!NAMES.includes(b.nombre) || typeof b.escribiendo !== 'boolean') return C.fail(res, 400, 'Identidad o estado no válido.');
      const rows = await C.supabaseRequest('/rest/v1/michi_presencia?on_conflict=nombre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ nombre: b.nombre, escribiendo_hasta: new Date(Date.now() + (b.escribiendo ? 7000 : -1000)).toISOString(), updated_at: new Date().toISOString() })
      });
      return res.status(200).json({ ok: !!rows?.[0] });
    }
    return C.fail(res, 405, 'Método no permitido.');
  } catch (e) {
    console.error('Michi presencia:', e.message);
    return C.fail(res, 503, 'No se pudo actualizar el indicador de escritura.');
  }
};
