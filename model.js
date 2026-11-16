/* Shared simulation. One item advances at most one tile per production step. */
(function (root) {
'use strict';
const resources = {wood:'Timber',stone:'Stone',ore:'Iron ore',bars:'Iron ingots',gel:'Slime gel',copper:'Copper ore',wire:'Copper wire',crystal:'Crystal',gears:'Gears',steel:'Steel',fish:'Fish',coins:'Coins'};
const machines = {
 Drill:{cost:{wood:8,stone:3},time:3,out:'ore',terrain:'iron',desc:'Extracts iron ore. Connect its arrow to a furnace or depot.'},
 Belt:{cost:{wood:1},time:1,desc:'Carries items one tile in the arrow direction.'},
 Furnace:{cost:{wood:8,stone:6},time:4,input:'ore',out:'bars',desc:'Smelts iron ore into ingots. No fuel needed.'},
 Depot:{cost:{wood:4,stone:2},time:1,desc:'Delivers incoming cargo to your inventory.'},
 Sawmill:{cost:{wood:12,stone:4},time:5,out:'wood',terrain:'tree',direct:true,desc:'Automatically sends timber to your inventory.'},
 Quarry:{cost:{wood:10,stone:4},time:5,out:'stone',terrain:'rock',direct:true,desc:'Automatically sends stone to your inventory.'},
 'Gel furnace':{cost:{bars:12,gel:15,stone:12},time:2,input:'ore',out:'bars',tech:'gel',desc:'Slime insulation doubles iron smelting speed.'},
 'Copper drill':{cost:{bars:10,gears:3},time:3,out:'copper',terrain:'copper',tech:'copper',desc:'Extracts copper ore for wire production.'},
 'Wire mill':{cost:{bars:12,gears:4},time:4,input:'copper',out:'wire',tech:'copper',desc:'Draws copper ore into wire.'},
 'Steel forge':{cost:{bars:20,wire:8,gel:12},time:6,input:'bars',out:'steel',tech:'steel',desc:'Tempers iron into steel.'},
 'Crystal rig':{cost:{steel:12,wire:15,gears:6},time:8,out:'crystal',terrain:'crystal',tech:'crystal',desc:'Harvests the outer island’s crystals.'},
 Mint:{cost:{bars:15,wire:5},time:5,input:'bars',out:'coins',tech:'trade',desc:'Stamps each incoming ingot into three coins.'}
};
const research = {
 gel:{name:'Living foundry',cost:{bars:8,gel:10},desc:'Unlock gel furnaces and stronger expedition weapons.'},
 copper:{name:'Copperworks',cost:{bars:15,stone:20},desc:'Unlock copper drills and wire mills.'},
 trade:{name:'Harbour commerce',cost:{wire:8,fish:3},requires:'copper',desc:'Unlock the mint and larger shipping orders.'},
 steel:{name:'Steel age',cost:{wire:15,gel:20,bars:20},requires:'copper',desc:'Unlock steel forges and the mangrove expedition.'},
 crystal:{name:'Prismatic engineering',cost:{steel:20,wire:25},requires:'steel',desc:'Unlock crystal rigs and the crystal expedition.'},
 beacon:{name:'The Tide Beacon',cost:{crystal:25,steel:30,wire:40,gel:35},requires:'crystal',desc:'Restore the beacon. Complete the main campaign and keep building.'}
};
const quests = [
 {name:'A place to begin',text:'Tap trees and rocks 12 times to stock your first workshop.',check:s=>s.stats.gather>=12,reward:{wood:10,stone:5},goal:'Gather 12 times',progress:s=>[s.stats.gather,12]},
 {name:'First sparks',text:'Build a Drill → Furnace → Depot line. Each arrow must face the next machine.',check:s=>s.stats.bars>=5,reward:{bars:5,coins:15},goal:'Deliver 5 iron ingots',progress:s=>[s.stats.bars,5]},
 {name:'A living island',text:'Place a sawmill on a tree and a quarry on grey rock.',check:s=>['Sawmill','Quarry'].every(t=>Object.values(s.machines).some(m=>m.type===t)),reward:{wood:20,stone:15},goal:'Build both gatherers'},
 {name:'Marsh patrol',text:'Sail to Mosswater Marsh. Tap slimes before they reach the bottom.',check:s=>s.stats.kills>=12,reward:{gel:12,coins:25},goal:'Defeat 12 slimes',progress:s=>[s.stats.kills,12]},
 {name:'Gel-powered',text:'Research Living foundry, then build a Gel furnace.',check:s=>Object.values(s.machines).some(m=>m.type==='Gel furnace'),reward:{gears:5,bars:10},goal:'Build a Gel furnace'},
 {name:'An angler’s supper',text:'At the fishing cove, tap REEL when the marker crosses the green zone.',check:s=>s.stats.fish>=5,reward:{fish:5,coins:30},goal:'Catch 5 fish',progress:s=>[s.stats.fish,5]},
 {name:'Beyond iron',text:'Research Copperworks, expand to radius 5 and automate wire.',check:s=>s.stats.wire>=10,reward:{wire:10,gears:8},goal:'Deliver 10 wire',progress:s=>[s.stats.wire,10]},
 {name:'Reliable shipping',text:'Fulfil harbour orders for coins and research Harbour commerce.',check:s=>s.stats.orders>=3&&s.tech.trade,reward:{coins:70,gel:15},goal:'Complete 3 orders and research commerce'},
 {name:'Into the mangroves',text:'Research Steel age and survive at least wave 3 in the mangroves.',check:s=>s.best[1]>=3,reward:{steel:10,gel:20},goal:'Clear mangrove wave 3'},
 {name:'Hardened industry',text:'Send iron into a Steel forge and deliver the output to a depot.',check:s=>s.stats.steel>=15,reward:{steel:10,wire:15},goal:'Deliver 15 steel',progress:s=>[s.stats.steel,15]},
 {name:'Light in the deep',text:'Expand to radius 7. Place crystal rigs on the purple seams.',check:s=>s.stats.crystal>=20,reward:{crystal:10,coins:100},goal:'Deliver 20 crystals',progress:s=>[s.stats.crystal,20]},
 {name:'Bring them home',text:'Finish The Tide Beacon research to restore the archipelago’s lighthouse.',check:s=>!!s.tech.beacon,reward:{coins:500,gears:25},goal:'Restore the beacon'}
];
function fresh(){return {version:3,inventory:{wood:35,stone:18,ore:0,bars:0,gel:0,copper:0,wire:0,crystal:0,gears:0,steel:0,fish:0,coins:0},radius:4,machines:{},tech:{},claimed:[],stats:{gather:0,kills:0,bars:0,wire:0,steel:0,crystal:0,fish:0,orders:0},best:[0,0,0],weapon:1,armour:0,rod:0,savedAt:Date.now(),ticks:0,order:0};}
function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid save');
 const s=fresh();
 if(raw.version===3){
  for(const k of Object.keys(resources))s.inventory[k]=bounded(raw.inventory?.[k],0,1e9);
  s.radius=bounded(raw.radius,4,16);s.weapon=bounded(raw.weapon,1,8);s.armour=bounded(raw.armour,0,5);s.rod=bounded(raw.rod,0,4);
  for(const k of Object.keys(research))s.tech[k]=raw.tech?.[k]===true;
  s.claimed=Array.isArray(raw.claimed)?[...new Set(raw.claimed.filter(n=>Number.isInteger(n)&&n>=0&&n<quests.length))]:[];
  for(const k of Object.keys(s.stats))s.stats[k]=bounded(raw.stats?.[k],0,1e9);
  s.best=s.best.map((_,i)=>bounded(raw.best?.[i],0,999));
  s.order=bounded(raw.order,0,1e6);
 }else{
  if(!raw.machines||typeof raw.radius!=='number')throw Error('Unrecognized save');
  for(const k of Object.keys(resources))s.inventory[k]=bounded(raw[k],0,1e9);
  s.radius=bounded(raw.radius,4,16);
 }
 for(const [id,m] of Object.entries(raw.machines||{})){
  if(!/^-?\d+,-?\d+$/.test(id)||!machines[m.type])continue;
  const [x,y]=id.split(',').map(Number);
  if(Math.abs(x)>16||Math.abs(y)>16)continue;
  s.machines[id]={type:m.type,d:bounded(m.d,0,3),level:bounded(m.level,1,3),item:resources[m.item==='ingot'?'bars':m.item]?(m.item==='ingot'?'bars':m.item):null,progress:0,paused:!!m.paused};
 }
 if(raw.version===3&&raw.pendingLoot){for(const k of ['gel','ore','copper','crystal'])s.inventory[k]+=bounded(raw.pendingLoot[k],0,100000);}
 s.savedAt=Number.isFinite(raw.savedAt)?Math.min(Date.now(),raw.savedAt):Date.now();
 return s;
}
function bounded(v,min,max){return Number.isFinite(v)?Math.max(min,Math.min(max,Math.floor(v))):min;}
function terrain(s,x,y){
 if(x*x+y*y>s.radius*s.radius+2)return 'sea';
 if(x===-2&&y===0)return 'iron';
 if(x===0&&y===-2)return 'tree';
 if(x===2&&y===-2)return 'rock';
 const hash=Math.abs(x*19+y*37);
 if(Math.hypot(x,y)>=6&&hash%5===0)return 'crystal';
 if(Math.hypot(x,y)>=4&&hash%4===0)return 'copper';
 if(hash%11===2)return 'iron';
 if(hash%7===3)return 'rock';
 return hash%4===2?'tree':'grass';
}
function afford(s,cost){return Object.entries(cost).every(([k,n])=>s.inventory[k]>=n);}
function pay(s,cost){if(!afford(s,cost))return false;for(const [k,n]of Object.entries(cost))s.inventory[k]-=n;return true;}
function reward(s,items,produced=false){for(const [k,n] of Object.entries(items)){s.inventory[k]+=n;if(produced&&k in s.stats)s.stats[k]+=n;}}
function place(s,type,x,y,d){
 const def=machines[type],id=x+','+y;
 if(!def)return 'Unknown machine';
 if(s.machines[id])return 'Tile occupied. Select it to move or dismantle.';
 const land=terrain(s,x,y);
 if(land==='sea')return 'Expand your island at the harbour.';
 if(def.tech&&!s.tech[def.tech])return 'Research '+research[def.tech].name+' first.';
 if(def.terrain&&land!==def.terrain)return 'Needs a '+def.terrain+' tile.';
 if(!pay(s,def.cost))return 'You need more materials.';
 s.machines[id]={type,d,level:1,item:null,progress:0,paused:false};return null;
}
function step(s){
 s.ticks++;
 const transfers=[];
 for(const [id,m]of Object.entries(s.machines)){
  if(m.paused)continue;
  const def=machines[m.type];
  m.progress++;
  const duration=Math.max(1,Math.ceil(def.time/m.level));
  if(m.progress<duration)continue;
  if(def.direct){reward(s,{[def.out]:m.level},true);m.progress=0;continue;}
  if(!def.input&&def.out&&!m.item){m.item=def.out;m.progress=0;continue;}
  if(def.input&&m.item===def.input){m.item=def.out;m.progress=0;continue;}
  if(!m.item||def.input&&m.item!==def.out)continue;
  const [x,y]=id.split(',').map(Number),[dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][m.d],target=x+dx+','+(y+dy),n=s.machines[target];
  if(!n||n.paused)continue;
  const nd=machines[n.type];
  if(n.type==='Depot'){transfers.push({id,target,deposit:true});continue;}
  if(n.item||nd.direct||!nd.input&&n.type!=='Belt')continue;
  if(nd.input&&nd.input!==m.item)continue;
  transfers.push({id,target});
 }
 const occupied=new Set();
 for(const t of transfers){
  if(occupied.has(t.target))continue;
  const m=s.machines[t.id],n=s.machines[t.target];if(!m.item)continue;
  if(t.deposit){reward(s,{[m.item]:m.item==='coins'?3:1},true);}
  else {n.item=m.item;n.progress=0;}
  m.item=null;m.progress=0;occupied.add(t.target);
 }
}
function offline(s,now=Date.now()){
 const seconds=Math.min(7200,Math.max(0,Math.floor((now-s.savedAt)/1000)));
 for(let i=0;i<seconds;i++)step(s);
 s.savedAt=now;return seconds;
}
function expansion(s){return {wood:10*(s.radius-2),bars:5*(s.radius-3),stone:8*(s.radius-3)};}
function upgradeCost(m){return {bars:4*m.level,gel:3*m.level};}
function order(s){const list=[
 {cost:{wood:25,stone:12},reward:{coins:20,ore:6}},
 {cost:{bars:8},reward:{coins:35,gears:2}},
 {cost:{fish:3,gel:8},reward:{coins:45,bars:5}},
 {cost:{wire:8,wood:20},reward:{coins:65,gears:4}}
 ];return list[s.order%(s.tech.trade?4:3)];}
const api={resources,machines,research,quests,fresh,normalize,terrain,afford,pay,reward,place,step,offline,expansion,upgradeCost,order};
if(typeof module!=='undefined')module.exports=api;root.Game=api;
})(globalThis);
