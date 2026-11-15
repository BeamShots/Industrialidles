const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
const key='tideforge-v1'+location.pathname.replace(/index\.html$/,'');
let s={wood:24,ore:8,bars:0,radius:3,machines:{},level:0};
try{Object.assign(s,JSON.parse(localStorage.getItem(key))||{})}catch{}
const names=['Gather','Drill','Belt','Furnace','Depot','Rotate','Lift','Center'];
const costs={Drill:6,Belt:1,Furnace:5,Depot:3};
const dirs=[[1,0],[0,1],[-1,0],[0,-1]],arrows=['→','↓','←','↑'];
let tool='Gather',dir=0,pan=[0,0],down,frame=0,flash='',until=0,battle=null;
const ID=(x,y)=>x+','+y;
function terrain(x,y){if(x*x+y*y>s.radius*s.radius+3)return 'sea';if(x===-2&&y===0||Math.abs(x*9+y*7)%13===6)return 'vein';return (x*3+y*7+99)%8===1?'pine':'grass'}
function save(){try{localStorage.setItem(key,JSON.stringify(s))}catch{say('Device storage unavailable.')}stock.textContent='Timber '+s.wood+'   ◆ Ore '+s.ore+'   ▰ Ingots '+s.bars}
function say(t){flash=t;until=Date.now()+2900}
function buttons(){tools.replaceChildren();for(const n of names){let b=document.createElement('button');b.textContent=n==='Rotate'?arrows[dir]+' Turn':n;b.className=n===tool?'on':'';b.onclick=()=>{until=0;if(n==='Rotate'){dir=(dir+1)%4;say('Build direction '+arrows[dir]+'. Tap a machine in Gather to turn it.')}else if(n==='Center'){pan=[0,0]}else tool=n;buttons()};tools.append(b)}}
function modal(t,msg,choices){titleEl.textContent=t;details.textContent=msg;actions.replaceChildren();for(const [label,fn] of choices){let b=document.createElement('button');b.textContent=label;b.onclick=()=>{panel.close();fn?.()};actions.append(b)}panel.showModal()}
const titleEl=document.querySelector('#title');
chart.onclick=()=>modal('Sea chart','Saltwind is peaceful. Reclaim coastline for 5 ingots or sail to the next guardian reef for 3.',[['Expand · 5',()=>{if(s.bars<5)return say('Deliver 5 ingots first.');s.bars-=5;s.radius++;save();say('New shoreline reclaimed!')}],['Reef '+(s.level+1)+' · 3',()=>{if(s.bars<3)return say('Deliver 3 ingots to sail.');s.bars-=3;save();battle={hp:3+s.level,life:4,round:0};fight()}],['Back']]);
function fight(){const hit=battle.round%3!==2;modal('Guardian reef '+(s.level+1),'Hull '+battle.life+' • Guardian '+battle.hp+' • '+(hit?'Its shell opens.':'Its cannon glows!'),[['Fire',()=>resolve(true)],['Brace',()=>resolve(false)],['Retreat',()=>battle=null]])}
function resolve(fire){if(fire&&battle.round%3!==2)battle.hp--;if(fire&&battle.round%3===2)battle.life-=2;battle.round++;if(battle.hp<=0){s.level++;s.wood+=12;s.bars+=5;save();say('Reef secured! +12 timber, +5 ingots.')}else if(battle.life<=0)say('Ship returned for repairs.');else return fight();battle=null}
function tap(x,y){const id=ID(x,y),m=s.machines[id],land=terrain(x,y);if(land==='sea')return say('Open Chart to expand the shoreline.');
if(tool==='Lift'){if(m){s.wood+=costs[m.type];delete s.machines[id];save();say('Machine lifted. Timber refunded.')}return}
if(tool==='Gather'){if(m)return modal(m.type,'Output '+arrows[m.d]+'. '+(m.item?'Holding '+m.item+'.':'Ready.'),[['Turn clockwise',()=>{m.d=(m.d+1)%4;save()}],['Close']]);if(land==='vein'){s.ore++;say('+1 ore')}else{s.wood+=land==='pine'?3:1;say(land==='pine'?'+3 timber':'+1 driftwood')}save();return}
if(m)return say('Tile occupied. Lift it to rebuild.');if(tool==='Drill'&&land!=='vein')return say('Place the drill on blue ore.');if(s.wood<costs[tool])return say('Gather timber from trees or grass.');
s.wood-=costs[tool];s.machines[id]={type:tool,d:dir,item:null};save();say(tool+' placed '+arrows[dir])}
function tick(){const moved=new Set();for(const [id,m] of Object.entries(s.machines)){if(moved.has(id))continue;if(m.type==='Drill'&&!m.item)m.item='ore';if(!m.item)continue;const [x,y]=id.split(',').map(Number),[dx,dy]=dirs[m.d],nid=ID(x+dx,y+dy),n=s.machines[nid];if(!n||n.item||n.type==='Drill')continue;if(n.type==='Depot'){s[m.item==='ore'?'ore':'bars']++}else if(n.type==='Furnace'){if(m.item!=='ore')continue;n.item='ingot'}else n.item=m.item;m.item=null;moved.add(nid)}save()}
const size=22;
function origin(){return [Math.floor(canvas.width/2-11+pan[0]),Math.floor(canvas.height/2-11+pan[1])]}
function draw(){let w=Math.round(canvas.clientWidth/2),h=Math.round(canvas.clientHeight/2);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}const [ox,oy]=origin();frame=Date.now()/240;function box(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),w,h)}
box(0,0,w,h,'#246276');for(let j=Math.floor(-oy/size);j<=(h-oy)/size;j++)for(let i=Math.floor(-ox/size);i<=(w-ox)/size;i++){const x=ox+i*size,y=oy+j*size,l=terrain(i,j),v=Math.abs(i*71+j*43);if(l==='sea'){box(x+(v%10)+Math.sin(frame/5+v)*2,y+9,6,1,'#397f8b');continue}
box(x,y,22,22,'#759957');box(x,y,21,21,(i+j)%2?'#92ac61':'#9bb86a');for(let k=1;k<6;k++)box(x+(v+k*7)%19,y+(v+k*11)%19,2,1,'#b2c77b');if(terrain(i,j+1)==='sea'){box(x,y+17,22,3,'#e1c180');box(x,y+20,22,2,'#846d4e')}
const m=s.machines[ID(i,j)];if(!m){if(l==='pine'){box(x+9,y+13,4,6,'#72543b');for(let k=0;k<4;k++){box(x+9-k*2,y+2+k*3,4+k*4,4,'#27584a');box(x+9-k*2,y+2+k*3,2+k,2,'#4b8560')}}if(l==='vein')for(let k=0;k<3;k++){let a=x+3+k*5,b=y+8+(k%2)*4;box(a,b,6,7,'#406277');box(a+1,b-2,4,5,'#9ee3e1')}continue}
box(x+2,y+4,18,16,'#263e42');box(x+3,y+5,16,12,m.type==='Depot'?'#996344':'#52696a');if(m.type==='Furnace'){box(x+5,y+2,4,7,'#655351');box(x+6,y+9,10,7,'#bf683c');box(x+8,y+11,6,4,'#ffdc73')}if(m.type==='Drill'){box(x+4,y+4,14,3,'#d5a75e');box(x+8,y+7,6,5,'#b77845');box(x+10,y+12+Math.floor(frame)%2,2,4,'#e7d5a2')}if(m.type==='Depot'){for(let k=0;k<3;k++)box(x+4,y+6+k*4,14,1,'#e1aa69')}ctx.fillStyle='#fff1bd';ctx.font='bold 11px monospace';ctx.fillText(arrows[m.d],x+7,y+(m.type==='Belt'?15:21));if(m.item){box(x+4+(frame%3),y+5,5,4,m.item==='ore'?'#8ce2e3':'#ffd775')}}
hint.textContent=Date.now()<until?flash:costs[tool]?tool+' · '+costs[tool]+' timber · Output '+arrows[dir]+'. Tap a tile to build.':tool==='Lift'?'Tap a machine to lift it and refund its timber.':'Tap trees for timber. Build a line: blue vein → Drill → Belt → Furnace → Depot.'}
function point(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]}
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);down={p:point(e),pan:[...pan],drag:false}};canvas.onpointermove=e=>{if(!down)return;const p=point(e),dx=p[0]-down.p[0],dy=p[1]-down.p[1];if(Math.hypot(dx,dy)>3)down.drag=true;if(down.drag)pan=[down.pan[0]+dx,down.pan[1]+dy]};canvas.onpointerup=e=>{if(down&&!down.drag){let p=point(e),o=origin();tap(Math.floor((p[0]-o[0])/size),Math.floor((p[1]-o[1])/size))}down=null};canvas.onpointercancel=()=>down=null;
buttons();save();draw();setInterval(draw,100);setInterval(tick,1000);if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
