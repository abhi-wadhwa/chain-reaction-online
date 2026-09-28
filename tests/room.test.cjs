const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const Module=require('node:module');
const rooms=new Map();let serial=0;
const original=Module._load;
class BlobPreconditionFailedError extends Error {}
Module._load=function(id,...args){if(id==='@vercel/blob')return {
 BlobPreconditionFailedError,
 get:async p=>{const r=rooms.get(p);return r?{stream:new Response(r.body).body,blob:{etag:'W/'+r.etag}}:null},
 put:async(p,body,o)=>{const r=rooms.get(p);if(r&&(!o.allowOverwrite||o.ifMatch!==r.etag)){if(o.allowOverwrite)throw new BlobPreconditionFailedError();const e=new Error();e.name='BlobAlreadyExistsError';throw e;}rooms.set(p,{body,etag:String(++serial)})}
};return original.call(this,id,...args)};
const handler=require('../api/room.js');Module._load=original;
async function call(body){let status;let result;await handler({method:'POST',headers:{host:'game.test'},body},{setHeader(){},status(n){status=n;return this},json(d){result=d;return this}});return {status,...result}}
test('two seats, simultaneous join, move authorization, replay and rematch',async()=>{
 const code='TEST1234',a={code,token:randomUUID()},b={code,token:randomUUID()},c={code,token:randomUUID()};
 assert.equal((await call({...a,action:'create'})).player,0);
 const joins=await Promise.all([call({...b,action:'join'}),call({...c,action:'join'})]);assert.deepEqual(joins.map(x=>x.status).sort(),[200,409]);
 const guest=joins[0].status===200?b:c,outsider=guest===b?c:b;
 assert.equal((await call({...outsider,action:'sync'})).status,403);
 let s=await call({...a,action:'sync'});assert.equal(s.ready,true);
 assert.equal((await call({...guest,action:'move',index:3,rev:0,version:s.version,requestId:randomUUID()})).status,409);
 const m={...a,action:'move',index:0,rev:0,version:s.version,requestId:randomUUID()};
 s=await call(m);assert.equal(s.state.turn,1);assert.equal((await call(m)).state.rev,1);
 assert.equal((await call({...guest,action:'move',index:0,rev:s.state.rev,version:s.version,requestId:randomUUID()})).status,409);
 s=await call({...guest,action:'move',index:1,rev:s.state.rev,version:s.version,requestId:randomUUID()});
 s=await call({...a,action:'move',index:0,rev:s.state.rev,version:s.version,requestId:randomUUID()});assert.equal(s.state.winner,0);
 await call({...a,action:'rematch'});s=await call({...guest,action:'rematch'});assert.equal(s.state.rev,0);assert.equal(s.state.winner,null);
 await call({...a,action:'leave'});assert.equal((await call({...guest,action:'sync'})).closed,true);
});
test('game thresholds, mass conservation and complete cascades',()=>{
 const {fresh,play,neighbors}=require('../public/rules.js');assert.equal(neighbors(0).length,2);assert.equal(neighbors(1).length,3);assert.equal(neighbors(7).length,4);
 let seed=3936;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let game=0;game<20;game++){let s=fresh();for(let i=0;i<1000&&s.winner===null;i++){const before=s.cells.reduce((a,c)=>a+c.n,0),legal=s.cells.map((c,j)=>!c.n||c.owner===s.turn?j:-1).filter(j=>j>=0);s=play(s,legal[Math.floor(random()*legal.length)],s.turn).at(-1);assert.equal(s.cells.reduce((a,c)=>a+c.n,0),before+1);if(s.winner===null)s.cells.forEach((c,j)=>assert(c.n<neighbors(j).length))}assert.notEqual(s.winner,null)}
});
