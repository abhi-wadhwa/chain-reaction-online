(function(root){
const N=48;
const neighbors=i=>[i%6?i-1:-1,i%6<5?i+1:-1,i>=6?i-6:-1,i<42?i+6:-1].filter(x=>x>=0);
const fresh=()=>({cells:Array.from({length:N},()=>({owner:-1,n:0})),turn:0,moved:[false,false],winner:null,rev:0});
// Pure game rules: return each cascade frame so both screens see the same animation.
function play(state,index,player){
 if(state.winner!==null||player!==state.turn||!Number.isInteger(index)||index<0||index>=N)return null;
 if(state.cells[index].n&&state.cells[index].owner!==player)return null;
 const s=structuredClone(state),frames=[];s.moved[player]=true;s.rev++;
 const add=i=>{s.cells[i].n++;s.cells[i].owner=player};add(index);
 const won=()=>s.moved.every(Boolean)&&!s.cells.some(c=>c.n&&c.owner!==player);
 for(let step=0;step<10000;step++){
  if(won()){s.winner=player;frames.push(structuredClone(s));return frames;}
  const bursts=s.cells.map((c,i)=>c.n>=neighbors(i).length?i:-1).filter(i=>i>=0);
  if(!bursts.length){s.turn=1-player;frames.push(structuredClone(s));return frames;}
  frames.push(structuredClone(s));
  for(const i of bursts){s.cells[i].n-=neighbors(i).length;if(!s.cells[i].n)s.cells[i].owner=-1;}
  for(const i of bursts)for(const j of neighbors(i))add(j);
 }
 throw Error('Cascade limit reached');
}

const rules={fresh,play,neighbors};if(typeof module!=='undefined')module.exports=rules;else root.Rules=rules;
})(globalThis);
