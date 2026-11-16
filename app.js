'use strict';
const $=id=>document.getElementById(id), G=Game;
const saveKey='tideforge-v3'+location.pathname.replace(/index\.html$/,'');
const oldKey='tideforge-v1'+location.pathname.replace(/index\.html$/,'');
let state=G.fresh(),storageError=false,loaded=false;
try{
 const raw=localStorage.getItem(saveKey)||localStorage.getItem(oldKey);
 if(raw){state=G.normalize(JSON.parse(raw));loaded=true;}
}catch{storageError=true;}
const offlineSeconds=loaded?G.offline(state):0;
const art=new Image();art.src='./assets/atlas.webp';
const spriteIndex={tree:0,rock:1,iron:2,copper:3,crystal:4,Drill:5,'Copper drill':5,Furnace:6,Depot:7,Sawmill:8,Quarry:9,'Gel furnace':10,'Wire mill':11,'Steel forge':12,'Crystal rig':13,Mint:14};
let audioEnabled=true,audioContext=null;
let effects=[],gatherCombo=0,lastGather=0,boostTime=0,boostCooldown=0,salvage=null;
let currentTab='Island',buildType=null,direction=0,selected=null,moving=null,zoom=2.7,pan={x:0,y:0},pointer=null;
let expedition=null,fishing=null,lastFrame=performance.now(),tickAccumulator=0,toastTimer,saveAccumulator=0;
const arrows=['→','↓','←','↑'],directionNames=['East','South','West','North'];
const icons={wood:'🪵',stone:'◈',ore:'◆',bars:'▰',gel:'●',copper:'◆',wire:'⌁',crystal:'✦',gears:'⚙',steel:'▰',fish:'♒',coins:'●'};
function make(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function button(label,fn,disabled=false,className=''){const b=make('button',className,label);b.disabled=disabled;b.onclick=()=>{sound('click');fn();};return b;}
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3000);}
function pendingCargo(){
 if(expedition)return expedition.loot;
 if(salvage)return Object.fromEntries(Object.entries(salvage.loot).map(([k,n])=>[k,salvage.traps>=2?Math.floor(n/2):n]));
 return null;
}
function persist(){
 state.savedAt=Date.now();
 try{localStorage.setItem(saveKey,JSON.stringify({...state,pendingLoot:pendingCargo()}));}catch{if(!storageError)toast('Saving is unavailable. Export a backup in Settings.');storageError=true;}
}
function changed(){persist();renderHUD();renderSelection();}
function costText(cost){return Object.entries(cost).map(([k,n])=>n+' '+G.resources[k]).join(' · ');}
function costNode(cost){const div=make('div','cost');for(const [k,n]of Object.entries(cost)){const span=make('span',state.inventory[k]<n?'missing':'',n+' '+G.resources[k]+' ('+state.inventory[k]+')');div.append(span,document.createTextNode('  '));}return div;}
function dialog(title,body){$('dialogTitle').textContent=title;$('dialogBody').replaceChildren(body);if(!$('dialog').open)$('dialog').showModal();}
$('closeDialog').onclick=()=>$('dialog').close();
function renderHUD(){
 $('resourceBar').replaceChildren(...Object.keys(G.resources).filter(k=>['wood','stone','bars','gel'].includes(k)).map(k=>{const el=make('span','resource',icons[k]+' '+G.resources[k]+' ');el.append(make('b','',String(state.inventory[k])));return el;}));
 const index=G.quests.findIndex((q,i)=>!state.claimed.includes(i)),q=G.quests[index];
 $('objective').replaceChildren(make('strong','',q?'QUEST · '+q.name:'THE BEACON IS LIT'));
 $('objective').append(document.createTextNode(q?q.goal+(q.progress?' · '+Math.min(...q.progress(state))+'/'+q.progress(state)[1]:''):'Keep expanding your island and mastering the expeditions.'));
 $('islandLabel').textContent='Saltwind · radius '+state.radius;
 $('overdrive').textContent=boostTime>0?'ϟ '+Math.ceil(boostTime)+'s':boostCooldown>0?'ϟ '+Math.ceil(boostCooldown)+'s':'ϟ Boost';
 $('overdrive').disabled=boostCooldown>0;
 $('rotateButton').textContent='↻ '+directionNames[direction];
 $('gatherButton').className=buildType||moving?'':'chosen';
 $('buildHint').textContent=moving?'Tap a valid destination. Gather cancels the move.':buildType?buildType+' · '+costText(G.machines[buildType].cost)+' · Tap to place.':'Tap trees, rocks or ore to gather. Tap a machine to manage it. Drag to pan.';
}
$('objective').onclick=()=>navigate('Quests');
const tabIcons={Island:'▦',Explore:'⚔',Craft:'⚙',Research:'✦',Quests:'☷',Harbour:'⚓'};
function navigate(tab){
 if(expedition||fishing||salvage)return toast('Finish or leave the activity first.');
 currentTab=tab;document.body.dataset.tab=tab;
 $('islandView').classList.toggle('active',tab==='Island');
 $('contentView').classList.toggle('active',tab!=='Island');
 $('adventureView').classList.remove('active');
 $('navigation').replaceChildren(...Object.keys(tabIcons).map(name=>{
  const b=button('',()=>navigate(name),false,name===tab?'activeTab':'');
  b.append(make('span','',tabIcons[name]),document.createTextNode(name));return b;
 }));
 if(tab!=='Island')renderContent();
 renderHUD();
}
function page(title,sub){const content=$('content');content.replaceChildren(make('div','eyebrow',sub),make('h2','',title));return content;}
function card(title,desc){const c=make('article','card');c.append(make('h3','',title),make('p','',desc));return c;}
function spendAction(cost,action){if(!G.pay(state,cost))return toast('More materials needed.');action();changed();renderContent();}
function renderContent(){
 if(currentTab==='Explore')return renderExplore();
 if(currentTab==='Craft')return renderCraft();
 if(currentTab==='Research')return renderResearch();
 if(currentTab==='Quests')return renderQuests();
 if(currentTab==='Harbour')return renderHarbour();
}
function renderResearch(){
 const p=page('Research journal','Engineering the archipelago');
 for(const [id,r]of Object.entries(G.research)){
  const c=card(r.name,r.desc),done=state.tech[id],locked=r.requires&&!state.tech[r.requires];
  if(done)c.classList.add('done');
  c.append(costNode(r.cost),button(done?'✓ Researched':locked?'Requires '+G.research[r.requires].name:'Research',()=>{
   spendAction(r.cost,()=>{state.tech[id]=true;toast(id==='beacon'?'The Tide Beacon is shining. You restored the archipelago!':r.name+' unlocked!');});
  },done||locked||!G.afford(state,r.cost),done?'':'gold'));p.append(c);
 }
}
function renderCraft(){
 const p=page('The workshop','Tools, parts & upgrades');
 const recipes=[
 {name:'Cut gears',desc:'Three gears for advanced machinery.',cost:{bars:5},reward:{gears:3}},
 {name:'Hand-smelt iron',desc:'A recovery recipe when your production line is unfinished.',cost:{ore:5,wood:2},reward:{bars:2}},
 {name:'Draw wire by hand',desc:'Craft copper wire before your automated mill is ready.',cost:{copper:4},reward:{wire:2},tech:'copper'},
 {name:'Temper steel by hand',desc:'Craft a small batch for your first crystal rig.',cost:{bars:6,gel:3},reward:{steel:2},tech:'steel'}
 ];
 for(const r of recipes){const c=card(r.name,r.desc);c.append(costNode(r.cost),button('Craft · '+costText(r.reward),()=>spendAction(r.cost,()=>G.reward(state,r.reward)),!G.afford(state,r.cost)||r.tech&&!state.tech[r.tech]));p.append(c);}
 const upgrades=[
 {name:'Expedition blade',key:'weapon',max:8,cost:{bars:state.weapon*5,gel:state.weapon*4},desc:'Damage per tap. Current '+state.weapon+'.',locked:state.weapon>=3&&!state.tech.gel},
 {name:'Ship hull',key:'armour',max:5,cost:{wood:(state.armour+1)*15,bars:(state.armour+1)*4},desc:'Adds one heart to each expedition. Current bonus '+state.armour+'.'},
 {name:'Fishing rod',key:'rod',max:4,cost:{wood:(state.rod+1)*15,gel:(state.rod+1)*5},desc:'Widens the catch zone. Current level '+(state.rod+1)+'.'}
 ];
 for(const u of upgrades){const c=card(u.name,u.desc);c.append(costNode(u.cost),button(state[u.key]>=u.max?'Fully upgraded':u.locked?'Research Living foundry':'Upgrade',()=>spendAction(u.cost,()=>state[u.key]++),state[u.key]>=u.max||u.locked||!G.afford(state,u.cost)));p.append(c);}
}
function renderQuests(){
 const p=page('Island stories','A path through the wild tides');
 G.quests.forEach((q,i)=>{
  const done=state.claimed.includes(i),available=i===0||state.claimed.includes(i-1),ready=available&&q.check(state);
  const c=card((done?'✓ ':!available?'◇ ':'')+q.name,q.text);
  if(done)c.classList.add('done');
  if(q.progress){const [a,b]=q.progress(state),meter=make('div','meter');const fill=make('i');fill.style.width=Math.min(100,a/b*100)+'%';meter.append(fill);c.append(meter,make('span','muted',Math.min(a,b)+' / '+b));}
  c.append(make('div','cost','Reward · '+costText(q.reward)),button(done?'Claimed':!available?'Complete the previous story':ready?'Claim reward':q.goal,()=>{
   if(state.claimed.includes(i)||!q.check(state))return;
   state.claimed.push(i);G.reward(state,q.reward);changed();renderQuests();toast('Quest complete! '+costText(q.reward));
  },done||!ready,ready?'gold':''));p.append(c);
 });
}
function renderHarbour(){
 const p=page('Saltwind harbour','Expansion & shipping');
 let c=card('Reclaim the shoreline','Radius 5 reveals copper. Radius 7 reveals crystal. Your island can grow to radius 16.');
 const cost=G.expansion(state);c.append(costNode(cost),button(state.radius>=16?'Island fully expanded':'Expand to radius '+(state.radius+1),()=>spendAction(cost,()=>{state.radius++;toast('New shoreline reclaimed!');}),state.radius>=16||!G.afford(state,cost),'gold'));p.append(c);
 const order=G.order(state);
 c=card('Shipping order #'+(state.order+1),'Deliver a crate of supplies. Each completed order advances the harbour quest.');
 c.append(costNode(order.cost),make('p','','Payment · '+costText(order.reward)),button('Ship order',()=>spendAction(order.cost,()=>{G.reward(state,order.reward);state.order++;state.stats.orders++;toast('Shipment sent!');}),!G.afford(state,order.cost)));p.append(c);
 const trades=[{cost:{coins:10},reward:{wood:20}},{cost:{coins:10},reward:{stone:15}},{cost:{fish:2},reward:{gel:5}},{cost:{gel:10},reward:{coins:12}}];
 for(const t of trades){c=card(costText(t.reward),'Harbour exchange');c.append(costNode(t.cost),button('Trade',()=>spendAction(t.cost,()=>G.reward(state,t.reward)),!G.afford(state,t.cost)));p.append(c);}
}
function renderExplore(){
 const p=page('Beyond the shore','Expeditions & diversions');
 const intro=card('Supplies worth sailing for','Slime gel strengthens tools and insulates furnaces. Bank your loot after each wave or push ahead for tougher enemies. Sailing is free.');intro.classList.add('hero');p.append(intro);
 const areas=[
 ['Mosswater Marsh','Green slimes, gel and a little iron. A gentle place to learn.',null],
 ['Copper Mangroves','Armoured slimes carry copper and extra gel.','steel'],
 ['Prism Hollow','Fast crystal slimes. Bring an upgraded blade and hull.','crystal']
 ];
 areas.forEach(([name,desc,tech],i)=>{const locked=tech&&!state.tech[tech],c=card(name,desc);c.append(make('p','','Best wave · '+state.best[i]),button(locked?'Requires '+G.research[tech].name:'Sail · start wave 1',()=>startExpedition(i),locked,'gold'));p.append(c);});
 const salvageCard=card('The wreck of the Starling','Flip sealed cargo tiles. Five picks, hidden treasure and two lurking traps. Bank early or risk another chest.');salvageCard.append(button('Search the wreck',startSalvage));p.append(salvageCard);
 const c=card('Moonpool fishing','Time your reel in the green zone. Consecutive catches build a bonus streak. Fish can be traded for gel or used in research.');
 c.append(button('Go fishing',startFishing));p.append(c);
}
function openBuild(){
 const body=make('div','grid');
 for(const [type,def]of Object.entries(G.machines)){
  const locked=def.tech&&!state.tech[def.tech],c=card(type,def.desc);
  c.prepend(spriteElement(spriteIndex[type]??5));
  c.append(costNode(def.cost),button(locked?'Research '+G.research[def.tech].name:'Select '+type,()=>{
   buildType=type;moving=null;selected=null;$('dialog').close();renderSelection();renderHUD();
  },locked,'gold'));body.append(c);
 }
 dialog('Build your factory',body);
}
$('buildButton').onclick=openBuild;
$('gatherButton').onclick=()=>{buildType=null;moving=null;selected=null;renderHUD();renderSelection();};
$('rotateButton').onclick=()=>{
 if(selected&&state.machines[selected]){state.machines[selected].d=(state.machines[selected].d+1)%4;direction=state.machines[selected].d;changed();}
 else {direction=(direction+1)%4;renderHUD();}
};
function renderSelection(){
 const host=$('selection');host.replaceChildren();
 const m=state.machines[selected];if(!m)return;
 const def=G.machines[m.type],blocked=m.item&&m.item===def.out;
 host.append(make('strong','',m.type+' · Lv '+m.level+' · '+arrows[m.d]+' '+directionNames[m.d]));
 host.append(make('div','muted',m.paused?'Paused':m.item?'Cargo · '+G.resources[m.item]+(blocked?' · waiting for output':' · processing'):def.direct?'Producing into inventory':'Ready for input'));
 const row=make('div','row');row.append(
 button('↻ Turn',()=>{m.d=(m.d+1)%4;direction=m.d;changed();}),
 button(m.paused?'▶ Run':'Ⅱ Pause',()=>{m.paused=!m.paused;changed();}),
 button('Move',()=>{moving=selected;buildType=null;selected=null;renderSelection();renderHUD();}),
 button('More',()=>machineOptions(selected)));host.append(row);
}
function machineOptions(id){
 const m=state.machines[id];if(!m)return;
 const body=make('div','settings'),cost=G.upgradeCost(m);
 body.append(make('p','',G.machines[m.type].desc),make('p','','Upgrade speeds processing. Level '+m.level+' / 3.'),costNode(cost));
 body.append(button(m.level>=3?'Maximum level':'Upgrade',()=>{if(!G.pay(state,cost))return toast('More materials needed.');m.level++;changed();$('dialog').close();},m.level>=3||!G.afford(state,cost)));
 body.append(button('Collect cargo',()=>{if(m.item){G.reward(state,{[m.item]:1});m.item=null;m.progress=0;changed();}$('dialog').close();},!m.item));
 body.append(button('Dismantle · refund building materials',()=>{
  G.reward(state,G.machines[m.type].cost);if(m.item)G.reward(state,{[m.item]:1});delete state.machines[id];selected=null;changed();$('dialog').close();
 }));dialog(m.type,body);
}
function mapTap(x,y){
 const id=x+','+y,land=G.terrain(state,x,y),m=state.machines[id];
 if(moving){
  const source=state.machines[moving],def=G.machines[source.type];
  if(m||land==='sea'||def.terrain&&land!==def.terrain)return toast('Choose an empty '+(def.terrain||'land')+' tile.');
  state.machines[id]=source;delete state.machines[moving];moving=null;selected=id;changed();return;
 }
 if(buildType){const error=G.place(state,buildType,x,y,direction);if(error)return toast(error);changed();return;}
 if(m){selected=id;direction=m.d;renderSelection();renderHUD();return;}
 selected=null;renderSelection();if(land==='sea')return toast('Expand your shoreline at the harbour.');
 const resource={tree:'wood',rock:'stone',iron:'ore',copper:'copper',crystal:'crystal',grass:'wood'}[land];
 if(resource==='crystal'&&!state.tech.crystal)return toast('Research Prismatic engineering to gather crystals.');
 if(resource==='copper'&&!state.tech.copper)return toast('Research Copperworks to gather copper.');
 const amount=land==='tree'?3:land==='rock'?2:1;sound('gather');
 const now=performance.now();gatherCombo=now-lastGather<1800?gatherCombo+1:1;lastGather=now;
 const bonus=gatherCombo%8===0;
 G.reward(state,{[resource]:bonus?amount*3:amount});
 if(bonus){state.inventory.coins+=3;state.inventory.gel++;toast('Lucky haul! Triple gather + 3 coins + 1 gel');}
 state.stats.gather++;
 effects.push({x,y,text:'+'+(bonus?amount*3:amount)+' '+G.resources[resource],start:performance.now()});
 if(navigator.vibrate)navigator.vibrate(bonus?30:8);
 changed();
}
const canvas=$('world'),ctx=canvas.getContext('2d');
const TILE=24;
function mapOrigin(){return {x:canvas.width/2-TILE/2+pan.x,y:canvas.height/2-TILE/2+pan.y};}
function pointerPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom};}
canvas.onpointerdown=e=>{if(pointer)return;canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,p:pointerPoint(e),pan:{...pan},drag:false};};
canvas.onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=pointerPoint(e),dx=p.x-pointer.p.x,dy=p.y-pointer.p.y;if(Math.hypot(dx,dy)*zoom>9)pointer.drag=true;if(pointer.drag)pan={x:pointer.pan.x+dx,y:pointer.pan.y+dy};};
canvas.onpointerup=e=>{if(!pointer||pointer.id!==e.pointerId)return;if(!pointer.drag){const p=pointerPoint(e),o=mapOrigin();mapTap(Math.floor((p.x-o.x)/TILE),Math.floor((p.y-o.y)/TILE));}pointer=null;};
canvas.onpointercancel=()=>pointer=null;
$('zoomIn').onclick=()=>{zoom=Math.min(4.5,zoom+.3);pointer=null;};
$('zoomOut').onclick=()=>{zoom=Math.max(1.5,zoom-.3);pointer=null;};
$('center').onclick=()=>{pan={x:0,y:0};};
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.floor(x),Math.floor(y),w,h);}
function spriteElement(index){
 const el=make('span','gameSprite');
 const x=index%4,y=Math.floor(index/4);
 el.style.backgroundPosition=(x/3*100)+'% '+(y/3*100)+'%';
 return el;
}
function drawSprite(index,x,y,width,height){
 if(art.complete&&art.naturalWidth){
  const cell=art.naturalWidth/4,row=art.naturalHeight/4;
  ctx.drawImage(art,(index%4)*cell,Math.floor(index/4)*row,cell,row,x,y,width,height);
 }
}
function drawMap(time){
 if(currentTab!=='Island'||expedition||fishing||salvage)return;
 const w=Math.max(1,Math.round(canvas.clientWidth/zoom)),h=Math.max(1,Math.round(canvas.clientHeight/zoom));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.imageSmoothingEnabled=true;}
 const o=mapOrigin(),anim=time/1000;
 const water=ctx.createLinearGradient(0,0,0,h);water.addColorStop(0,'#227a80');water.addColorStop(1,'#103d58');ctx.fillStyle=water;ctx.fillRect(0,0,w,h);
 for(let y=Math.floor(-o.y/TILE)-1;y<(h-o.y)/TILE+1;y++)for(let x=Math.floor(-o.x/TILE)-1;x<(w-o.x)/TILE+1;x++){
  const px=Math.floor(o.x+x*TILE),py=Math.floor(o.y+y*TILE),land=G.terrain(state,x,y),hash=Math.abs(x*31+y*13);
  if(land==='sea'){
   rect(px+hash%12,py+8+Math.sin(anim+y)*2,7,1,'#66c7c134');
   if(hash%13===0){rect(px+9+Math.sin(anim*.4)*3,py+16,3,1,'#9de0c63a');}
   continue;
  }
  rect(px,py,24,24,['#73a76c','#76aa6e','#79ad71'][hash%3]);
  for(let i=0;i<3;i++)rect(px+(hash+i*7)%23,py+(hash+i*11)%23,1,1,'#b6d59155');
  if(G.terrain(state,x,y+1)==='sea'){rect(px,py+19,24,3,'#d6c28c');rect(px,py+22,24,3,'#9b8a5e');rect(px,py+25,24,2,'#51bbb477');}
  if(G.terrain(state,x-1,y)==='sea')rect(px,py,2,23,'#d6c28c');
  if(G.terrain(state,x+1,y)==='sea')rect(px+22,py,2,23,'#d6c28c');
  if(G.terrain(state,x,y-1)==='sea')rect(px,py,24,2,'#d6c28c');
 }
 // Separate terrain and sprite passes keep tall objects layered correctly.
 for(let y=Math.floor(-o.y/TILE)-1;y<(h-o.y)/TILE+2;y++)for(let x=Math.floor(-o.x/TILE)-1;x<(w-o.x)/TILE+1;x++){
  const px=Math.floor(o.x+x*TILE),py=Math.floor(o.y+y*TILE),land=G.terrain(state,x,y);
  if(land==='sea')continue;
  const id=x+','+y,m=state.machines[id];
  if(buildType||moving){ctx.strokeStyle='#edf5b52b';ctx.lineWidth=.4;ctx.strokeRect(px,py,24,24);}
  if(!m){if(spriteIndex[land]!==undefined)drawSprite(spriteIndex[land],px-1,py-9,27,32);continue;}
  const def=G.machines[m.type];
  ctx.fillStyle='#173d3338';ctx.beginPath();ctx.ellipse(px+12,py+20,10,3,0,0,Math.PI*2);ctx.fill();
  if(m.type==='Belt'){
   rect(px+2,py+5,20,17,'#344e4b');rect(px+4,py+7,16,12,'#182c30');
   for(let i=0;i<4;i++)rect(px+5+(i*4+Math.floor(anim*5))%15,py+8,1,10,'#9d9474');
  }else drawSprite(spriteIndex[m.type]??5,px-2,py-9,29,32);
  if(!def.direct){
   rect(px+15,py+15,9,9,'#112c31dd');ctx.font='bold 9px monospace';ctx.fillStyle='#ffe2a0';ctx.fillText(arrows[m.d],px+16,py+22);
  }
  if(m.item){
   const colors={ore:'#a5e0ed',bars:'#f6e6ba',copper:'#f0b27e',wire:'#facb83',steel:'#a4c5d6',crystal:'#dab1ff',coins:'#ffde82'};
   const move=(anim%1)*4;
   rect(px+8+move,py+11,4,4,colors[m.item]||'#a0dc85');rect(px+8+move,py+11,2,1,'#ffffffaa');
  }
  if(m.paused){rect(px+7,py+8,3,8,'#f5d89d');rect(px+13,py+8,3,8,'#f5d89d');}
  if(selected===id){ctx.strokeStyle='#ffe2a0';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,23,23);}
 }
 effects=effects.filter(e=>time-e.start<900);
 for(const e of effects){const age=(time-e.start)/900;ctx.globalAlpha=1-age;ctx.font='bold 7px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff3bb';ctx.strokeStyle='#21423c';ctx.lineWidth=2;const x=o.x+e.x*24+12,y=o.y+e.y*24-6-age*16;ctx.strokeText(e.text,x,y);ctx.fillText(e.text,x,y);ctx.textAlign='start';ctx.globalAlpha=1;}
}
function adventureScreen(){
 $('dialog').close();$('islandView').classList.remove('active');$('contentView').classList.remove('active');$('adventureView').classList.add('active');
}
function floatText(text,x,y,host=$('arena')){
 const el=make('span','hit',text);el.style.left=x+'px';el.style.top=y+'px';host.append(el);setTimeout(()=>el.remove(),500);
}
function slimeArt(color){return '<span class="slimeSprite" style="filter:drop-shadow(0 5px 3px #071e2c55)"></span>';}
function startExpedition(area){
 adventureScreen();
 expedition={area,wave:0,hearts:5+state.armour,slimes:[],spawned:0,killed:0,escaped:0,totalKills:0,loot:{gel:0},mode:'intermission',clock:0,spawnClock:0,nextId:0,damage:0,chain:0,freeze:0,combo:0,lastHit:0,powerCooldown:0};
 beginWave();
}
function beginWave(){
 const e=expedition;e.wave++;e.mode='fight';e.spawned=0;e.killed=0;e.escaped=0;e.clock=0;e.spawnClock=.8;e.target=4+e.wave*2;
 $('arena').replaceChildren();const row=make('div','row');
 row.append(button('❄ Freeze',freezeSlimes,false,'gold'),button('Retreat & bank loot',()=>finishExpedition(false)));
 $('adventureControls').replaceChildren(row);
 renderExpeditionHeader();
}
function renderExpeditionHeader(){
 const e=expedition;if(!e)return;
 $('adventureHeader').replaceChildren(make('div','eyebrow',['Mosswater Marsh','Copper Mangroves','Prism Hollow'][e.area]),make('h2','','Wave '+e.wave),make('div','','♥ '+e.hearts+' · '+e.totalKills+' defeated · Cargo '+costText(e.loot)));
}
function spawnSlime(){
 const e=expedition,boss=e.wave%5===0&&e.spawned===e.target-1;
 const hp=(2+e.area*3+Math.floor(e.wave/2))*(boss?4:1),el=button('',()=>hitSlime(slime.id));
 const slime={id:e.nextId++,x:Math.random()*.78+.01,y:-.16,hp,max:hp,speed:(.055+e.wave*.005+e.area*.014)*(boss?.65:1),el,boss};
 el.className='slime';el.setAttribute('aria-label',boss?'Slime boss':'Slime');el.innerHTML=slimeArt(boss?'#e0ac73':['#91c66c','#d5a56b','#c2a4e9'][e.area]);el.append(make('b','',hp+' HP'));
 if(boss){el.classList.add('boss');el.style.width='96px';el.style.height='90px';}else if(e.spawned%4===3){slime.speed*=1.4;el.classList.add('swift');}
 e.slimes.push(slime);e.spawned++;$('arena').append(el);
}
function hitSlime(id){
 const e=expedition;if(!e||e.mode!=='fight'||$('dialog').open)return;
 const index=e.slimes.findIndex(s=>s.id===id);if(index<0)return;
 const slime=e.slimes[index];const damage=state.weapon+e.damage;slime.hp-=damage;
 e.combo=performance.now()-e.lastHit<1400?e.combo+1:1;e.lastHit=performance.now();
 slime.el.classList.remove('struck');void slime.el.offsetWidth;slime.el.classList.add('struck');slime.el.querySelector('b').textContent=Math.max(0,slime.hp)+' HP';
 floatText('−'+damage,slime.el.offsetLeft+20,slime.el.offsetTop+10);
 if(slime.hp<=0){
  sound('pop');slime.el.remove();e.slimes.splice(index,1);e.killed++;e.totalKills++;state.stats.kills++;
  const gel=(slime.boss?5:1)+e.area;e.loot.gel+=gel;
  const extra=['ore','copper','crystal'][e.area];e.loot[extra]=(e.loot[extra]||0)+(slime.boss?3:1);
  if(e.chain>0){
   for(const other of e.slimes.slice(0,e.chain)){other.hp=Math.max(1,other.hp-1-e.damage);other.el.querySelector('b').textContent=other.hp+' HP';other.el.classList.add('struck');}
  }
  if(e.combo%5===0){e.loot.gel+=2;floatText('COMBO +2 GEL',60,100);}
  persist();renderExpeditionHeader();
 }
}
function updateExpedition(dt){
 const e=expedition;if(!e||e.mode!=='fight'||$('dialog').open)return;
 e.clock+=dt;e.spawnClock+=dt;e.freeze=Math.max(0,e.freeze-dt);e.powerCooldown=Math.max(0,e.powerCooldown-dt);
 const power=$('adventureControls').querySelector('button');if(power){power.disabled=e.powerCooldown>0;power.textContent=e.powerCooldown>0?'❄ '+Math.ceil(e.powerCooldown)+'s':'❄ Freeze';}
 if(e.spawned<e.target&&e.spawnClock>Math.max(.55,1.5-e.wave*.055)){e.spawnClock=0;spawnSlime();}
 const height=$('arena').clientHeight,width=$('arena').clientWidth;
 for(let i=e.slimes.length-1;i>=0;i--){
  const s=e.slimes[i];s.y+=dt*s.speed*(e.freeze>0?.12:1);s.el.style.left=(s.x*Math.max(1,width-96)+Math.sin(e.clock*2+s.id)*5)+'px';s.el.style.top=s.y*height+'px';
  if(s.y>.88){s.el.remove();e.slimes.splice(i,1);e.escaped++;e.hearts-=s.boss?2:1;renderExpeditionHeader();}
 }
 if(e.hearts<=0)return finishExpedition(true);
 if(e.spawned===e.target&&e.slimes.length===0){
  e.mode='intermission';state.best[e.area]=Math.max(state.best[e.area],e.wave);persist();
  const bonus=2+e.wave;e.loot.gel+=bonus;persist();
  $('arena').replaceChildren(make('div','waveBanner','Wave cleared! +'+bonus+' gel'));
  renderExpeditionHeader();
  const choices=make('div','perkChoices');
 choices.append(make('strong','','Choose a power for your next wave'));
 for(const [label,desc,kind]of [['Razor leaf','+1 damage on every tap','damage'],['Storm link','Wound an extra nearby slime','chain'],['Patch the hull','Recover 2 hearts','repair']]){
  const b=button('',()=>choosePerk(kind));b.append(make('b','',label),make('small','',desc));choices.append(b);
 }
 choices.append(button('Bank loot & sail home',()=>finishExpedition(false),false,'gold'));
 $('adventureControls').replaceChildren(choices);
 }
}
function finishExpedition(defeat){
 const e=expedition;if(!e)return;
 const loot=Object.fromEntries(Object.entries(e.loot).map(([k,n])=>[k,defeat?Math.floor(n/2):n]));
 G.reward(state,loot);expedition=null;$('arena').replaceChildren();changed();navigate('Explore');toast((defeat?'Hull breached. Half cargo recovered. ':'Returned safely! ')+costText(loot));
}
function startFishing(){
 adventureScreen();fishing={phase:Math.random()*6,pos:0,zone:.32+Math.random()*.28,width:.18+state.rod*.035,streak:0,catches:0,ready:true,cooldown:0};
 $('adventureHeader').replaceChildren(make('div','eyebrow','Moonpool Cove'),make('h2','','Wait for the green'),make('p','muted','Tap REEL as the gold marker crosses the green zone.'));
 const art=make('div','fishArt',''),track=make('div','fishingTrack'),zone=make('div','catchZone'),bobber=make('div','bobber');
 track.append(zone,bobber);$('arena').replaceChildren(art,track,make('p','muted','Tap timing · no bait needed'));
 const row=make('div','row');row.append(button('REEL',reelFish,false,'gold'),button('Sail home',()=>{fishing=null;navigate('Explore');}));
 $('adventureControls').replaceChildren(row,make('p','muted','Catch streak · 0'));
 updateFishing(0);
}
function updateFishing(dt){
 if(!fishing||$('dialog').open)return;const f=fishing;f.phase+=dt*(2.5+Math.min(f.streak,5)*.12);f.pos=(Math.sin(f.phase)+1)/2;
 if(!f.ready){f.cooldown-=dt;if(f.cooldown<=0)f.ready=true;}
 const track=$('arena').querySelector('.fishingTrack');if(!track)return;
 track.querySelector('.catchZone').style.left=f.zone*100+'%';track.querySelector('.catchZone').style.width=f.width*100+'%';track.querySelector('.bobber').style.left=f.pos*100+'%';
}
function reelFish(){
 const f=fishing;if(!f||!f.ready)return;
 f.ready=false;f.cooldown=.65;
 if(f.pos>=f.zone&&f.pos<=f.zone+f.width){
  f.streak++;const count=f.streak%3===0?2:1;f.catches+=count;state.inventory.fish+=count;state.stats.fish+=count;changed();toast('Caught '+count+' fish!'+(count===2?' Streak bonus!':''));
 }else{f.streak=0;toast('It slipped away. Try the next pass.');}
 f.zone=.15+Math.random()*.45;$('adventureControls').lastChild.textContent='Catch streak · '+f.streak+' · Fish this visit · '+f.catches;
}
$('settingsButton').onclick=()=>{
 const body=make('div','settings');
 body.append(make('p','','Tideforge · Treasure Tides v4. Your island saves automatically on this device. Factory progress continues for up to two hours away.'),
 button('Inventory & cargo',showInventory),
 button('Sound · '+(audioEnabled?'on':'off'),()=>{audioEnabled=!audioEnabled;toast('Sound '+(audioEnabled?'on':'off'));$('dialog').close();}),
 button('How to build',showHelp),
 button('Export save',exportSave),
 button('Import save',()=>$('importFile').click()),
 button('Install app',async()=>{
  if(installPrompt){await installPrompt.prompt();installPrompt=null;}
  else toast('In your browser menu choose Install app or Add to home screen. Open the website online once for offline play.');
 }),
 button('Start a new island',()=>{
  if(expedition||fishing||salvage)return toast('Leave the activity before starting over.');
  const confirm=make('div','settings');confirm.append(make('p','','This clears this island. Export your save first if you want to keep it.'),button('Export current save',exportSave),button('Confirm new island',()=>{state=G.fresh();pan={x:0,y:0};buildType=null;selected=null;moving=null;changed();$('dialog').close();navigate('Island');}));dialog('Start over?',confirm);
 }));
 if(storageError)body.prepend(make('p','notice','Device saving could not be accessed. Use Export save to keep your island.'));
 dialog('Captain’s log',body);
};
function showHelp(){
 const body=make('div');
 body.append(button('Place my starter factory',starterFactory,false,'gold'),make('p','','Tap natural tiles to gather. Green trees give timber, grey rocks give stone, blue seams give iron. Materials never run out.'),
 make('p','','Open Build, choose a machine, then tap a valid tile. Use the direction button to choose its output before placing. Stay in build mode to place several.'),
 make('p','','First line: the blue iron seam two tiles left of the island center → Drill → Furnace → Depot. Face all arrows east. Belts can bridge longer gaps.'),
 make('p','','Switch to Gather / select and tap a machine. Turn changes that machine immediately. Move relocates it. More opens upgrades, cargo collection and dismantling. Dismantling refunds its building cost.'),
 make('p','','Sawmills need trees, quarries need rocks. These two send output straight to inventory. Processing machines need incoming cargo and a clear output.'),
 make('p','','Explore for slime gel and fish. Craft gears and improve tools. Research unlocks the next factory tier. Harbour expands the island and trades supplies. Quests guide the campaign.'),
 button('Build on my island',()=>{$('dialog').close();if(!expedition&&!fishing&&!salvage)navigate('Island');},false,'gold'));
 dialog('Your island handbook',body);
}
function exportSave(){
 persist();const url=URL.createObjectURL(new Blob([JSON.stringify({...state,pendingLoot:pendingCargo()},null,2)],{type:'application/json'})),a=make('a');
 a.href=url;a.download='Tideforge-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Save file exported.');
}
$('importFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>2e6)throw Error('Large file');
  const imported=G.normalize(JSON.parse(await file.text()));
  if(expedition||fishing||salvage)return toast('Leave your activity before importing.');
  const body=make('div','settings');
  body.append(make('p','','Replace this island with the imported save?'),button('Export current save first',exportSave),button('Use imported island',()=>{state=imported;state.savedAt=Date.now();buildType=null;selected=null;moving=null;pan={x:0,y:0};changed();$('dialog').close();navigate('Island');toast('Island restored.');}));
  dialog('Import island',body);
 }catch{toast('That file is not a valid Tideforge save.');}
 finally{e.target.value='';}
};
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){persist();if(expedition){expedition.suspended=true;}return;}
 // Time spent hidden is handled exactly once, independently of animation frames.
 const seconds=G.offline(state);tickAccumulator=0;lastFrame=performance.now();
 if(expedition)expedition.suspended=false;
 renderHUD();if(seconds>=60)toast('Factory worked for '+Math.floor(seconds/60)+' minutes while away.');
});
window.addEventListener('pagehide',persist);
function frame(now){
 const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(!document.hidden){
  tickAccumulator+=dt;saveAccumulator+=dt;
  if(tickAccumulator>=1){tickAccumulator-=1;G.step(state);if(boostTime>0){G.step(state);G.step(state);}renderHUD();if(selected)renderSelection();if(currentTab!=='Island'&&!expedition&&!fishing&&!salvage)renderContent();}
  if(saveAccumulator>=5){saveAccumulator=0;persist();}
  boostTime=Math.max(0,boostTime-dt);boostCooldown=Math.max(0,boostCooldown-dt);updateExpedition(dt);updateFishing(dt);drawMap(now);
 }
 requestAnimationFrame(frame);
}

function sound(kind){
 if(!audioEnabled)return;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  if(!audioContext)audioContext=new Audio();
  if(audioContext.state==='suspended')audioContext.resume();
  const osc=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
  osc.type=kind==='pop'?'sine':'triangle';osc.frequency.setValueAtTime(kind==='pop'?550:kind==='gather'?680:380,now);osc.frequency.exponentialRampToValueAtTime(kind==='pop'?180:kind==='gather'?920:440,now+.09);
  gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+.12);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.13);
 }catch{}
}
$('resourceBar').onclick=showInventory;
function showInventory(){
 const body=make('div','inventoryGrid');
 for(const [k,label]of Object.entries(G.resources)){body.append(make('div','resource',icons[k]+' '+label+' · '+state.inventory[k]));}
 dialog('Inventory & cargo',body);
}
function starterFactory(){
 if(Object.keys(state.machines).length)return toast('Your island already has machines. Use Build to extend it.');
 const total={wood:20,stone:11};
 if(!G.afford(state,total))return toast('Gather 20 timber and 11 stone first.');
 for(const [type,x]of [['Drill',-2],['Furnace',-1],['Depot',0]])G.place(state,type,x,0,0);
 $('dialog').close();navigate('Island');changed();toast('Your first production line is running!');
}
function freezeSlimes(){if(!expedition||expedition.powerCooldown>0||expedition.mode!=='fight')return;expedition.freeze=3;expedition.powerCooldown=12;toast('Frost burst! Slimes slowed for 3 seconds.');}
function choosePerk(kind){
 const e=expedition;if(!e||e.mode!=='intermission')return;
 if(kind==='damage')e.damage++;
 if(kind==='chain')e.chain++;
 if(kind==='repair')e.hearts=Math.min(5+state.armour,e.hearts+2);
 beginWave();
}
$('overdrive').onclick=()=>{
 if(boostCooldown>0)return;
 boostTime=20;boostCooldown=60;renderHUD();toast('Factory overdrive! Triple production for 20 seconds.');
};
function startSalvage(){
 adventureScreen();const tiles=Array.from({length:12},(_,i)=>i<2?'trap':i<5?'rare':'supplies');
 for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
 salvage={tiles,revealed:[],picks:5,traps:0,loot:{},done:false};renderSalvage();
}
function renderSalvage(){
 const s=salvage;if(!s)return;
 $('adventureHeader').replaceChildren(make('div','eyebrow','The wreck of the Starling'),make('h2','',s.done?'Your salvage haul':'What lies beneath?'),make('p','',s.picks+' picks · '+s.traps+'/2 traps · Cargo '+(costText(s.loot)||'empty')));
 const grid=make('div','salvageGrid');
 s.tiles.forEach((kind,i)=>{
  const revealed=s.revealed.includes(i),b=button(revealed?(kind==='trap'?'✕':kind==='rare'?'✦':'▣'):'?',()=>revealSalvage(i),revealed||s.done,'cargoTile '+(revealed?kind:'sealed'));
  b.setAttribute('aria-label','Cargo tile '+(i+1));grid.append(b);
 });
 $('arena').replaceChildren(grid);
 const row=make('div','row');row.append(button(s.done?'Collect & sail home':'Bank cargo & leave',finishSalvage,false,'gold'));
 if(s.done)row.append(button('Search another wreck',()=>{finishSalvage(false);startSalvage();}));
 $('adventureControls').replaceChildren(row);
}
function revealSalvage(i){
 const s=salvage;if(!s||s.done||s.revealed.includes(i))return;s.revealed.push(i);s.picks--;
 const kind=s.tiles[i];
 if(kind==='trap'){s.traps++;toast('A flooded compartment! Two traps halve your cargo.');}
 else {
  const drop=kind==='rare'?{gel:3+Math.floor(Math.random()*4),gears:1,coins:4}:{wood:5,stone:3,coins:2};
  for(const [k,n]of Object.entries(drop))s.loot[k]=(s.loot[k]||0)+n;
  toast(kind==='rare'?'Rare supply cache! +gel, gears and coins':'Supplies recovered!');
 }
 s.done=s.picks===0||s.traps>=2;renderSalvage();persist();
}
function finishSalvage(goHome=true){
 if(!salvage)return;
 const loot=Object.fromEntries(Object.entries(salvage.loot).map(([k,n])=>[k,salvage.traps>=2?Math.floor(n/2):n]));
 G.reward(state,loot);salvage=null;changed();if(goHome){navigate('Explore');toast('Cargo banked. '+(costText(loot)||'Try another wreck.'));}
}
navigate('Island');renderHUD();persist();requestAnimationFrame(frame);
if(!loaded)showHelp();
else if(offlineSeconds>=60)toast('Welcome back. Your factory worked for '+Math.floor(offlineSeconds/60)+' minutes.');
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').then(reg=>{
 reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)toast('Update ready. Reopen the app after saving.');});});
}).catch(()=>toast('Offline cache unavailable. Your save still works while online.'));
