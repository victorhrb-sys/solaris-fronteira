import {SessionBook,readAccessFile,accessFile} from './online-sessions.mjs';
import {factionColors} from './engine.mjs';
import {empireLabel,escapeHTML} from './online-labels.mjs';
const $=s=>document.querySelector(s);
const escape=escapeHTML;
const newKey=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
export class Online {
 constructor(update,notify){this.update=update;this.notify=notify;this.room=null;this.session=null;this.busy=false;this.connected=true;this.generation=0;let storage;try{storage=localStorage;}catch{}this.book=new SessionBook(storage);}
 async request(body,session=this.session){
  const response=await fetch('/api/rooms'+(session?.code?'?code='+session.code:''),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.key},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível conectar.');return data;
 }
 remember(){try{this.book.save(this.session,this.room);}catch{this.notify('Acesso mantido nesta aba. Baixe o arquivo de acesso: o navegador não permitiu salvar.');}}
 apply(room){if(this.room&&room.code===this.room.code&&room.revision<this.room.revision)return;const previous=this.room,changed=!previous||room.code!==previous.code||room.revision!==previous.revision;this.room=room;this.connected=true;if(changed){this.remember();this.update(room);if(previous?.code===room.code&&room.game?.tick>previous.game?.tick)this.notify(`Turno ${room.game.tick+1} começou. Veja o resumo no mapa.`);}this.paint();}
 async command(body){
  if(this.busy)throw Error('Aguarde o envio anterior.');
  this.busy=true;this.update(this.room);this.paint();
  const generation=this.generation,session=this.session;
  const request={...body,tick:this.room?.game?.tick,requestId:crypto.randomUUID()};
  try{const room=await this.request(request,session);if(generation===this.generation)this.apply(room);return room;}
  catch(e){this.connected=false;await this.refresh();throw e;}
  finally{this.busy=false;this.update(this.room);this.paint();}
 }
 async action(action){const room=await this.command({type:'action',action});return action.type==='send'?room.game.orders.at(-1):room;}
 async refresh(){
  if(!this.session?.code)return;
  const generation=this.generation;
  try{const room=await this.request(null);if(generation===this.generation)this.apply(room);}catch{if(generation===this.generation){this.connected=false;this.paint();}}
 }
 async connect(type){
  if(this.busy)return;
  const code=$('#roomCode').value.trim().toUpperCase(),name=$('#onlineName').value.trim();
  const saved=type==='join'&&this.book.entries.find(e=>e.code===code);if(saved)return this.recover(saved);
  const signature=JSON.stringify([type,code,name,$('#roomCapacity').value]);
  const key=type==='recover'?$('#recoveryKey').value.trim():this.pending?.signature===signature?this.pending.key:newKey();
  this.pending={signature,key};
  const session={code:type==='create'?'':code,key};
  this.busy=true;$('#onlineError').textContent='Conectando…';
  try{
   const room=await this.request(type==='recover'?null:{type,name,capacity:+$('#roomCapacity').value,requestId:crypto.randomUUID()},session);
   this.generation++;this.session={...session,code:room.code};this.room=null;this.apply(room);
   this.pending=null;history.replaceState(null,'',location.pathname+'?room='+room.code);$('#onlineError').textContent='';
  }catch(e){$('#onlineError').textContent=e.message;}finally{this.busy=false;this.update(this.room);this.paint();}
 }
 async recover(session){
  if(this.busy)return;
  this.busy=true;$('#onlineError').textContent='Recuperando acesso…';
  try{const room=await this.request(null,session);this.generation++;this.session={code:session.code,key:session.key};this.room=null;this.apply(room);history.replaceState(null,'',location.pathname+'?room='+room.code);$('#onlineError').textContent='';}
  catch(e){$('#onlineError').textContent=e.message;}finally{this.busy=false;this.update(this.room);this.paint();}
 }
 leave(close=true){
  if(this.busy)return;
  this.generation++;this.room=null;this.session=null;
  try{this.book.deactivate();}catch{this.notify('As partidas continuam nesta aba. Guarde o arquivo de acesso antes de fechá-la.');}
  history.replaceState(null,'',location.pathname);this.update(null);this.paint();if(close)$('#onlineDialog').close();
 }
 downloadAccess(){
  if(!this.session)return;
  const url=URL.createObjectURL(new Blob([accessFile(this.session)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download=`solaris-acesso-${this.session.code}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  this.notify('Arquivo de acesso baixado. Guarde-o só para você.');
 }
 paintSaved(){
  const list=$('#savedRooms');
  const html=this.book.entries.map(e=>`<li><span><b>${escape(e.name||'Meu império')}</b><small>Sala ${e.code} · ${e.tick==null?'Sala de espera':e.finished?'Encerrada':`Último acesso: turno ${e.tick+1}`}</small></span><button data-resume-room="${e.code}" ${this.busy?'disabled':''}>${this.room?.code===e.code?'Atual':'Retomar'}</button></li>`).join('');
  if(list.innerHTML!==html)list.innerHTML=html;
  $('#savedRoomsSection').hidden=!this.book.entries.length;
 }
 paintSummary(){
  const summary=this.room?.turnSummary,button=$('#turnSummaryButton');button.hidden=!summary;
  if(!summary){this.summaryKey=null;return;}
  const key=this.room.code+':'+summary.tick;if(this.summaryKey===key)return;this.summaryKey=key;
  button.textContent=`Turno ${summary.tick+1} · ver resumo`;
  $('#turnSummaryTitle').textContent=`Chegada ao turno ${summary.tick+1}`;
  const names=items=>items.length?items.map(s=>escape(s.name)).join(', '):'Nenhuma';
  $('#turnSummaryBody').innerHTML=`<p>Resultado do último avanço. Renda recebida: <b>+$${summary.income}</b>.</p><dl class="turn-summary-grid"><div><dt>Conquistas</dt><dd>${summary.gained.length}</dd></div><div><dt>Estrelas perdidas</dt><dd>${summary.lost.length}</dd></div><div><dt>Ataques recebidos</dt><dd>${summary.battles.filter(b=>b.defending).length}</dd></div><div><dt>Naves perdidas em combate</dt><dd>${summary.battles.reduce((n,b)=>n+b.lostShips,0)}</dd></div></dl><p><b>Conquistadas:</b> ${names(summary.gained)}<br><b>Perdidas:</b> ${names(summary.lost)}</p><details class="disclosure"><summary>Chegadas das suas frotas · ${summary.arrivals.length} destinos</summary><div class="detail-content">${summary.arrivals.length?summary.arrivals.map(a=>`<p>${escape(a.name)}: ${a.ships} naves chegaram antes do combate.</p>`).join(''):'Nenhuma frota sua chegou neste avanço.'}</div></details><details class="disclosure"><summary>Seus combates · ${summary.battles.length}</summary><div class="detail-content">${summary.battles.length?summary.battles.map(b=>`<p>${escape(b.name)} · ${b.defending?'defesa':'ataque'} · ${b.lostShips} naves perdidas <button data-summary-battle="${escape(b.id)}">Ver batalha</button></p>`).join(''):'Nenhum combate envolvendo seu império.'}</div></details>`;
 }
 paint(){
  this.paintSaved();this.paintSummary();
  const room=this.room;$('#onlineLobby').hidden=!room;$('#onlineConnect').hidden=!!room;
  $('#onlineBadge').textContent=room?(!this.connected?'Reconectando…':room.started?(room.game.winner!==null?'Partida encerrada':`${room.readyCount}/${room.humanCount} prontos`):'Sala de espera'):'Multiplayer';
  if(!room)return;
  $('#onlineRoomTitle').textContent='Sala '+room.code;$('#roomMemberCount').textContent='Participantes · cores e confirmações';
  $('#roomMembers').innerHTML=Array.from({length:room.capacity},(_,owner)=>{const m=room.members.find(m=>m.owner===owner);const status=!m?(room.started?'Bot':'Vaga / bot'):m.resigned?'Bot assumiu':!room.started?'Na sala':room.game.winner!==null?'Encerrada':m.active===false?'Eliminado':m.ready?'Pronto':'Preparando';return `<li><i class="dot" style="background:${factionColors[owner]}"></i><span>${escape(empireLabel(room,owner))}${owner===room.owner?' · você':''}<small>${status}</small></span></li>`;}).join('');
  $('#startOnline').hidden=room.started||!room.host;$('#startOnline').disabled=this.busy||room.members.length<2;
  $('#playOnline').hidden=!room.started;$('#inviteLink').value=location.origin+location.pathname+'?room='+room.code;
  $('#personalKey').value=this.session.key;
  const waiting=room.members.filter(m=>!m.resigned&&m.active!==false&&!m.ready).map(m=>m.owner===room.owner?`${m.name} (você)`:m.name);
  const status=!this.connected?'Conexão interrompida. Tentando reconectar.':!room.started?'Convide os amigos. Ao iniciar, as vagas restantes viram bots.':room.game.winner!==null?'Partida encerrada.':room.humanCount===0?'Nenhum humano ativo. A sala está parada.':`Falta confirmar: ${waiting.join(', ')||'resolvendo turno…'}.`;
  $('#onlineStatus').textContent=status;$('#onlineBadge').title=status;
  $('#resignOnline').hidden=!room.started||room.resigned||room.game.winner!==null;
 }
 open(){this.paint();$('#onlineDialog').showModal();}
 init(){
  document.body.insertAdjacentHTML('beforeend',`<button id="onlineBadge" class="online-badge">Multiplayer</button><dialog id="onlineDialog" class="online-dialog"><form method="dialog"><button class="close" aria-label="Fechar multiplayer">×</button></form><h2>Jogar com amigos</h2><details id="savedRoomsSection" class="disclosure" open hidden><summary>Minhas partidas</summary><ul id="savedRooms" class="saved-rooms"></ul></details><div id="onlineConnect"><label>Seu nome<input id="onlineName" maxlength="24" placeholder="Como você se chama?" autocomplete="nickname"></label><div class="field-row"><label for="roomCapacity">Impérios</label><select id="roomCapacity">${[2,3,4,5,6,7,8].map(n=>`<option>${n}</option>`).join('')}</select><button id="createOnline" class="success">Criar sala</button></div><label>Código da sala<input id="roomCode" maxlength="12" placeholder="Cole o código do convite" autocapitalize="characters"></label><button id="joinOnline" class="primary">Entrar na sala</button><details class="disclosure"><summary>Recuperar meu lugar</summary><label>Chave pessoal<input id="recoveryKey" type="password" autocomplete="off" placeholder="Cole a chave guardada"></label><button id="recoverOnline">Recuperar acesso</button></details><label class="access-import">Recuperar pelo arquivo de acesso<input id="importAccess" type="file" accept=".json,application/json"></label><p>De 2 a 8 impérios. Pelo menos dois humanos; as vagas restantes viram bots.</p></div><div id="onlineLobby" hidden><h3 id="onlineRoomTitle"></h3><details class="disclosure"><summary id="roomMemberCount">Participantes</summary><ol id="roomMembers"></ol></details><p id="onlineStatus" role="status"></p><label>Convite para amigos<input id="inviteLink" readonly></label><button id="copyInvite">Copiar convite</button><div class="access-backup"><button id="downloadAccess">Baixar meu arquivo de acesso</button><p>Guarde este arquivo para recuperar sua partida em outro aparelho. Ele controla seu império; não o envie aos amigos. Para convidar, use o convite acima.</p></div><details class="disclosure"><summary>Guardar minha chave pessoal</summary><p>Guarde esta chave para recuperar seu lugar em outro navegador. Ela permite controlar seu império: não compartilhe com outros jogadores.</p><input id="personalKey" type="password" readonly><button id="copyKey">Copiar chave pessoal</button></details><div class="dialog-actions"><button id="startOnline" class="success">Iniciar com estes jogadores</button><button id="playOnline" class="primary">Voltar ao mapa</button></div><details class="disclosure"><summary>Sair ou desistir</summary><p>Fechar a página mantém seu lugar e aguarda sua confirmação. Suas partidas ficam em Minhas partidas, mesmo ao voltar ao jogo local. Entregar ao bot é definitivo.</p><button id="offlineOnline">Voltar ao jogo local</button><button id="otherOnline">Outra partida</button><button id="resignOnline" class="danger">Entregar meu império ao bot</button></details></div><p id="onlineError" role="alert"></p></dialog><button id="turnSummaryButton" class="turn-summary-button" hidden></button><dialog id="turnSummaryDialog" class="online-dialog"><form method="dialog"><button class="close" aria-label="Fechar resumo">×</button></form><h2 id="turnSummaryTitle"></h2><div id="turnSummaryBody"></div></dialog>`);
  $('#onlineBadge').onclick=()=>this.open();
  $('#savedRooms').onclick=e=>{const code=e.target.closest('[data-resume-room]')?.dataset.resumeRoom;const saved=this.book.entries.find(s=>s.code===code);if(saved)this.recover(saved);};
  $('#otherOnline').onclick=()=>this.leave(false);
  $('#downloadAccess').onclick=()=>this.downloadAccess();
  $('#importAccess').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8192)throw Error('Arquivo de acesso inválido.');await this.recover(readAccessFile(await file.text()));}catch(error){$('#onlineError').textContent=error.message;}finally{e.target.value='';}};
  $('#turnSummaryButton').onclick=()=>$('#turnSummaryDialog').showModal();
  $('#turnSummaryBody').onclick=e=>{const id=e.target.closest('[data-summary-battle]')?.dataset.summaryBattle;if(id){$('#turnSummaryDialog').close();document.dispatchEvent(new CustomEvent('open-online-battle',{detail:id}));}};
  $('#createOnline').onclick=()=>this.connect('create');$('#joinOnline').onclick=()=>this.connect('join');$('#recoverOnline').onclick=()=>this.connect('recover');
  $('#startOnline').onclick=()=>this.command({type:'start'}).then(()=>$('#onlineDialog').close()).catch(e=>$('#onlineError').textContent=e.message);
  $('#playOnline').onclick=()=>$('#onlineDialog').close();
  $('#offlineOnline').onclick=()=>this.leave();
  $('#resignOnline').onclick=()=>{if(confirm('Entregar definitivamente seu império ao bot?'))this.command({type:'resign'}).catch(e=>this.notify(e.message));};
  for(const [button,input] of [['copyInvite','inviteLink'],['copyKey','personalKey']])$('#'+button).onclick=async()=>{try{await navigator.clipboard.writeText($('#'+input).value);this.notify('Copiado.');}catch{$('#'+input).type='text';$('#'+input).select();this.notify('Selecione e copie o texto.');}};
  const invited=new URLSearchParams(location.search).get('room');if(invited)$('#roomCode').value=invited.toUpperCase();
  const saved=invited?this.book.entries.find(e=>e.code===invited.toUpperCase()):this.book.active;
  try{this.book.flush();}catch{}
  if(saved){this.session={code:saved.code,key:saved.key};this.refresh();}
  this.paint();
  if(invited)this.open();
  const poll=async()=>{if(this.session&&!document.hidden&&!this.busy)await this.refresh();this.timer=setTimeout(poll,5000);};this.timer=setTimeout(poll,5000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh();});window.addEventListener('online',()=>this.refresh());
 }
}
