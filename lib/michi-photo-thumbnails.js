// Michi: rutas persistentes de vistas previas, sin tablas ni buckets públicos.
const crypto=require('node:crypto');

function pathFor(bucket,originalPath,hero=false){
  if(!['media','Media','chat-archivos'].includes(bucket)||
     typeof originalPath!=='string'||!originalPath||
     !/^(?:galeria|fotos)\/[A-Za-z0-9._/-]{1,450}$/.test(originalPath)||
     originalPath.split('/').some(part=>part==='.'||part==='..')){
    throw new Error('Ruta de fotografía no autorizada');
  }
  const hash=crypto.createHash('sha256')
    .update(bucket+'\u0000'+originalPath).digest('hex');
  return 'galeria/miniaturas/'+hash+(hero?'_hero':'_card')+'.webp';
}
function remotePath(bucket,path){
  return '/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/');
}
module.exports={pathFor,remotePath};
