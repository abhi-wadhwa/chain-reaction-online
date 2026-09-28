'use strict';
const $=id=>document.getElementById(id),{fresh,play,neighbors}=Rules;
let state=fresh(),seat=null,ready=false,busy=false,sending=false,version=-1,votes=[false,false],pollTimer,epoch=0,animation=0,closed=false;
const buttons=Array.from({length:48},(_,i)=>{const b=document.createElement('button');b.className='cell';b.onclick=()=>move(i);$('board').append(b);return b});
function message(t){$('network').textContent=t}
function persist(){try{if(seat)sessionStorage.setItem('chain-seat-v2',JSON.stringify(seat));else sessionStorage.removeItem('chain-seat-v2')}catch{}}
function render(){
 const me=seat?.player,counts=[0,0];
 state.cells.forEach((c,i)=>{if(c.n)counts[c.owner]+=c.n;const b=buttons[i];b.className='cell'+(c.n?' own'+c.owner:'')+(c.n>=neighbors(i).length-1?' critical':'');b.replaceChildren();for(let n=0;n<Math.min(c.n,4);n++){const o=document.createElement('span');o.className='orb';b.append(o)}const t=document.createElement('span');t.className='count';t.textContent=c.n||'';b.append(t);b.disabled=!ready||busy||sending||closed||state.winner!==null||state.turn!==me||(c.n>0&&c.owner!==me);b.setAttribute('aria-label',`Row ${Math.floor(i/6)+1}, column ${i%6+1}: ${c.n} ${c.owner===0?'coral':c.owner===1?'blue':'empty'} orbs`)});
 for(const [i,id]of ['redScore','blueScore'].entries()){$(id).querySelector('b').textContent=counts[i];$(id).classList.toggle('active',ready&&state.turn===i&&state.winner===null)}
 $('turn').textContent=closed?'Room closed. Create a new room to play.':!seat?'Create a room or join a friend to start.':!ready?'Waiting for your friend to join…':state.winner!==null?(state.winner===me?'You win!':'Your friend wins!'):busy?'Chain reaction…':state.turn===me?`Your turn · ${me===0?'Coral':'Blue'}`:`Waiting for ${me===0?'Blue':'Coral'} to move…`;
 $('host').disabled=!!seat||sending;$('join').disabled=!!seat||sending;$('room').hidden=!seat;$('roomCode').textContent=seat?.code||'';$('leave').hidden=!seat;
 $('reset').hidden=!ready||closed;$('reset').disabled=busy||sending||!!votes[me];$('reset').textContent=votes[me]?'Rematch requested…':votes[1-me]?'Accept rematch':'Request rematch';
}
async function request(action,extra={},who=seat){
 const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...who,action,...extra}),signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok){const e=new Error(d.error||'Request failed.');e.status=r.status;throw e}return d;
}
async function accept(d){
 if(d.version<version)return;const old=state;const changed=d.version>version;
 version=d.version;ready=d.ready;closed=d.closed;votes=d.votes;seat.player=d.player;persist();
 message(closed?'A player left this room. Leave and create a new one.':ready?`Connected. You are ${seat.player===0?'Coral':'Blue'}.`:'Room ready. Share the invite link with your friend.');
 if(changed){
  const frames=d.lastMove&&d.lastMove.fromRev===old.rev&&d.state.rev===old.rev+1?play(old,d.lastMove.index,d.lastMove.player):null;
  const ticket=++animation,life=epoch;
  if(frames&&frames.length>1){busy=true;for(const f of frames.slice(-40)){if(ticket!==animation||life!==epoch)return;state=f;render();await new Promise(r=>setTimeout(r,90));}}
  if(ticket!==animation||life!==epoch)return;state=d.state;busy=false;
 }
 render();
}
function schedule(){clearTimeout(pollTimer);if(seat&&!closed)pollTimer=setTimeout(sync,document.hidden?8000:1800)}
async function sync(){if(!seat||closed)return;const life=epoch;try{const d=await request('sync');if(life!==epoch)return;await accept(d)}catch(e){if(life!==epoch)return;message(e.message||'Connection interrupted. Retrying…');if([403,404,410].includes(e.status)){closed=true;render()}}finally{if(life===epoch)schedule()}}
async function start(host){
 const code=host?Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''):$('code').value.trim().toUpperCase();
 if(!/^[A-Z0-9]{8}$/.test(code)){message('Enter the 8-character code your friend shared.');return}
 sending=true;render();message(host?'Creating room…':'Joining your friend…');const candidate={code,token:crypto.randomUUID(),player:host?0:1};
 try{const d=await request(host?'create':'join',{},candidate);seat=candidate;version=-1;await accept(d);schedule()}catch(e){message(e.name==='TimeoutError'?'The server took too long. Please try again.':e.message)}finally{sending=false;render()}
}
async function move(index){if(!seat||!ready||closed||busy||sending||state.turn!==seat.player)return;await action('move',{index,rev:state.rev,version,requestId:crypto.randomUUID()})}
async function action(name,data={}){sending=true;render();const life=epoch;try{const d=await request(name,data);if(life===epoch)await accept(d)}catch(e){if(life===epoch){message(e.name==='TimeoutError'?'Request timed out. Checking the room…':e.message);await sync()}}finally{if(life===epoch){sending=false;render();schedule()}}}
$('host').onclick=()=>start(true);$('join').onclick=()=>start(false);$('code').onkeydown=e=>{if(e.key==='Enter'&&!$('join').disabled)start(false)};
$('reset').onclick=()=>action('rematch');
$('leave').onclick=async()=>{const previous=seat;epoch++;animation++;clearTimeout(pollTimer);seat=null;ready=false;closed=false;busy=false;sending=false;version=-1;votes=[false,false];state=fresh();persist();render();message('You left the room.');if(previous)try{await request('leave',{},previous)}catch{}};
$('copy').onclick=async()=>{if(!seat)return;const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',seat.code);try{await navigator.clipboard.writeText(u.href);message('Invite link copied. Send it to your friend.')}catch{message('Share this room code: '+seat.code)}};
const invite=new URLSearchParams(location.search).get('room')?.toUpperCase();if(invite)$('code').value=invite.slice(0,8);
try{const saved=JSON.parse(sessionStorage.getItem('chain-seat-v2'));if(saved&&(!invite||invite===saved.code)&&/^[A-Z0-9]{8}$/.test(saved.code))seat=saved;}catch{}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!sending)sync()});
render();if(seat){message('Restoring your room…');sync()}
