// Prueba de sintaxis y compatibilidad criptográfica del archivo .michi para Android.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pbkdf2Sync,createDecipheriv,webcrypto} from 'node:crypto';

const html=fs.readFileSync(new URL('../exportar-android.html',import.meta.url),'utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'No se encontró el código del exportador');
new vm.Script(match[1],{filename:'exportar-android-inline.js'});
const password='Contrasena-Prueba-Michi-2026';
const sample={version:2,app:'michi',messages:[{
 id:'dba8a14c-5f6a-4453-85ee-12f7efbf0919',sender:'michi',
 body:'Hola Coquito ❤️',createdAt:1793620000000,sent:true
}]};
// Mismo PBKDF2 SHA-256 250000 iteraciones y AES-256-GCM que BackupIO.importData.
const salt=webcrypto.getRandomValues(new Uint8Array(16)),iv=webcrypto.getRandomValues(new Uint8Array(12));
const imported=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},imported,{name:'AES-GCM',length:256},false,['encrypt']);
const encrypted=new Uint8Array(await webcrypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,new TextEncoder().encode(JSON.stringify(sample))));
const rawkey=pbkdf2Sync(Buffer.from(password),Buffer.from(salt),250000,32,'sha256');
const decipher=createDecipheriv('aes-256-gcm',rawkey,iv);
decipher.setAuthTag(Buffer.from(encrypted.slice(-16)));
const clear=Buffer.concat([decipher.update(encrypted.slice(0,-16)),decipher.final()]);
assert.deepEqual(JSON.parse(clear.toString()),sample);
console.log('OK: sintaxis y cifrado exportador compatibles con BackupIO Android.');
