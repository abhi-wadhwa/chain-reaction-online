const {get,put,BlobPreconditionFailedError}=require('@vercel/blob');
const {createHash}=require('node:crypto');
const {fresh,play}=require('../public/rules.js');
const hash=s=>createHash('sha256').update(s).digest('hex');
const path=code=>`rooms/${code}.json`;
const fail=(status,message)=>Object.assign(new Error(message),{status});
function view(r,token){return {code:r.code,player:r.players.indexOf(hash(token)),ready:!!r.players[1],state:r.state,votes:r.votes,version:r.version,lastMove:r.lastMove,closed:r.closed,expires:r.expires};}
async function read(code){const blob=await get(path(code),{access:'private',useCache:false});if(!blob)return null;return {room:await new Response(blob.stream).json(),etag:blob.blob.etag.replace(/^W\//, '')};}
async function save(room,etag){await put(path(room.code),JSON.stringify(room),{access:'private',addRandomSuffix:false,contentType:'application/json',...(etag?{allowOverwrite:true,ifMatch:etag}:{allowOverwrite:false})});}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
 try{
  const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)throw fail(403,'This request must come from the game.');
  if(Number(req.headers['content-length']||0)>4096)throw fail(413,'Request too large.');
  let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch{throw fail(400,'Invalid request.')}}
  const {action,code,token}=b||{};
  if(!['create','join','sync','move','rematch','leave'].includes(action)||!/^\w{8}$/.test(code||'')||!/^[a-f0-9-]{36}$/.test(token||''))throw fail(400,'Invalid room or player details.');
  for(let attempt=0;attempt<4;attempt++){
   const found=await read(code);let room=found?.room;
   if(!room){
    if(action!=='create')throw fail(404,'Room not found. Check the code or create a new room.');
    room={code,players:[hash(token),null],state:fresh(),votes:[false,false],version:0,lastMove:null,lastRequests:[null,null],closed:false,expires:Date.now()+2*60*60*1000};
    try{await save(room);return res.status(200).json(view(room,token))}catch(e){if(await read(code))continue;throw e}
   }
   if(room.expires<Date.now())throw fail(410,'This room expired. Create a new room.');
   let player=room.players.indexOf(hash(token));
   if(action==='create'){if(player===0)return res.status(200).json(view(room,token));throw fail(409,'This code is in use. Create another room.');}
   if(action==='join'){
    if(room.closed)throw fail(410,'This room has closed. Create a new room.');
    if(player>=0)return res.status(200).json(view(room,token));
    if(room.players[1])throw fail(409,'This room already has two players.');
    room.players[1]=hash(token);player=1;
   }else{
    if(player<0)throw fail(403,'This player does not have a seat in this room.');
    if(action==='sync')return res.status(200).json(view(room,token));
    if(room.closed)throw fail(410,'Your friend left the room. Create a new room.');
    if(action==='move'){
     if(!room.players[1])throw fail(409,'Wait for your friend to join.');
     if(typeof b.requestId!=='string'||b.requestId.length>64)throw fail(400,'Invalid move identifier.');
     if(room.lastRequests[player]===b.requestId)return res.status(200).json(view(room,token));
     if(b.rev!==room.state.rev||b.version!==room.version)throw fail(409,'The board changed. Try your move again.');
     const frames=play(room.state,b.index,player);if(!frames)throw fail(409,'Choose an empty cell or one of your own on your turn.');
     room.lastMove={index:b.index,player,fromRev:room.state.rev};room.state=frames.at(-1);room.lastRequests[player]=b.requestId;
    }else if(action==='rematch'){
     if(!room.players[1])throw fail(409,'Wait for your friend to join.');
     room.votes[player]=true;
     if(room.votes.every(Boolean)){room.state=fresh();room.votes=[false,false];room.lastMove=null;room.lastRequests=[null,null];}
    }else if(action==='leave')room.closed=true;
   }
   room.version++;
   try{await save(room,found.etag);return res.status(200).json(view(room,token));}catch(e){if(e instanceof BlobPreconditionFailedError)continue;throw e;}
  }
  throw fail(409,'The room changed at the same time. Please try again.');
 }catch(e){console.error('Room request failed:',e.name,e.status||500);return res.status(e.status||503).json({error:e.status?e.message:'Room service temporarily unavailable. Please try again.'});}
};
