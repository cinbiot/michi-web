/* Proyecto Michi V10. Llamadas de voz y video mediante WebRTC.
   Señalización privada: rutas internas de /api/chat-push (límite Hobby).
   Los videos NO se almacenan; se transmiten entre los navegadores. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const overlay = $('call-overlay');
 const statusEl = $('call-status');
 const callTitle = $('call-title');
 const incomingActions = $('call-incoming-actions');
 const activeActions = $('call-active-actions');
 const localVideo = $('call-local');
 const remoteVideo = $('call-remote');
 const remoteAudio = $('call-audio');
 let current = null, incoming = null, peer = null, localStream = null;
 let remoteStream = null, incomingOfferSeen = false, signalCursor = 0;
 let pendingCandidates = [], inFlight = false, pollBusy = false, lastCheck = 0;
 let mediaBusy = false, muted = false, cameraOff = false;
 const NAME = () => (typeof myName === 'string' && ['Michi','Coquito'].includes(myName)) ? myName : null;
 const OTHER = () => NAME() === 'Michi' ? 'Coquito' : 'Michi';
 function note(txt) { if (statusEl) statusEl.textContent = txt; }
 function failMessage(e) {return e?.message || 'No se pudo completar la llamada.';}
 async function request(url,opt){return api(url,opt);}
 async function action(accion,data={}){
  return request('/api/chat-push?michiRoute=call',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({accion,nombre:NAME(),...data})});
 }
 async function sendSignal(tipo,datos){
  if(!current)return;
  const id=current.id;
  return request('/api/chat-push?michiRoute=signal',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id,nombre:NAME(),tipo,datos})});
 }
 function toggleOverlay(show){
  overlay.hidden=!show;
  document.body.classList.toggle('call-open',show);
 }
 function showIncoming(c){
  incoming=c;
  callTitle.textContent=(c.origen||'Tu persona especial')+' '+(c.modo==='video'?'📹 Videollamada':'📞 Llamada de voz');
  note('Te está llamando…');
  incomingActions.hidden=false;activeActions.hidden=true;
  $('call-video-area').hidden=true;
  toggleOverlay(true);
 }
 function showActive(c,callStatus){
  callTitle.textContent=(c.origen===NAME()?c.destino:c.origen)+(c.modo==='video'?' 📹':' 📞');
  incomingActions.hidden=true;activeActions.hidden=false;
  $('call-video-area').hidden=false;
  $('call-video-area').classList.toggle('voice-only',c.modo==='voz');
  $('call-camera').hidden=c.modo==='voz';
  muted=false;cameraOff=false;
  $('call-mute').textContent='🎙 Silenciar';
  $('call-camera').textContent='📷 Apagar cámara';
  note(callStatus||'Conectando…');
  toggleOverlay(true);
 }
 function stopMedia(){
  if(peer){try{peer.ontrack=null;peer.onicecandidate=null;peer.close();}catch(_){}peer=null;}
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  if(remoteStream){remoteStream.getTracks().forEach(t=>t.stop());remoteStream=null;}
  localVideo.srcObject=null;remoteVideo.srcObject=null;remoteAudio.srcObject=null;
  pendingCandidates=[];signalCursor=0;incomingOfferSeen=false;
 }
 function clearCall(message){
  stopMedia();current=null;incoming=null;
  toggleOverlay(false);
  if(message && typeof setStatus==='function')setStatus(message);
 }
 function pcInit(){
  if(peer)return;
  // STUN sirve para descubrir direcciones; algunas redes necesitaran TURN adicional.
  peer=new RTCPeerConnection({iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'}
  ]});
  remoteStream=new MediaStream();
  remoteVideo.srcObject=remoteStream;
  remoteAudio.srcObject=remoteStream;
  for(const track of localStream.getTracks())peer.addTrack(track,localStream);
  peer.ontrack=e=>{
    const stream=e.streams?.[0];
    const tracks=stream?stream.getTracks():[e.track];
    for(const t of tracks){if(!remoteStream.getTracks().some(x=>x.id===t.id))remoteStream.addTrack(t);}
    const player=current?.modo==='video'?remoteVideo:remoteAudio;
    player.play().catch(()=>note('Pulsa «Activar sonido» si no escuchas a la otra persona.'));
  };
  peer.onicecandidate=e=>{
    if(e.candidate&&current){sendSignal('candidate',e.candidate.toJSON()).catch(err=>console.warn('Michi ICE:',err.message));}
  };
  peer.onconnectionstatechange=()=>{
    if(!peer)return;
    if(peer.connectionState==='connected')note('Conectados ❤️');
    if(peer.connectionState==='disconnected')note('Reconectando…');
    if(peer.connectionState==='failed')note('La red bloqueó la conexión. Puede ser necesario un servidor TURN.');
  };
 }
 async function captureMedia(mode){
  if(!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection==='undefined')
    throw new Error('Este navegador no admite llamadas por WebRTC. Prueba Chrome actualizado.');
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},
    video:mode==='video'?{facingMode:'user',width:{ideal:640},height:{ideal:480}}:false});
 }
 async function initiate(mode){
  if(mediaBusy||current||incoming)return;
  if(!NAME())return setStatus('Primero selecciona Michi o Coquito.');
  mediaBusy=true;
  $('call-voice-btn').disabled=true;$('call-video-btn').disabled=true;
  let saved=false;
  try{
    localStream=await captureMedia(mode);
    const r=await action('iniciar',{modo:mode});
    current=r.call;saved=true;
    if(!current)throw new Error('No se pudo iniciar la llamada.');
    pcInit();showActive(current,'Llamando a '+OTHER()+'…');
    if(mode==='video'){
      localVideo.srcObject=localStream;
      localVideo.play().catch(()=>{});
    }
    const offer=await peer.createOffer();
    await peer.setLocalDescription(offer);
    await sendSignal('offer',peer.localDescription.toJSON());
    lastCheck=0;
  }catch(err){
    if(saved&&current){action('colgar',{id:current.id}).catch(()=>{});}
    clearCall('Llamada: '+failMessage(err));
  }finally{mediaBusy=false;$('call-voice-btn').disabled=false;$('call-video-btn').disabled=false;}
 }
 async function acceptCall(){
  if(mediaBusy||!incoming)return;
  mediaBusy=true;
  const call=incoming;
  $('call-accept').disabled=true;
  try{
    localStream=await captureMedia(call.modo);
    const r=await action('aceptar',{id:call.id});
    current=r.call;incoming=null;
    if(!current)throw new Error('La llamada ya no está disponible.');
    pcInit();showActive(current,'Conectando con '+current.origen+'…');
    if(current.modo==='video'){localVideo.srcObject=localStream;localVideo.play().catch(()=>{});}
    lastCheck=0;
  }catch(e){
    if(incoming && !current){action('rechazar',{id:incoming.id}).catch(()=>{});}
    clearCall('No fue posible contestar: '+failMessage(e));
  }finally{mediaBusy=false;$('call-accept').disabled=false;}
 }
 async function declineCall(){
  if(!incoming)return;
  const call=incoming;
  clearCall();
  try{await action('rechazar',{id:call.id});}catch(e){setStatus('No se pudo rechazar: '+failMessage(e));}
 }
 async function hangUp(){
  const c=current;
  clearCall('Llamada finalizada.');
  if(c){try{await action('colgar',{id:c.id});}catch(e){setStatus('No se pudo comunicar el fin de la llamada.');}}
 }
 async function applyCandidates(){
  if(!peer?.remoteDescription)return;
  const list=pendingCandidates.splice(0);
  for(const candidate of list){try{await peer.addIceCandidate(candidate);}catch(e){console.warn('ICE rechazado:',e.message);}}
 }
 async function onSignal(sig){
  if(!current||!peer||sig.origen===NAME())return;
  if(sig.tipo==='offer'){
    if(NAME()!==current.destino||incomingOfferSeen)return;
    incomingOfferSeen=true;
    await peer.setRemoteDescription(sig.datos);
    await applyCandidates();
    const answer=await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await sendSignal('answer',peer.localDescription.toJSON());
  }else if(sig.tipo==='answer'){
    if(NAME()!==current.origen||peer.remoteDescription)return;
    await peer.setRemoteDescription(sig.datos);
    await applyCandidates();
  }else if(sig.tipo==='candidate'){
    if(peer.remoteDescription){try{await peer.addIceCandidate(sig.datos);}catch(e){console.warn('ICE:',e.message);}}
    else pendingCandidates.push(sig.datos);
  }
 }
 async function pollSignals(){
  if(!current||!peer||inFlight)return;
  inFlight=true;
  try{
    const r=await request('/api/chat-push?michiRoute=signal&id='+encodeURIComponent(current.id)+'&nombre='+encodeURIComponent(NAME())+'&after='+signalCursor);
    for(const s of r.signals||[]){
      if(!current)break;
      signalCursor=Math.max(signalCursor,Number(s.id)||0);
      try{await onSignal(s);}catch(e){note('No se pudo establecer el audio/video: '+failMessage(e));}
    }
  }catch(e){if(current)console.warn('Lectura WebRTC:',e.message);}
  finally{inFlight=false;}
 }
 async function pollCall(){
  if(pollBusy||mediaBusy||!NAME()||!$('locked').hidden)return;
  if(document.hidden&&!current)return;
  const now=Date.now();
  if(now-lastCheck<(current?1300:3800))return;
  lastCheck=now;pollBusy=true;
  try{
    const r=await request('/api/chat-push?michiRoute=call&nombre='+encodeURIComponent(NAME()));
    const call=r.call;
    if(current){
      if(!call||call.id!==current.id||!['sonando','aceptada'].includes(call.estado)){
        clearCall('La otra persona terminó o rechazó la llamada.');return;
      }
      if(call.estado==='aceptada')current.estado='aceptada';
      await pollSignals();
    }else if(call?.estado==='sonando' && call.destino===NAME()){
      if(!incoming||incoming.id!==call.id)showIncoming(call);
    }else if(incoming){
      incoming=null;toggleOverlay(false);
    }
  }catch(e){if(current)note('Problema de conexión con la llamada.');}
  finally{pollBusy=false;}
 }
 $('call-voice-btn').addEventListener('click',()=>initiate('voz'));
 $('call-video-btn').addEventListener('click',()=>initiate('video'));
 $('call-accept').addEventListener('click',acceptCall);
 $('call-decline').addEventListener('click',declineCall);
 $('call-hangup').addEventListener('click',hangUp);
 $('call-mute').addEventListener('click',()=>{
  const tracks=localStream?.getAudioTracks()||[];
  if(!tracks.length)return;
  muted=!muted;tracks.forEach(t=>t.enabled=!muted);
  $('call-mute').textContent=muted?'🎙 Activar micrófono':'🎙 Silenciar';
 });
 $('call-camera').addEventListener('click',()=>{
  const tracks=localStream?.getVideoTracks()||[];
  if(!tracks.length)return;
  cameraOff=!cameraOff;tracks.forEach(t=>t.enabled=!cameraOff);
  $('call-camera').textContent=cameraOff?'📷 Activar cámara':'📷 Apagar cámara';
 });
 $('call-sound').addEventListener('click',()=>{
  const audio=current?.modo==='voz'?remoteAudio:remoteVideo;
  if(audio){audio.muted=false;audio.play().then(()=>note('Sonido activado.')).catch(()=>note('No se pudo reproducir el sonido.'));}
 });
 // No se cierran las llamadas solo porque el navegador cambie a otra app.
 // Una llamada huérfana expira mediante el servidor.
 setInterval(pollCall,1400);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)lastCheck=0;});
})();
