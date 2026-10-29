const C = require('../lib/michi-common');

module.exports = async function handler(req, res) {
  C.noCache(res);
  if (!C.isAuthorized(req)) return C.fail(res, 401, 'Acceso restringido.');
  if (req.method !== 'GET') return C.fail(res, 405, 'Método no permitido.');
  const path = req.query.path;
  if (typeof path !== 'string' || !/^chat\/[0-9a-f-]{36}_[a-zA-Z0-9._-]+$/.test(path)) {
    return C.fail(res, 400, 'Archivo incorrecto.');
  }
  try {
    const info = await C.supabaseRequest(
      '/storage/v1/object/sign/chat-archivos/' + path,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({expiresIn: 900})}
    );
    const signed = info?.signedURL || info?.signedUrl;
    const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
    if (!/^https:\/\/[^/]+$/i.test(base) || typeof signed !== 'string') {
      throw new Error('Enlace temporal no disponible.');
    }
    let url;
    if (signed.startsWith('/object/sign/chat-archivos/')) {
      url = base + '/storage/v1' + signed;
    } else if (signed.startsWith('/storage/v1/object/sign/chat-archivos/')) {
      url = base + signed;
    } else {
      throw new Error('Enlace de archivo inesperado.');
    }
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(302, url);
  } catch (e) {
    console.error('Michi adjuntos:', e.message);
    return C.fail(res, 404, 'No se pudo abrir el archivo.');
  }
};
