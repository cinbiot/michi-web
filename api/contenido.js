const C = require('../lib/michi-common');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLES = new Set(['carta','sorpresas','fotos','videos']);
const STRING_FIELDS = {
  carta: {titulo:500,contenido:40000,firma:500},
  sorpresas: {titulo:500,descripcion:4000,emoji:16,url:2000},
  fotos: {url:2048,storage_path:500,descripcion:2000},
  videos: {url:2000,descripcion:4000}
};
function validatedInsert(table, body) {
  if(!body || typeof body!=='object' || Array.isArray(body))throw Error('Datos incorrectos.');
  const out={};
  for(const [key,max] of Object.entries(STRING_FIELDS[table])) {
    if(body[key]!==undefined && body[key]!==null){
      if(typeof body[key]!=='string'||body[key].length>max)throw Error('Campo inválido: '+key);
      out[key]=body[key];
    }
  }
  if(table==='sorpresas'){
    out.vista=false;
    if(!out.titulo?.trim())throw Error('La sorpresa necesita un título.');
    if(out.url && !/^https?:\/\//i.test(out.url))throw Error('El enlace debe comenzar por https://');
  }
  if(table==='videos'&&(!out.url||!/^https?:\/\//i.test(out.url)))throw Error('Enlace de video incorrecto.');
  if(table==='carta' && !out.contenido?.trim())throw Error('La carta no puede estar vacía.');
  if(table==='fotos' && (!out.url||!out.storage_path))throw Error('Fotografía incorrecta.');
  return out;
}
module.exports=async function handler(req,res){
  C.noCache(res);
  if(!C.isAuthorized(req))return C.fail(res,401,'Primero ingresa con michicoco.');
  const table=req.method==='GET'?req.query.tabla:C.jsonBody(req).tabla;
  if(typeof table!=='string'||!TABLES.has(table))return C.fail(res,400,'Tabla no permitida.');
  try{
    if(req.method==='GET'){
      const q=new URLSearchParams({select:'*',order:'created_at.desc',limit:'1000'});
      const eqKey=req.query.eq;
      if(eqKey==='vista'){
        if(table!=='sorpresas'||!['true','false'].includes(req.query.valor))return C.fail(res,400,'Filtro incorrecto.');
        q.set('vista','eq.'+req.query.valor);
      }else if(eqKey==='id'){
        if(!UUID.test(req.query.valor||''))return C.fail(res,400,'Identificador incorrecto.');
        q.set('id','eq.'+req.query.valor);
      }else if(eqKey)return C.fail(res,400,'Filtro incorrecto.');
      const limit=Number(req.query.limite);
      if(Number.isInteger(limit)&&limit>=1&&limit<=1000)q.set('limit',String(limit));
      const data=await C.supabaseRequest('/rest/v1/'+table+'?'+q.toString());
      return res.status(200).json({data});
    }
    if(!['POST','DELETE'].includes(req.method))return C.fail(res,405,'Método no permitido.');
    if(!C.sameOrigin(req))return C.fail(res,403,'Solicitud no permitida.');
    const b=C.jsonBody(req), action=b.action;
    if(action==='marcar_vista'){
      if(table!=='sorpresas'||!UUID.test(b.id||''))return C.fail(res,400,'Sorpresa incorrecta.');
      await C.supabaseRequest('/rest/v1/sorpresas?id=eq.'+b.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({vista:true})});
      return res.status(200).json({data:null});
    }
    if(!C.isAdmin(req))return C.fail(res,403,'Se requiere el acceso de administrador.');
    if(action==='insertar'){
      const payload=validatedInsert(table,b.datos);
      const rows=await C.supabaseRequest('/rest/v1/'+table,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});
      return res.status(201).json({data:rows});
    }
    if(action==='eliminar'){
      if(!UUID.test(b.id||''))return C.fail(res,400,'Identificador incorrecto.');
      await C.supabaseRequest('/rest/v1/'+table+'?id=eq.'+b.id,{method:'DELETE'});
      return res.status(200).json({data:null});
    }
    return C.fail(res,400,'Operación incorrecta.');
  }catch(err){
    console.error('Contenido Michi:',err.message);
    if(/^Campo inválido|incorrect|no puede|necesita|debe comenzar|enlace/i.test(err.message))return C.fail(res,400,err.message);
    return C.fail(res,503,'No se pudo cargar o guardar el contenido.');
  }
};
