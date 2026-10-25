const C = require('../lib/michi-common');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = 'id,nombre,contenido,archivo_path,archivo_nombre,archivo_tipo,created_at';

module.exports = async function handler(req, res) {
  C.noCache(res);
  if (!C.isAuthorized(req)) return C.fail(res, 401, 'Introduce el código de acceso para entrar al chat.');
  try {
    if (req.method === 'GET') {
      // No existe fecha de caducidad. Se consultan páginas de mensajes antiguos.
      const limit = 60;
      const cursor = req.query.before;
      if (cursor && (typeof cursor !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(cursor) || Number.isNaN(Date.parse(cursor)))) {
        return C.fail(res, 400, 'Fecha de consulta incorrecta.');
      }
      const extra = cursor ? '&created_at=lt.' + encodeURIComponent(cursor) : '';
      const rows = await C.supabaseRequest('/rest/v1/michi_mensajes?select=' + FIELDS + '&order=created_at.desc,id.desc&limit=' + (limit+1) + extra);
      return res.status(200).json({messages: rows.slice(0,limit).reverse(), hasMore: rows.length>limit});
    }
    if (req.method === 'POST') {
      if (!C.sameOrigin(req)) return C.fail(res, 403, 'Solicitud no permitida.');
      const b = C.jsonBody(req);
      if (!['Michi','Coquito'].includes(b.nombre)) return C.fail(res,400,'Elige quién está escribiendo.');
      const contenido = typeof b.contenido === 'string' ? b.contenido.trim() : '';
      const path = typeof b.archivo_path === 'string' ? b.archivo_path : null;
      if (contenido.length > 4000 || (!contenido && !path) || (path && (path.length > 240 || !/^chat\/[0-9a-f-]{36}_[a-zA-Z0-9._-]+$/.test(path)))) {
        return C.fail(res, 400, 'Mensaje no válido.');
      }
      const message = {
        nombre:b.nombre, contenido:contenido||null, archivo_path:path||null,
        archivo_nombre:typeof b.archivo_nombre==='string'?b.archivo_nombre.slice(0,160):null,
        archivo_tipo:typeof b.archivo_tipo==='string'?b.archivo_tipo.slice(0,80):null
      };
      const records = await C.supabaseRequest('/rest/v1/michi_mensajes',{
        method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(message)
      });
      return res.status(201).json({message:records[0]});
    }
    if (req.method === 'DELETE') {
      if (!C.sameOrigin(req)) return C.fail(res,403,'Solicitud no permitida.');
      const id = req.query.id;
      if (typeof id !== 'string' || !UUID.test(id)) return C.fail(res,400,'Mensaje no válido.');
      const match = await C.supabaseRequest('/rest/v1/michi_mensajes?select=id,archivo_path&id=eq.'+id+'&limit=1');
      if (!match.length) return C.fail(res,404,'El mensaje ya no existe.');
      // Al borrar un mensaje, se elimina para los dos, nunca solo de la pantalla local.
      await C.supabaseRequest('/rest/v1/michi_mensajes?id=eq.'+id,{method:'DELETE'});
      let fileRemoved = true;
      if (match[0].archivo_path) {
        try {
          await C.supabaseRequest('/storage/v1/object/chat-archivos',{
            method:'DELETE',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({prefixes:[match[0].archivo_path]})
          });
        } catch (error) {
          fileRemoved = false;
          console.error('No se pudo borrar el archivo del chat:',error.message);
        }
      }
      return res.status(200).json({deleted:true,fileRemoved});
    }
    return C.fail(res,405,'Método no permitido.');
  } catch (error) {
    console.error('Chat Michi:',error.message);
    return C.fail(res,503,'No se pudo completar la operación. Revisa la configuración de Supabase.');
  }
};
