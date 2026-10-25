const crypto=require('node:crypto');
const TTL=7*24*3600;
function fail(res,status,error){return res.status(status).json({error});}
function noCache(res){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');}
function config(){return {code:process.env.MICHI_ACCESS_CODE,secret:process.env.MICHI_SESSION_SECRET,supabase:process.env.SUPABASE_URL,service:process.env.SUPABASE_SERVICE_ROLE_KEY};}
function safeCompare(x,y){if(typeof x!=='string'||typeof y!=='string')return false;const a=crypto.createHash('sha256').update(x).digest();const b=crypto.createHash('sha256').update(y).digest();return crypto.timingSafeEqual(a,b);}
function signature(payload){const secret=process.env.MICHI_SESSION_SECRET;if(!secret||secret.length<32)throw new Error('MICHI_SESSION_SECRET debe tener al menos 32 caracteres');return crypto.createHmac('sha256',secret).update(payload).digest('base64url');}
function token(role){const payload=Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+TTL})).toString('base64url');return payload+'.'+signature(payload);}
function readCookie(req,name){const found=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return found?decodeURIComponent(found.substring(name.length+1)):'';}
function validToken(raw,role){try{const [payload,sig]=raw.split('.');if(!payload||!sig||!safeCompare(sig,signature(payload)))return false;const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.role===role && Number.isInteger(data.exp)&&data.exp>Math.floor(Date.now()/1000);}catch(_){return false;}}
function isAuthorized(req){return validToken(readCookie(req,'michi_session'),'access');}
function isAdmin(req){return isAuthorized(req)&&validToken(readCookie(req,'michi_admin'),'admin');}
function cookie(name,value,age){const secure='Secure; ';return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=${age}`;}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch(_){return false;}}
function jsonBody(req){return req.body&&typeof req.body==='object'?req.body:JSON.parse(req.body||'{}');}
function supabaseConfig(){const {supabase,service}=config();if(!supabase||!service)throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel');return {url:supabase.replace(/\/$/,''),key:service};}
async function supabaseRequest(path,options={}){
 const {url,key}=supabaseConfig();
 const r=await fetch(url+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,...options.headers}});
 const txt=await r.text();let data;try{data=txt?JSON.parse(txt):null;}catch(_){data={error:txt.slice(0,400)};}
 if(!r.ok)throw new Error(data?.message||data?.error||`Supabase respondió ${r.status}`);
 return data;
}
module.exports={fail,noCache,config,safeCompare,token,readCookie,validToken,isAuthorized,isAdmin,cookie,sameOrigin,jsonBody,supabaseRequest};
