const BINARY_COPY = Object.freeze({
  en: Object.freeze({
    centerOne: "center 1",
    centerTwo: "center 2",
    condition: "condition",
    measurementHint: "click the circle to change b and φ",
    centerInside: "Center inside cylinder",
    viewAlongG: "view along g",
    circleArea: "The circle marks the allowed center region, not particle sizes."
  }),
  ru: Object.freeze({
    centerOne: "центр 1",
    centerTwo: "центр 2",
    condition: "условие",
    measurementHint: "щелчок по кругу меняет b и Φ",
    centerInside: "Центр внутри цилиндра",
    viewAlongG: "вид вдоль g",
    circleArea: "Круг задаёт область допустимых центров, не размеры частиц."
  })
});

function binaryCopy(locale, key) {
  const copy = BINARY_COPY[locale] || BINARY_COPY.ru;
  return copy[key] || BINARY_COPY.ru[key] || key;
}

import {Vec3,Camera3D,Scene3D,ChalkRenderer3D,OrbitControls3D,clamp} from '../../lib/chalkish/src/collision-3d.js';
import {CHALK_FONT_STACK,strokeChalkPath2D as chalkStroke} from '../../lib/chalkish/src/chalk.js';
import {POTENTIALS,potential,radialForce,effectivePotential,hsAngle,vssAngle,vssDcs,vhsDiameter,labFromRelative,mulberry32,sampleDisk,scatterEnsemble,criticalOrbit,solveTrajectory,hardSphereTrajectory,trajectoryAt,deflectionCurve,areaBinnedDcs} from './physics.js';
import {CHAPTERS,setChapterLanguage} from './chapters.js';
import {bindLabLanguage,withCommonTranslations} from '../lab-i18n.js';

const i18n=bindLabLanguage(withCommonTranslations({
  en:{'page.documentTitle':'Binary collision · Chalkish','page.title':'Binary collision','nav.course':'course page','controls.showPrecision':'Show exact values','controls.hidePrecision':'Hide exact values','camera.volume':'Volume view','camera.plane':'Collision plane','camera.front':'View along incoming velocity','camera.projection':'Toggle projection','stage.play':'Play','stage.pause':'Pause','stage.rewind':'Return to start','stage.resetView':'Return to start','stage.enterFullscreen':'Enter fullscreen','stage.exitFullscreen':'Exit fullscreen','transport.timeline':'Timeline','transport.speed':'Playback speed','locale.label':'Language'},
  ru:{'page.documentTitle':'Бинарное столкновение · Chalkish','page.title':'Бинарное столкновение','nav.course':'страница курса','controls.showPrecision':'Показать точные значения','controls.hidePrecision':'Скрыть точные значения','camera.volume':'Объёмный вид','camera.plane':'В плоскости столкновения','camera.front':'Смотреть вдоль входящей скорости','camera.projection':'Переключить проекцию','stage.play':'Пуск','stage.pause':'Пауза','stage.rewind':'В начало движения','stage.resetView':'В начало движения','stage.enterFullscreen':'Полный экран','stage.exitFullscreen':'Выйти из полного экрана','transport.timeline':'Ход опыта','transport.speed':'Скорость воспроизведения','locale.label':'Язык'},
}));
setChapterLanguage(i18n.language);

const $=id=>document.getElementById(id),V=Vec3,PI=Math.PI,TAU=2*PI,DEG=PI/180;
let C={ink:'#f4f0df',dim:'#b9c4b9',muted:'#a4b3a5',line:'#e9eed55e',cyan:'#72dce5',gold:'#efd677',purple:'#c5b2dd',red:'#ef8f7c',bg:'#0c1a14'};
const INITIAL={chapter:0,step:0,model:'hs',b:.65,E:1,phi:18,n:12,mass:1,width:.1,time:.4,count:800,seed:73129,alpha:1.6,omega:.75,collisionModel:'hs',compare:false,wrongSampling:false,explore:false,plotMode:'deflection'};
const state={...INITIAL};let playing=false,dirty=true,lastFrame=0,frameId=0,plotGeometry=null,viewMode='3d',manualCamera=false;
const trajectoryCache=new Map(),curveCache=new Map(),ensembleCache=new Map();let result=null,curve=null,ensemble=null,compareResults=[];
const camera=new Camera3D({yaw:-.36,pitch:.24,zoom:1.12,target:[0,.22,0]}),scene=new Scene3D();
const renderer=new ChalkRenderer3D($('stage'),{camera,background:C.bg,onLayout:()=>{dirty=true;}});
const controls=new OrbitControls3D($('stage'),camera,()=>{manualCamera=true;viewMode='free';updateCameraButtons();dirty=true;},pickStage);
const plotContext=$('plot').getContext('2d',{alpha:false});
const plotObserver=new ResizeObserver(()=>{const r=$('plot').getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);$('plot').width=Math.round(r.width*d);$('plot').height=Math.round(r.height*d);dirty=true;});plotObserver.observe($('plot'));
const fmt=(x,n=2)=>Number.isFinite(x)?x.toFixed(n).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1'):'?';
const ang=x=>fmt(x/DEG,1)+'°';
const scientific=x=>x===0?'0':x.toExponential(1);
const chapter=()=>CHAPTERS[state.chapter],step=()=>chapter().steps[state.step];
const eb=()=>[0,Math.cos(state.phi*DEG),Math.sin(state.phi*DEG)];
const world=(x,y)=>[x,y*Math.cos(state.phi*DEG),y*Math.sin(state.phi*DEG)];
const direction=(chi,phi=state.phi*DEG)=>[Math.cos(chi),Math.sin(chi)*Math.cos(phi),Math.sin(chi)*Math.sin(phi)];
const params=()=>({model:state.model,E:state.E,b:state.b,n:state.n});
const dsmcDiameter=()=>state.chapter===8&&state.collisionModel!=='hs'?vhsDiameter(Math.sqrt(2*state.E),state.omega):1;
const dsmcAlpha=()=>state.chapter===8&&state.collisionModel==='vss'?state.alpha:1;
function cached(map,key,fn,max=24){if(map.has(key))return map.get(key);const value=fn();map.set(key,value);if(map.size>max)map.delete(map.keys().next().value);return value;}
function compute(){
  const p=params();
  result=cached(trajectoryCache,JSON.stringify(p),()=>state.chapter<5||state.chapter>6?hardSphereTrajectory(state.b,state.E):solveTrajectory(p));
  if(state.chapter===6){const bp=state.model==='hs'?1:3.2;const ck=JSON.stringify([state.model,state.E,state.n,bp]);curve=cached(curveCache,ck,()=>deflectionCurve({...p,bmax:bp,count:200,panels:700}),8);}
  compareResults=[];
  if(state.compare&&(state.chapter===5||state.chapter===6))for(const model of ['hs','ipl','sutherland','lj','coulomb']){
    if(model===state.model)continue;const pp={...p,model};compareResults.push(cached(trajectoryCache,JSON.stringify(pp),()=>solveTrajectory(pp)));
  }
  if(state.chapter>=7){
    const d=dsmcDiameter(),alpha=dsmcAlpha(),key=JSON.stringify([state.count,state.seed,d,alpha,state.wrongSampling]);
    ensemble=cached(ensembleCache,key,()=>{
      const data=scatterEnsemble(state.count,{d,alpha,seed:state.seed,bins:18});
      if(state.wrongSampling){const random=mulberry32(state.seed);data.hits=Array.from({length:state.count},()=>{const b=d*random(),phi=TAU*random(),chi=vssAngle(b,d,alpha);return {b,phi,chi,mu:Math.cos(chi),dir:direction(chi,phi)};});}
      return data;
    },8);
  }
}
function setView(mode,force=false){
  viewMode=mode;manualCamera=false;camera.target=[0,.22,0];camera.zoom=state.chapter===3?1.06:1.12;
  if(mode==='front'){camera.yaw=-PI/2;camera.pitch=0;camera.zoom=state.chapter===1?1.25:1;}
  else if(mode==='plane'){const ph=state.phi*DEG;camera.yaw=Math.cos(ph)>=0?0:PI;camera.pitch=Math.asin(-Math.sin(ph));}
  else {camera.yaw=state.chapter===1?-.65:state.chapter===4||state.chapter>=7?-.59:-.36;camera.pitch=state.chapter===4||state.chapter>=7?.26:.24;}
  camera.update();updateCameraButtons();dirty=true;
}
function updateCameraButtons(){for(const [id,mode] of [['view3d','3d'],['viewPlane','plane'],['viewFront','front']]){$(id).classList.toggle('active',viewMode===mode);$(id).setAttribute('aria-pressed',viewMode===mode);}$('perspective').setAttribute('aria-pressed',camera.projection==='perspective');}
function applyLesson(c,s,restore=null){
  state.chapter=clamp(c,0,8);state.step=clamp(s,0,2);playing=false;
  const cdata=chapter(),sdata=step();Object.assign(state,{...INITIAL,chapter:state.chapter,step:state.step},cdata.defaults);
  for(const key of ['model','E','b','compare','collisionModel'])if(key in sdata)state[key]=sdata[key];
  if(sdata.orbit)state.b=criticalOrbit(state.E).b*.9999;
  if(state.chapter===2){const a=Math.sqrt(1-state.b**2);state.time=(5-a)/(10-a);}
  if(restore)Object.assign(state,restore);
  updateText();syncControls();compute();setView(sdata.view||'3d');updateTransport();dirty=true;
}
function navigate(delta,wholeChapter=false){
  if(wholeChapter){applyLesson(clamp(state.chapter+delta,0,8),0);return;}
  const page=clamp(state.chapter*3+state.step+delta,0,26);applyLesson(Math.floor(page/3),page%3);
}
function updateText(){
  $('lessonTitle').innerHTML=chapter().title;
  $('stepTitle').textContent=`${state.step+1}. ${step().title}`;$('explanation').innerHTML=step().text;$('equations').innerHTML=step().eq;$('observation').textContent=step().note;
  $('pageCount').textContent=`${String(state.chapter*3+state.step+1).padStart(2,'0')} / 27`;
  $('prevButton').disabled=state.chapter===0&&state.step===0;$('nextButton').disabled=state.chapter===8&&state.step===2;
  $('prevButton').textContent='‹';$('nextButton').textContent='›';
  document.querySelectorAll('.chapter-button').forEach((el,i)=>{el.classList.toggle('active',i===state.chapter);el.setAttribute('aria-current',i===state.chapter?'step':'false');});
  $('steps').innerHTML=chapter().steps.map((s,i)=>`<button data-step="${i}" class="${i===state.step?'active':i<state.step?'complete':''}" aria-label="Шаг ${i+1}: ${s.title}" title="${s.title}" ${i===state.step?'aria-current="step"':''}></button>`).join('');
  $('plotSwitch').hidden=state.chapter!==6;
}
function syncControls(){
  const c=state.chapter,explore=state.explore;
  const visible={model:c===5||c===6,b:c!==8&&(c!==7||state.step===0),energy:c===5||c===6||c===8,phi:c!==8&&c!==7&&(c!==0||state.step===2||explore),mass:c===0&&state.step<2,width:c===4||(c===7&&state.step===0),power:(c===5||c===6)&&state.model==='ipl',collisionModel:c===8,alpha:c===8&&state.collisionModel==='vss',omega:c===8&&state.collisionModel!=='hs',count:c>=7};
  for(const [key,value]of Object.entries(visible))$(key+'Control').hidden=!value;
  $('compareControl').hidden=c!==5&&c!==6;$('presets').hidden=c!==6;$('wrongControl').hidden=c!==7;
  $('b').max=(c===5||c===6)&&state.model!=='hs'?3.1:c===1?1.65:c>=7?1:c===4?.98:1.15;
  $('b').min=c===4?.02:0;state.b=clamp(state.b,+$('b').min,+$('b').max);
  $('bLabel').textContent=c===8?'b / d(g)':c===5||c===6?'b / ℓ₀':'b / d';
  const inputs={model:state.model,b:state.b,energy:Math.log10(state.E),phi:state.phi,mass:state.mass,width:state.width,power:state.n,alpha:state.alpha,omega:state.omega,count:state.count,collisionModel:state.collisionModel};
  for(const [id,value]of Object.entries(inputs))$(id).value=String(value);
  for(const [id,value]of Object.entries({b:fmt(state.b,4),energy:fmt(state.E,3),phi:fmt(state.phi,0)+'°',mass:fmt(state.mass),width:fmt(state.width,3),power:state.n,alpha:fmt(state.alpha),omega:fmt(state.omega)}))$(id+'Value').textContent=value;
  $('compare').checked=state.compare;$('wrongSampling').checked=state.wrongSampling;
  $('precisionControl').hidden=!state.explore;$('exactEnergyControl').hidden=!visible.energy;$('precisionUnit').textContent=c===5||c===6?'ℓ₀':c===8?'d(g)':'d';$('exactB').value=state.b;$('exactB').min=$('b').min;$('exactB').max=$('b').max;$('exactEnergy').value=state.E;
  document.querySelectorAll('[data-plot]').forEach(e=>e.classList.toggle('active',e.dataset.plot===state.plotMode));
}
function setParameter(key,value){state[key]=value;if(key==='phi'&&viewMode==='plane')setView('plane');syncControls();compute();dirty=true;}
function updateTransport(){$('timeSlider').value=state.time;$('timeValue').textContent=Math.round(state.time*100)+'%';$('playButton').dataset.playing=String(playing);$('playButton').setAttribute('aria-label',i18n.t(playing?'stage.pause':'stage.play'));}
function togglePlay(){if(!playing&&state.time>=.999)state.time=0;playing=!playing;lastFrame=performance.now();updateTransport();dirty=true;}
function tick(now){
  if(playing){const dt=Math.min(.08,(now-lastFrame)/1000);state.time=Math.min(1,state.time+dt*Number($('speed').value)/(state.chapter>=7?9:10));if(state.time>=1)playing=false;dirty=true;updateTransport();}
  lastFrame=now;if(dirty){drawStage();drawPlot();updateDiagnostics();dirty=false;}frameId=requestAnimationFrame(tick);
}

function ghostSphere(center,r,style={}){
  scene.sphere(center,r,{color:style.color||C.dim,ghost:true,alpha:style.alpha??.25});
  for(const normal of [[1,0,0],[0,1,0],[0,0,1]])scene.circle(center,normal,r,{color:style.color||C.dim,alpha:style.alpha??.18,width:.8});
}
function axisLine(a,b,label='g',color=C.dim){scene.arrow(a,b,{color,alpha:.68,width:1.15});if(label)scene.label(b,label,{color,size:16,dy:-10});}
function beamAxis(){scene.line([-5,0,0],[4.9,0,0],{color:C.dim,alpha:.34,width:1,dash:[5,5]});scene.arrow([-4.4,0,0],[-3.3,0,0],{color:C.ink,width:1.7});scene.label([-3.85,0,0],'g',{color:C.ink,size:19,dy:25});}
function planePatch(){const u=eb();scene.polygon([V.add([-4.2,0,0],V.mul(u,-1.7)),V.add([4.2,0,0],V.mul(u,-1.7)),V.add([4.2,0,0],V.mul(u,2.65)),V.add([-4.2,0,0],V.mul(u,2.65))],{color:C.cyan,fill:C.cyan,alpha:.022,stroke:true,width:.7});}
function dashedRadius(p,label='r',color=C.dim){scene.line([0,0,0],p,{color,alpha:.7,dash:[4,4],width:1.1});scene.label(V.mul(p,.57),label,{color,size:18,dy:-8});}
function impactMeasure(x=-2.75){const a=[x,0,0],b=world(x,state.b);scene.line(a,b,{color:C.cyan,width:2});for(const p of [a,b])scene.line(V.add(p,[-.08,0,0]),V.add(p,[.08,0,0]),{color:C.cyan,width:1.5});scene.label(V.lerp(a,b,.52),'b',{color:C.cyan,size:22,dx:-21,dy:-4});}
function relativeDrawing({angles=false,potentialMode=false}={}){
  planePatch();beamAxis();
  const hs=result.model==='hs'||result.model==='sutherland';
  if(hs){ghostSphere([0,0,0],1,{alpha:.35});scene.circle([0,0,0],V.cross([1,0,0],eb()),1,{color:C.dim,alpha:.48,width:1.25});}
  else {
    for(const r of [1,1.45,2.05,2.8])scene.circle([0,0,0],V.cross([1,0,0],eb()),r,{color:C.dim,alpha:r===1?.3:.1,width:.8,dash:r===1?[]:[3,6]});
    scene.sphere([0,0,0],.09,{color:C.dim,shadow:'#354846'});
  }
  scene.point([0,0,0],3,{color:C.ink});scene.label([0,0,0],'O',{size:17,dy:23,dx:10});
  for(const [i,r]of compareResults.entries())scene.polyline(r.view.map(p=>world(p.x,p.y)),{color:[C.purple,C.red,C.dim,C.cyan][i%4],alpha:.4,width:1.05});
  scene.polyline(result.view.map(p=>world(p.x,p.y)),{color:C.gold,alpha:.22,width:1.35});
  const current=trajectoryAt(result,state.time),past=result.view.filter(p=>p.t<=current.t).map(p=>world(p.x,p.y));past.push(world(current.x,current.y));
  scene.polyline(past,{color:C.gold,alpha:.95,width:2.45});
  const pos=world(current.x,current.y);scene.sphere(pos,.115,{color:C.gold,shadow:'#766344',highlight:'#fff3ce'});
  impactMeasure();
  const end=result.view.at(-1),endP=world(end.x,end.y),ex=direction(result.signedAngle),scaledEnd=V.mul(endP,Math.min(1,4.2/Math.max(1,V.length(endP))));
  scene.arrow(V.sub(scaledEnd,V.mul(ex,.55)),scaledEnd,{color:C.gold,width:1.8,head:7});
  if(angles&&state.b<1){
    const contact=world(-Math.sqrt(1-state.b*state.b),state.b),u=eb(),chi=hsAngle(state.b),normal=V.unit(contact);
    scene.point(contact,3.3,{color:C.ink});scene.line([0,0,0],contact,{color:C.dim,width:1.5});scene.label(V.mul(contact,.62),'d',{color:C.dim,size:19,dy:18});
    if(state.step>=1){
      scene.arrow(contact,V.add(contact,V.mul(normal,.9)),{color:C.purple,width:1.8});scene.label(V.add(contact,V.mul(normal,.9)),'n',{color:C.purple,size:19});
      scene.arrow(V.add(contact,[-1.45,0,0]),contact,{color:C.ink,width:2});
      scene.arrow(contact,V.add(contact,V.mul(direction(chi),1.5)),{color:C.gold,width:2});scene.label(V.add(contact,V.mul(direction(chi),1.5)),"g′",{color:C.gold,size:21});
      const beta=Math.asin(state.b);scene.arc(contact,[-1,0,0],u,.42,0,beta,{color:C.purple,width:1.6});scene.label(V.add(contact,V.add([-.61*Math.cos(beta/2),0,0],V.mul(u,.61*Math.sin(beta/2)))),'β',{color:C.purple,size:19,dx:-9,dy:-7});
    }
    if(state.step===2){
      scene.line(contact,V.add(contact,[1.5,0,0]),{color:C.dim,alpha:.55,dash:[4,4]});
      scene.arc(contact,[1,0,0],u,.82,0,chi,{color:C.gold,width:2});
      scene.label(V.add(contact,V.mul(direction(chi/2),1.08)),'χ',{color:C.gold,size:25,dx:3,dy:-5});
    }
  }
  if(potentialMode){
    const r=Math.hypot(current.x,current.y);dashedRadius(pos,'r');
    if(state.model!=='hs'){
      const force=radialForce(r,state.model,state.n),unit=V.unit(pos),length=1.4*Math.tanh(Math.abs(force)/5);
      if(length>.025){const end=V.add(pos,V.mul(unit,Math.sign(force)*length));scene.arrow(pos,end,{color:C.cyan,width:2});scene.label(end,'F',{color:C.cyan,size:20,dy:-10});}
    }
    if(state.step>=1||state.chapter===6){scene.circle([0,0,0],V.cross([1,0,0],eb()),result.rmin,{color:C.cyan,alpha:.4,dash:[3,4],width:.9});}
    if(state.chapter===6&&state.model==='lj'&&state.E<.8){const critical=criticalOrbit(state.E);scene.circle([0,0,0],V.cross([1,0,0],eb()),critical.r,{color:C.purple,alpha:.6,dash:[3,5],width:1});scene.label(world(0,-critical.r),'r*',{color:C.purple,size:16,dy:20});}
  }
}
function twoBody(){
  if(state.step===2){relativeDrawing();return;}
  const m1=state.mass,m2=1,M=m1+m2,current=trajectoryAt(result,state.time),isLab=state.step===0;
  const reconstruct=s=>{const R=isLab?[m1/M*(-5+result.g*s.t),m1/M*state.b]:[0,0],cmV=isLab?[m1/M*result.g,0]:[0,0];return {...labFromRelative([s.x,s.y],[s.vx,s.vy],m1,m2,R,cmV),R};};
  const data=reconstruct(current);const tracks1=result.view.map(s=>{const q=reconstruct(s);return world(...q.r1);}),tracks2=result.view.map(s=>{const q=reconstruct(s);return world(...q.r2);});
  scene.polyline(tracks1,{color:C.gold,alpha:.35,width:1.5});scene.polyline(tracks2,{color:C.cyan,alpha:.35,width:1.5});
  const p1=world(...data.r1),p2=world(...data.r2),cm=world(...data.R),size1=m1**(1/3)/(1+m1**(1/3)),size2=1-size1;
  scene.line(p1,p2,{color:C.dim,alpha:.5,dash:[4,5]});
  scene.sphere(p1,size1,{color:C.gold,highlight:'#fff0cf',shadow:'#715f43'});scene.sphere(p2,size2,{color:C.cyan,shadow:'#37665f'});
  scene.label(p1,'m₁',{color:C.gold,size:22,dy:-size1*70-8});scene.label(p2,'m₂',{color:C.cyan,size:22,dy:size2*65+24});
  scene.point(cm,4,{color:C.ink});scene.label(cm,'C',{color:C.ink,size:17,dy:24,dx:8});
  scene.arrow(p1,V.add(p1,world(data.v1[0]*.8,data.v1[1]*.8)),{color:C.gold,width:2});
  if(Math.hypot(...data.v2)>.02)scene.arrow(p2,V.add(p2,world(data.v2[0]*.8,data.v2[1]*.8)),{color:C.cyan,width:2});
  if(isLab){scene.line(world(-4,m1/M*state.b),world(4,m1/M*state.b),{color:C.dim,alpha:.25,dash:[3,6]});scene.arrow(cm,V.add(cm,[.8,0,0]),{color:C.ink,width:1.3});scene.label(V.add(cm,[.8,0,0]),'V',{size:16});}
  else {scene.line([-4,0,0],[4,0,0],{color:C.dim,alpha:.16,dash:[4,6]});dashedRadius(p1,'r₁ − R',C.gold);}
}
function cylinderDrawing(){
  const left=-3.1,right=3.1,t=clamp(state.time,0,1),progress=t*t*(3-2*t),shownB=state.step===1?state.b*progress:state.b,selected=world(0,shownB);
  scene.cylinder([left,0,0],[right,0,0],1,{color:C.cyan,fillAlpha:.026,alpha:.62});
  scene.line([left-.65,0,0],[right+.45,0,0],{color:C.ink,alpha:.5,dash:[4,4]});
  scene.arrow([-4,0,0],[-2.9,0,0],{color:C.ink,width:2});scene.label([-3.6,0,0],'g',{color:C.ink,size:21,dy:25});
  scene.annulus([left,0,0],[1,0,0],0,1,{color:C.cyan,fillAlpha:.05,alpha:.65,width:1.5});
  scene.line([left,0,0],[left,1,0],{color:C.cyan,width:2});scene.label([left,.52,0],'d',{color:C.cyan,size:22,dx:8,dy:-2});
  scene.sphere(selected,state.step===0?.5:.11,{color:shownB<1?C.gold:C.red,shadow:'#6f6248'});
  scene.line([0,0,0],selected,{color:C.gold,width:2});scene.label(V.mul(selected,.5),'b',{color:C.gold,size:21,dx:12,dy:2});
  scene.label(selected,binaryCopy(document.documentElement.lang === "en" ? "en" : "ru", "centerTwo"),{color:shownB<1?C.gold:C.red,size:14,italic:false,dy:-22});
  if(state.step===0){
    const x=state.b<1?-Math.sqrt(Math.max(0,1-state.b*state.b)):-.25;
    // This sphere marks the last free-flight configuration; the dashed centerline
    // beyond it is a geometrical continuation, not an overlapping collision animation.
    scene.sphere([Math.min(x,-3.2+3.2*state.time),0,0],.5,{color:C.cyan});
    ghostSphere(selected,1,{alpha:.2});
  }
  if(state.step===1){
    const target=world(0,state.b);
    scene.line([0,0,0],target,{color:C.dim,alpha:.35,dash:[3,5],width:1});
    scene.point(target,2.7,{color:state.b<1?C.gold:C.red,alpha:.35});
  }
  if(state.step===2){
    const sweepX=left+(right-left)*progress,rng=mulberry32(54431);
    for(let i=0;i<74;i++){const p=[-3+rng()*6,(rng()-.5)*3.45,(rng()-.5)*3.45];if(p[0]>sweepX)continue;const hit=Math.hypot(p[1],p[2])<1;scene.point(p,hit?2.6:1.7,{color:hit?C.gold:C.dim,alpha:hit?.83:.25});}
    scene.annulus([sweepX,0,0],[1,0,0],0,1,{color:C.gold,fillAlpha:.035,alpha:.68,width:1.2});
    scene.line([left,-1.55,0],[sweepX,-1.55,0],{color:C.dim,width:1.1});
    for(const x of [left,sweepX])scene.line([x,-1.43,0],[x,-1.68,0],{color:C.dim,width:1.1});scene.label([(left+sweepX)/2,-1.55,0],'g Δt',{color:C.ink,size:22,dx:-26,dy:26});
    const pathEnd=state.b<1?-Math.sqrt(Math.max(0,1-state.b*state.b)):right,particle=world(left+(pathEnd-left)*progress,state.b);
    scene.line(world(left,state.b),world(pathEnd,state.b),{color:state.b<1?C.gold:C.red,alpha:.55,dash:[5,4],width:1.4});
    scene.sphere(particle,.13,{color:state.b<1?C.gold:C.red,shadow:'#6f6248'});
  }
}
function lessonProgress(){const t=clamp(state.time,0,1);return t*t*(3-2*t);}
function angularState(){
  const progress=lessonProgress(),targetChi=hsAngle(state.b),targetPhi=state.phi*DEG;
  if(state.step===0)return {chi:hsAngle(state.b*progress),phi:targetPhi};
  if(state.step===1)return {chi:targetChi,phi:(targetPhi+TAU*progress)%TAU};
  return {chi:.04+(targetChi-.04)*progress,phi:targetPhi};
}
function angularDrawing(){
  const {chi,phi}=angularState(),u=[0,Math.cos(phi),Math.sin(phi)],d=direction(chi,phi),o=[0,0,0],R=2.5;
  ghostSphere(o,R,{alpha:.14});scene.cone(o,[1,0,0],R,chi,{color:C.gold,fillAlpha:.021});
  axisLine([-3.8,0,0],[3.75,0,0],'x, g',C.dim);axisLine(o,[0,2.85,0],'y',C.muted);axisLine(o,[0,0,2.85],'z',C.muted);
  scene.polygon([[-3.1,0,0],[3.1,0,0],V.add([3.1,0,0],V.mul(u,2.7)),V.add([-3.1,0,0],V.mul(u,2.7))],{color:C.cyan,fill:C.cyan,alpha:.034,stroke:true,width:.6});
  scene.arrow(o,V.mul(d,R),{color:C.gold,width:2.65});scene.label(V.mul(d,R),"g′",{color:C.gold,size:23,dx:12,dy:-12});
  scene.arc(o,[1,0,0],u,.95,0,chi,{color:C.gold,width:2});scene.label(V.mul(direction(chi/2,phi),1.18),'χ',{color:C.gold,size:24,dx:4,dy:-4});
  if(state.step>=1){
    scene.circle(o,[1,0,0],1.6,{color:C.purple,alpha:.28,width:1});scene.arrow(o,V.mul(u,1.65),{color:C.purple,width:1.55});
    scene.arc(o,[0,1,0],[0,0,1],1.5,0,phi,{color:C.purple,width:2});
    scene.label([0,1.75*Math.cos(phi/2),1.75*Math.sin(phi/2)],'φ',{color:C.purple,size:24,dx:7,dy:-4});
  }
  if(state.step===2){
    const lo=clamp(chi-.13,.004,PI-.01),hi=clamp(chi+.13,.01,PI-.004),ph=phi,dp=.42;
    const p=(th,phi)=>V.mul(direction(th,phi),R*1.012),N=12;
    for(let i=0;i<N;i++)for(let j=0;j<6;j++){
      const a=lo+(hi-lo)*i/N,b=lo+(hi-lo)*(i+1)/N,c=ph-dp/2+dp*j/6,e=ph-dp/2+dp*(j+1)/6;
      scene.polygon([p(a,c),p(a,e),p(b,e),p(b,c)],{fill:C.gold,alpha:.34,stroke:false});
    }
    scene.polyline(Array.from({length:41},(_,i)=>p(lo,ph-dp/2+dp*i/40)),{color:C.gold,width:1.9});scene.polyline(Array.from({length:41},(_,i)=>p(hi,ph-dp/2+dp*i/40)),{color:C.gold,width:1.9});
    for(const az of [ph-dp/2,ph+dp/2])scene.polyline(Array.from({length:25},(_,i)=>p(lo+(hi-lo)*i/24,az)),{color:C.gold,width:1.9});
    scene.label(V.mul(direction(chi,ph),R*1.17),'ΔΩ',{color:C.gold,size:20,dx:19,dy:17});
  }
}
function ringBounds(){const width=state.chapter===4&&state.step===0?state.width*lessonProgress():state.width;return [clamp(state.b-width/2,0,1),clamp(state.b+width/2,0,1)];}
function mappedGeometry(ensembleMode=false){
  const left=[-2.55,0,0],right=[1.7,0,0],R=1.7,scale=1.48,d=dsmcDiameter(),alpha=dsmcAlpha();
  const diskRadius=scale*(state.chapter===8?d:1),[lo,hi]=ringBounds();
  scene.annulus(left,[1,0,0],0,diskRadius,{color:C.cyan,fillAlpha:.028,alpha:.5,width:1.25});
  for(let i=0;i<8;i++){const p=i*TAU/8;scene.line(left,V.add(left,[0,diskRadius*Math.cos(p),diskRadius*Math.sin(p)]),{color:C.cyan,alpha:.11,width:.7});}
  for(const r of [.5,.75])scene.circle(left,[1,0,0],diskRadius*r,{color:C.cyan,alpha:.12,width:.7});
  if(!ensembleMode||state.chapter===7){
    scene.annulus(left,[1,0,0],diskRadius*lo,diskRadius*hi,{color:C.cyan,fillAlpha:.28,alpha:.96,width:1.25});
  }
  scene.label(V.add(left,[0,-diskRadius-.13,0]),'входная плоскость',{color:C.cyan,size:14,italic:false,dx:-55,dy:23});
  scene.label(V.add(right,[0,-R-.13,0]),'сфера направлений',{color:C.gold,size:14,italic:false,dx:-51,dy:23});
  ghostSphere(right,R,{alpha:.19});
  scene.arrow(V.add(right,[-R-.2,0,0]),V.add(right,[R+.7,0,0]),{color:C.dim,alpha:.5,width:1.1});scene.label(V.add(right,[R+.62,0,0]),'g',{size:18,dy:23,dx:-2});
  if(!ensembleMode){
    const chin=hsAngle(lo),chix=hsAngle(hi);
    if(state.step>=1){scene.sphericalBand(right,R,chix,chin,{color:C.gold,fillAlpha:.3});scene.cone(right,[1,0,0],R,hsAngle(state.b),{color:C.gold,fillAlpha:.01});}
    const N=60,visibleN=state.chapter===4&&state.step===0?Math.max(1,Math.floor(N*lessonProgress())):N;
    for(let i=0;i<visibleN;i++){
      const ph=i*TAU/N,b=state.b,a=V.add(left,[0,diskRadius*b*Math.cos(ph),diskRadius*b*Math.sin(ph)]),z=V.add(right,V.mul(direction(hsAngle(b),ph),R));
      scene.point(a,2.4,{color:C.cyan,alpha:.9});if(state.step>=1)scene.point(z,2.4,{color:C.gold,alpha:.86});
      if(state.step>=1&&i%3===0){
        const t=clamp(state.time,0,1),p=V.lerp(a,z,t);p[1]+=.7*Math.sin(PI*t);scene.point(p,2.6,{color:t<.5?C.cyan:C.gold,alpha:.72});
      }
    }
    const u=eb();scene.line(left,V.add(left,V.mul(u,diskRadius*state.b)),{color:C.cyan,width:2});scene.label(V.add(left,V.mul(u,diskRadius*state.b*.55)),'b',{color:C.cyan,size:20,dx:-19,dy:-8});
    if(state.step>=1){const dchi=hsAngle(state.b);scene.arrow(right,V.add(right,V.mul(direction(dchi),R)),{color:C.gold,width:2});scene.label(V.add(right,V.mul(direction(dchi),R*1.15)),'χ(b)',{color:C.gold,size:18,dy:-16});}
    scene.label([-.15,-2.35,0],'соответствие, не траектории',{color:C.muted,size:11,italic:false,dx:-70,dy:5});
  }else{
    const N=Math.floor(state.count*state.time),scaleInput=1.48;
    for(let i=0;i<N;i++){
      const h=ensemble.hits[i],onRing=h.b/d>=lo&&h.b/d<=hi&&state.chapter===7&&state.step===0;
      const p=V.add(left,[0,scaleInput*h.b*Math.cos(h.phi),scaleInput*h.b*Math.sin(h.phi)]);
      if(state.step<=1)scene.point(p,onRing?2.5:1.55,{color:state.wrongSampling?C.red:onRing?C.gold:C.cyan,alpha:onRing?.96:.58});
      if(state.step>=1){const out=V.add(right,V.mul(h.dir,R));scene.point(out,1.9,{color:state.wrongSampling?C.red:C.gold,alpha:.72});}
    }
    const last=Math.max(0,N-1),h=ensemble.hits[last];
    if(state.step>=1&&N>0&&h){scene.arrow(right,V.add(right,V.mul(h.dir,R)),{color:C.gold,alpha:.55,width:1.1});}
    if(state.step>=1)scene.arrow([-.8,0,0],[.05,0,0],{color:C.dim,alpha:.5,width:1.3});
    if(state.chapter===8){scene.circle(left,[1,0,0],1.48,{color:C.dim,alpha:.43,width:1.1,dash:[4,4]});scene.label(V.add(left,[0,-diskRadius-.2,0]),`d / dref = ${fmt(d,3)}`,{color:C.cyan,size:15,italic:false,dx:-44,dy:22});}
  }
  return {left,right,R,diskRadius};
}
function readout(items){$('sceneReadout').innerHTML=items.map(([name,value,color=''])=>`<div class="readout-item ${color}">${name}<strong>${value}</strong></div>`).join('');}
function drawStage(){
  if(!result)return;scene.clear();
  const c=state.chapter;
  if(c===0)twoBody();else if(c===1)cylinderDrawing();else if(c===2)relativeDrawing({angles:true});else if(c===3)angularDrawing();else if(c===4)mappedGeometry();else if(c===5||c===6)relativeDrawing({potentialMode:true});else mappedGeometry(true);
  renderer.draw(scene);
  const cur=trajectoryAt(result,state.time),r=Math.hypot(cur.x,cur.y),chi=result.chi;
  if(c===0)readout([['m₁ / m₂',fmt(state.mass)],['μ / m₂',fmt(state.mass/(state.mass+1),3),'cyan'],['система',state.step===0?'LAB':state.step===1?'CM':'r₁ − r₂']]);
  if(c===1)readout([['b / d',fmt(state.b,3),'cyan'],[binaryCopy(document.documentElement.lang === "en" ? "en" : "ru", "condition"),state.b<1?'b < d':'b ≥ d','gold'],['σT / d²','π']]);
  if(c===2)readout([['b / d',fmt(state.b,3),'cyan'],['χ',ang(chi),'gold'],['β',state.b<=1?ang(Math.asin(state.b)):'?']]);
  if(c===3){const {chi:a,phi}=angularState(),lo=clamp(a-.13,.004,PI-.01),hi=clamp(a+.13,.01,PI-.004);readout([['χ',ang(a),'gold'],['φ',fmt((phi/DEG+360)%360,0)+'°','cyan'],[state.step===2?'ΔΩ / ср':'плоскость',state.step===2?fmt(.42*(Math.cos(lo)-Math.cos(hi)),3):'span(g, b)']]);}
  if(c===4){const [lo,hi]=ringBounds(),ds=PI*(hi*hi-lo*lo),dO=2*PI*(Math.cos(hsAngle(hi))-Math.cos(hsAngle(lo)));readout([['Δσ / d²',fmt(ds,3),'cyan'],['ΔΩ / ср',state.step>=1?fmt(dO,3):'?','gold'],['(Δσ/ΔΩ) / d²',state.step===2?fmt(ds/dO,3):'?']]);}
  if(c===5)readout([['потенциал',POTENTIALS[state.model].short],['χ',ang(chi),'gold'],['r / ℓ₀',fmt(r,3),'cyan']]);
  if(c===6)readout([['E / ε',fmt(state.E,3)],['χ',ang(chi),'gold'],['Θ',ang(result.theta),'cyan']]);
  if(c===7)readout([['прошло частиц',Math.floor(state.count*state.time)],['выборка по b',state.wrongSampling?'U (ошибка)':'√U','cyan'],['σT / d²','π']]);
  if(c===8)readout([['модель',state.collisionModel.toUpperCase()],['d / dref',fmt(dsmcDiameter(),3),'cyan'],['α',fmt(dsmcAlpha(),2),'gold']]);
}

function plotCanvas(){
  const c=plotContext,w=$('plot').clientWidth,h=$('plot').clientHeight,d=Math.min(2,devicePixelRatio||1);
  c.setTransform(d,0,0,d,0,0);c.globalAlpha=1;c.fillStyle=C.bg;c.fillRect(0,0,w,h);c.lineWidth=1;c.font=`10px ${CHALK_FONT_STACK}`;c.textBaseline='alphabetic';c.setLineDash([]);return {c,w,h};
}
function axes({xmin=0,xmax=1,ymin=0,ymax=1,xlabel='',ylabel='',xticks=5,yticks=3}={}){
  const p=plotCanvas(),{c,w,h}=p,l=45,r=w-21,t=23,b=h-30;
  const X=x=>l+(x-xmin)/(xmax-xmin)*(r-l),Y=y=>b-(y-ymin)/(ymax-ymin)*(b-t);
  c.strokeStyle=C.line;c.fillStyle=C.muted;c.lineWidth=.65;
  for(let i=0;i<=xticks;i++){
    const x=xmin+(xmax-xmin)*i/xticks,px=X(x);c.globalAlpha=.5;c.beginPath();c.moveTo(px,t);c.lineTo(px,b);chalkStroke(c);c.globalAlpha=1;c.textAlign='center';c.fillText(fmt(x,Math.max(0,1-Math.floor(Math.log10((xmax-xmin)/xticks)))),px,b+16);
  }
  for(let i=0;i<=yticks;i++){
    const y=ymin+(ymax-ymin)*i/yticks,py=Y(y);c.globalAlpha=.5;c.beginPath();c.moveTo(l,py);c.lineTo(r,py);chalkStroke(c);c.globalAlpha=1;c.textAlign='right';c.fillText(fmt(y,Math.max(0,1-Math.floor(Math.log10((ymax-ymin)/yticks)))),l-8,py+3);
  }
  c.textAlign='left';c.fillStyle=C.dim;c.fillText(ylabel,9,13);c.textAlign='right';c.fillText(xlabel,r,h-5);c.textAlign='left';
  const g={...p,l,r,t,b,X,Y,xmin,xmax,ymin,ymax};plotGeometry=g;return g;
}
function plotLine(g,points,color=C.gold,width=1.8,dash=[],alpha=1,maxJump=Infinity){
  const {c,X,Y,l,r,t,b}=g;c.save();c.beginPath();c.rect(l,t,r-l,b-t);c.clip();c.strokeStyle=color;c.lineWidth=width;c.globalAlpha=alpha;c.setLineDash(dash);c.beginPath();let pen=false,old=null;
  for(const [x,y]of points){if(!Number.isFinite(x)||!Number.isFinite(y)){pen=false;old=null;continue;}if(old&&Math.abs(y-old[1])>maxJump)pen=false;const px=X(x),py=Y(y);if(pen)c.lineTo(px,py);else c.moveTo(px,py);pen=true;old=[x,y];}chalkStroke(c);c.restore();
}
function plotMarker(g,x,y,color=C.gold){if(x<g.xmin||x>g.xmax||y<g.ymin||y>g.ymax)return;const {c,X,Y}=g;c.save();c.strokeStyle=color;c.globalAlpha=.4;c.setLineDash([3,4]);c.beginPath();c.moveTo(X(x),g.t);c.lineTo(X(x),g.b);chalkStroke(c);c.globalAlpha=1;c.setLineDash([]);c.fillStyle=C.bg;c.lineWidth=2;c.beginPath();c.arc(X(x),Y(y),4.5,0,TAU);c.fill();chalkStroke(c);c.restore();}
function legend(g,entries){let x=g.r-entries.reduce((sum,[name])=>sum+g.c.measureText(name).width+38,0);const y=13;for(const [name,color,dash]of entries){g.c.strokeStyle=color;g.c.lineWidth=1.6;g.c.setLineDash(dash||[]);g.c.beginPath();g.c.moveTo(x,y-3);g.c.lineTo(x+15,y-3);chalkStroke(g.c);g.c.setLineDash([]);g.c.fillStyle=C.dim;g.c.textAlign='left';g.c.fillText(name,x+21,y);x+=g.c.measureText(name).width+38;}}
function plotTwoBody(){
  const m1=state.mass,M=m1+1,lab=state.step===0;
  const track=which=>result.view.map((s,i)=>{const R=lab?[m1/M*(-5+result.g*s.t),m1/M*state.b]:[0,0],q=labFromRelative([s.x,s.y],[s.vx,s.vy],m1,1,R);return [(s.t-result.view[0].t)/(result.view.at(-1).t-result.view[0].t),which==='r'?s.x:which==='cm'?R[0]:q[which][0]];});
  if(state.step===2){const g=axes({xmin:0,xmax:1,ymin:-5,ymax:5,xlabel:'t / tкон',ylabel:'x / d'});plotLine(g,track('r'),C.gold);plotMarker(g,state.time,trajectoryAt(result,state.time).x);$('plotTitle').textContent='Относительное положение';$('plotHint').textContent='x = x₁ − x₂';return;}
  const one=track('r1'),two=track('r2'),cm=track('cm'),vals=[...one,...two].map(x=>x[1]),ymin=Math.floor(Math.min(...vals)),ymax=Math.ceil(Math.max(...vals));
  const g=axes({xmin:0,xmax:1,ymin,ymax:ymax===ymin?ymax+1:ymax,xlabel:'t / tкон',ylabel:'x / d'});
  plotLine(g,one,C.gold);plotLine(g,two,C.cyan);plotLine(g,cm,C.dim,1,[4,4]);plotLine(g,[[state.time,ymin],[state.time,ymax]],C.dim,1,[3,5],.7);legend(g,[['x₁',C.gold],['x₂',C.cyan],['X',C.dim,[4,4]]]);
  $('plotTitle').textContent='Центр масс движется равномерно';$('plotHint').textContent=lab?'лабораторная система':'система центра масс';
}
function plotCylinder(){
  const {c,w,h}=plotCanvas(),x=w<520?78:101,y=h/2-1,r=Math.min(h*.34,52),ph=state.phi*DEG,t=clamp(state.time,0,1),progress=t*t*(3-2*t),shownB=state.step===1?state.b*progress:state.b;
  c.fillStyle=C.cyan;c.globalAlpha=.05;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.globalAlpha=.75;c.strokeStyle=C.cyan;c.lineWidth=1.2;chalkStroke(c);
  if(state.step===2&&progress>0){c.fillStyle=C.gold;c.globalAlpha=.12;c.beginPath();c.moveTo(x,y);c.arc(x,y,r,-PI/2,-PI/2+TAU*progress);c.closePath();c.fill();c.globalAlpha=.65;c.strokeStyle=C.gold;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+r*Math.cos(-PI/2+TAU*progress),y+r*Math.sin(-PI/2+TAU*progress));chalkStroke(c);}
  c.strokeStyle=C.line;c.lineWidth=1;c.setLineDash([3,4]);c.beginPath();c.moveTo(x-r*1.3,y);c.lineTo(x+r*1.5,y);c.moveTo(x,y-r*1.3);c.lineTo(x,y+r*1.3);chalkStroke(c);c.setLineDash([]);c.globalAlpha=1;
  const px=x+r*shownB*Math.sin(ph),py=y-r*shownB*Math.cos(ph);c.strokeStyle=C.gold;c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(px,py);chalkStroke(c);c.fillStyle=shownB<1?C.gold:C.red;c.beginPath();c.arc(px,py,4.2,0,TAU);c.fill();c.font=`italic 17px ${CHALK_FONT_STACK}`;c.fillText('b',x+(px-x)*.5+6,y+(py-y)*.5);c.font=`10px ${CHALK_FONT_STACK}`;c.fillStyle=C.muted;c.textAlign='center';c.fillText(binaryCopy(document.documentElement.lang === "en" ? "en" : "ru", "viewAlongG"),x,h-8);c.textAlign='left';
  const tx=w<520?168:220;c.font=`19px ${CHALK_FONT_STACK}`;c.fillStyle=shownB<1?C.gold:C.red;c.fillText(shownB<1?binaryCopy(document.documentElement.lang === "en" ? "en" : "ru", "centerInside"):'Центр вне цилиндра',tx,49);c.font=`12px ${CHALK_FONT_STACK}`;c.fillStyle=C.dim;c.fillText(`b / d = ${fmt(shownB,3)} ${shownB<1?'<':'≥'} 1`,tx,74);c.font=`13px ${CHALK_FONT_STACK}`;c.fillText('σT = πd²',tx,101);c.font=`10px ${CHALK_FONT_STACK}`;c.fillStyle=C.muted;if(w>520)c.fillText(binaryCopy(document.documentElement.lang === "en" ? "en" : "ru", "circleArea"),tx,121);
  plotGeometry={type:'disk',x,y,r,w,h};$('plotTitle').textContent='Поперечное сечение';$('plotHint').textContent='щелчок по кругу меняет b и φ';
}
function plotHardSphere(){
  const g=axes({xmin:0,xmax:1.15,ymin:0,ymax:180,xlabel:'b / d',ylabel:'χ, °',xticks:5,yticks:3});plotLine(g,Array.from({length:140},(_,i)=>[1.15*i/139,hsAngle(1.15*i/139)/DEG]));plotMarker(g,state.b,hsAngle(state.b)/DEG);
  $('plotTitle').textContent='χ(b) для твёрдых сфер';$('plotHint').textContent='выберите прицельный параметр на графике';
}
function plotSolidAngle(){
  const g=axes({xmin:0,xmax:180,ymin:0,ymax:1.1,xlabel:'χ, °',ylabel:'sin χ',xticks:6,yticks:2});plotLine(g,Array.from({length:140},(_,i)=>{const x=180*i/139;return [x,Math.sin(x*DEG)];}),C.gold);const {chi}=angularState();plotMarker(g,chi/DEG,Math.sin(chi));
  $('plotTitle').textContent='Площадь угловой ячейки зависит от χ';$('plotHint').textContent='dΩ / (dχ dφ) = sin χ';
}
function plotMapping(){
  const g=axes({xmin:0,xmax:1,ymin:-1,ymax:1,xlabel:'(b / d)²',ylabel:'cos χ',xticks:4,yticks:2}),[lo,hi]=ringBounds();
  g.c.fillStyle=C.cyan;g.c.globalAlpha=.1;g.c.fillRect(g.X(lo*lo),g.t,g.X(hi*hi)-g.X(lo*lo),g.b-g.t);g.c.globalAlpha=1;
  plotLine(g,[[0,-1],[1,1]],C.gold,2);plotMarker(g,state.b*state.b,2*state.b*state.b-1);
  $('plotTitle').textContent='Равные площади → равные телесные углы';$('plotHint').textContent='HS: cos χ = 2(b/d)² − 1';
}
function plotPotential(){
  const ymax=Math.max(3,state.E*1.3),g=axes({xmin:.55,xmax:3.6,ymin:-1.35,ymax,xlabel:'r / ℓ₀',ylabel:'U / ε',xticks:5,yticks:3}),entries=[['U',C.gold]];
  const evaluate=(model,eff=false)=>Array.from({length:360},(_,i)=>{const r=.55+3.05*i/359;if((model==='hs'||model==='sutherland')&&r<1)return [r,NaN];return [r,eff?effectivePotential(r,{...params(),model}):potential(r,model,state.n)];});
  if(state.model==='hs'||state.model==='sutherland'){
    g.c.fillStyle=C.dim;g.c.globalAlpha=.06;g.c.fillRect(g.l,g.t,g.X(1)-g.l,g.b-g.t);g.c.globalAlpha=1;plotLine(g,[[1,g.ymin],[1,g.ymax]],C.dim,1.2,[3,4]);
  }
  if(state.compare)for(const [i,res]of compareResults.entries())plotLine(g,evaluate(res.model),[C.purple,C.red,C.dim,C.cyan][i%4],1,[],.5);
  plotLine(g,evaluate(state.model),C.gold,2);
  if(state.step>=1||state.explore){plotLine(g,evaluate(state.model,true),C.cyan,1.6,[4,3]);entries.push(['Ueff',C.cyan,[4,3]]);}
  plotLine(g,[[g.xmin,state.E],[g.xmax,state.E]],C.ink,1,[6,5],.6);entries.push(['E',C.ink,[6,5]]);legend(g,entries);
  const q=trajectoryAt(result,state.time),r=Math.hypot(q.x,q.y);plotMarker(g,r,potential(r,state.model,state.n));
  if(state.step>=1)plotMarker(g,r,effectivePotential(r,params()),C.cyan);
  $('plotTitle').textContent='Потенциальная и полная энергия';$('plotHint').textContent=r>3.6?`r = ${fmt(r)}: вне окна графика`:'точка движется вместе с частицей';
}
function plotDeflection(){
  if(state.plotMode==='dcs'){
    const measure=areaBinnedDcs(curve,30),upper=Math.max(.35,...measure.dcs)*1.18,g=axes({xmin:-1,xmax:1,ymin:0,ymax:upper,xlabel:'cos χ',ylabel:'(dσ/dΩ) / ℓ₀²',xticks:4,yticks:3});
    for(let i=0;i<measure.dcs.length;i++){
      const a=-1+2*i/measure.dcs.length,b=-1+2*(i+1)/measure.dcs.length,y=measure.dcs[i];g.c.fillStyle=C.cyan;g.c.globalAlpha=.22;g.c.fillRect(g.X(a)+1,g.Y(y),g.X(b)-g.X(a)-2,g.b-g.Y(y));g.c.globalAlpha=.85;g.c.strokeStyle=C.cyan;g.c.lineWidth=1;g.c.strokeRect(g.X(a)+1,g.Y(y),g.X(b)-g.X(a)-2,g.b-g.Y(y));g.c.globalAlpha=1;
    }
    const limit=curve.at(-1).b;$('plotTitle').textContent='Сечение: сумма всех ветвей';$('plotHint').textContent=`b ≤ ${fmt(limit)} ℓ₀ · конечные интервалы Ω`;return;
  }
  const finite=curve.filter(p=>Number.isFinite(p.theta)),min=Math.min(-.001,...finite.map(p=>p.theta/DEG),result.theta/DEG),ymin=Math.max(-720,Math.floor(min/90)*90),ymax=180;
  const g=axes({xmin:0,xmax:curve.at(-1).b,ymin,ymax,xlabel:'b / ℓ₀',ylabel:'Θ, °',xticks:4,yticks:Math.min(5,Math.round((ymax-ymin)/90))});
  plotLine(g,curve.map(p=>[p.b,p.theta/DEG]),C.gold,1.9,[],1,130);
  if(state.model==='lj')plotLine(g,curve.map(p=>[p.b,p.chi/DEG]),C.cyan,1.0,[3,4],.65,100);
  if(state.compare)plotLine(g,curve.map(p=>[p.b,hsAngle(p.b)/DEG]),C.dim,1,[4,4],.6);
  plotMarker(g,state.b,result.theta/DEG);
  if(state.model==='lj')legend(g,[['Θ',C.gold],['χ ∈ [0, π]',C.cyan,[3,4]]]);
  if(state.model==='lj'&&state.E<.8){const bc=criticalOrbit(state.E).b;plotLine(g,[[bc,ymin],[bc,ymax]],C.purple,1,[3,5],.7);}
  $('plotTitle').textContent='Функция рассеяния';$('plotHint').textContent='кривая: квадратура · маркер: уравнение Ньютона';
}
function measuredHistogram(){
  const bins=18,hist=Array(bins).fill(0),N=Math.floor(state.count*state.time),d=dsmcDiameter();
  for(let i=0;i<N;i++)hist[Math.min(bins-1,Math.floor((ensemble.hits[i].mu+1)/2*bins))]++;
  const omega=4*PI/bins,scale=N?PI*d*d/(N*omega):0;
  return {N,bins,hist,dcs:hist.map(h=>h*scale),err:hist.map(h=>Math.sqrt(h)*scale),omega,d};
}
function plotSampling(){
  const N=Math.floor(state.count*state.time),d=dsmcDiameter(),values=ensemble.hits.slice(0,N).map(h=>clamp(h.b/d,0,1)).sort((a,b)=>a-b),g=axes({xmin:0,xmax:1,ymin:0,ymax:1.05,xlabel:'b / d',ylabel:'F(b)',xticks:4,yticks:4}),en=document.documentElement.lang==='en';
  plotLine(g,Array.from({length:101},(_,i)=>{const x=i/100;return [x,x*x];}),C.gold,1.8);
  if(values.length){const empirical=[[0,0],...values.map((x,i)=>[x,(i+1)/values.length]),[1,1]];plotLine(g,empirical,state.wrongSampling?C.red:C.cyan,1.6);}
  if(state.wrongSampling)plotLine(g,[[0,0],[1,1]],C.red,1,[4,4],.55);
  legend(g,[[en?'area law':'по площади',C.gold],[en?'sample':'выборка',state.wrongSampling?C.red:C.cyan]]);
  $('plotTitle').textContent=en?'Impact-parameter sampling':'Выборка прицельного параметра';$('plotHint').textContent=`N = ${N} · b / d = √U`;
}
function plotEnsemble(){
  const hist=measuredHistogram(),alpha=dsmcAlpha(),max=Math.max(.3*hist.d*hist.d,...hist.dcs.map((v,i)=>v+hist.err[i]),vssDcs(0,hist.d,alpha))*1.16,en=document.documentElement.lang==='en';
  const g=axes({xmin:-1,xmax:1,ymin:0,ymax:max,xlabel:en?'cos χ  (back ← → forward)':'cos χ  (назад ← → вперёд)',ylabel:state.chapter===8?'(dσ/dΩ) / dref²':'(dσ/dΩ) / d²',xticks:4,yticks:3});
  for(let i=0;i<hist.bins;i++){
    const a=-1+2*i/hist.bins,b=-1+2*(i+1)/hist.bins,mid=(a+b)/2,value=hist.dcs[i],color=state.wrongSampling?C.red:C.cyan;
    g.c.fillStyle=color;g.c.globalAlpha=.23;g.c.fillRect(g.X(a)+1,g.Y(value),g.X(b)-g.X(a)-2,g.b-g.Y(value));g.c.globalAlpha=.82;g.c.strokeStyle=color;g.c.lineWidth=1;g.c.strokeRect(g.X(a)+1,g.Y(value),g.X(b)-g.X(a)-2,g.b-g.Y(value));
    const lo=g.Y(Math.max(0,value-hist.err[i])),hi=g.Y(value+hist.err[i]),x=g.X(mid);g.c.beginPath();g.c.moveTo(x,lo);g.c.lineTo(x,hi);g.c.moveTo(x-2.5,lo);g.c.lineTo(x+2.5,lo);g.c.moveTo(x-2.5,hi);g.c.lineTo(x+2.5,hi);chalkStroke(g.c);g.c.globalAlpha=1;
  }
  plotLine(g,Array.from({length:160},(_,i)=>{const mu=-1+2*i/159;return [mu,vssDcs(Math.acos(mu),hist.d,alpha)];}),C.gold,1.8);
  legend(g,[[en?'sample':'выборка',state.wrongSampling?C.red:C.cyan],[en?'analytic':'аналитика',C.gold]]);
  $('plotTitle').textContent=state.wrongSampling?(en?'Nonuniform beam: biased estimate':'Неоднородный пучок: статистика искажена'):(en?'Equal-solid-angle bins':'Распределение по равным телесным углам');$('plotHint').textContent=`N = ${hist.N} · ΔΩ = 4π/${hist.bins}`;
}
function plotNormalization(){
  const hist=measuredHistogram(),target=PI*hist.d*hist.d,en=document.documentElement.lang==='en';let sum=0;
  const points=[[-1,0],...hist.dcs.map((value,i)=>{sum+=value*hist.omega;return [-1+2*(i+1)/hist.bins,target?sum/target:0];})],max=Math.max(1.12,...points.map(point=>point[1]*1.06)),g=axes({xmin:-1,xmax:1,ymin:0,ymax:max,xlabel:'cos χ',ylabel:'Σσk / σT',xticks:4,yticks:4});
  plotLine(g,[[-1,1],[1,1]],C.dim,1,[5,4],.75);plotLine(g,points,state.wrongSampling?C.red:C.gold,2);if(points.length>1)plotMarker(g,1,points.at(-1)[1],state.wrongSampling?C.red:C.gold);
  legend(g,[[en?'cumulative estimate':'накопленная оценка',state.wrongSampling?C.red:C.gold],[en?'target σT':'уровень σT',C.dim,[5,4]]]);
  $('plotTitle').textContent=en?'Cross-section normalization':'Нормировка полного сечения';$('plotHint').textContent=`N = ${hist.N} · Σσk / σT = ${fmt(target?sum/target:0,4)}`;
}
function drawPlot(){const c=state.chapter;if(c===0)plotTwoBody();else if(c===1)plotCylinder();else if(c===2)plotHardSphere();else if(c===3)plotSolidAngle();else if(c===4)plotMapping();else if(c===5)plotPotential();else if(c===6)plotDeflection();else if(c===7&&state.step===0)plotSampling();else if(c===7&&state.step===2)plotNormalization();else plotEnsemble();}
function updateDiagnostics(){
  const c=state.chapter;
  if(c===5||c===6){$('diagnosticLeft').textContent=result.model==='hs'?'HS: аналитическое отражение':`ΔE/E ≤ ${scientific(result.errorE)} · ΔL/max(1,|L|) ≤ ${scientific(result.errorL)}`;$('diagnosticRight').innerHTML=result.status==='ok'?`rmin / ℓ₀ = ${fmt(result.rmin,4)} · ${result.model==='hs'?'точная геометрия':result.accepted+' шагов RK5(4)'}`:`<span class="warn">Расчёт не завершён: ${result.status}</span>`;}
  else if(c>=7){const h=measuredHistogram(),sigma=h.dcs.reduce((a,b)=>a+b,0)*h.omega;$('diagnosticLeft').textContent=`seed = ${state.seed} · ${state.wrongSampling?'неравномерный поток':'равномерно по площади'}`;$('diagnosticRight').textContent=`∑ σk ΔΩk = ${fmt(sigma,5)} · πd² = ${fmt(PI*h.d*h.d,5)}`;}
  else {$('diagnosticLeft').textContent='Упругое столкновение · без вращения и внутренних степеней свободы';$('diagnosticRight').textContent='d = R₁ + R₂';}
}

function pickStage(x,y){
  const c=state.chapter,w=renderer.width,h=renderer.height;
  if(c===1){const p=camera.pickPlane(x,y,w,h,[0,0,0],[1,0,0]);if(!p)return;const b=Math.hypot(p[1],p[2]);if(b>1.8)return;state.b=b;state.phi=(Math.atan2(p[2],p[1])/DEG+360)%360;syncControls();compute();dirty=true;}
  else if(c===4||c>=7){
    const center=[-2.55,0,0],p=camera.pickPlane(x,y,w,h,center,[1,0,0]);if(!p)return;
    const d=c>=7?dsmcDiameter():1,b=Math.hypot(p[1],p[2])/(1.48*d);if(b>1.06)return;
    state.b=b;state.phi=(Math.atan2(p[2],p[1])/DEG+360)%360;syncControls();compute();dirty=true;
  }
}
function pickPlot(e){
  if(!plotGeometry)return;const rect=$('plot').getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top,g=plotGeometry;
  if(g.type==='disk'){
    const yy=(g.y-py)/g.r,zz=(px-g.x)/g.r,b=Math.hypot(yy,zz);if(b>1.7)return;state.b=b;state.phi=(Math.atan2(zz,yy)/DEG+360)%360;syncControls();compute();dirty=true;return;
  }
  const x=clamp(g.xmin+(px-g.l)/(g.r-g.l)*(g.xmax-g.xmin),g.xmin,g.xmax);
  if(state.chapter===2||state.chapter===6&&state.plotMode==='deflection'){setParameter('b',x);}
  else if(state.chapter===3){setParameter('b',Math.cos(x*DEG/2));}
  else if(state.chapter===4){setParameter('b',Math.sqrt(x));}
  else if(state.chapter===5){
    const now=trajectoryAt(result,state.time),branch=now.x*now.vx+now.y*now.vy>=0;let best=null,dist=Infinity;
    for(const s of result.view){const same=(s.x*s.vx+s.y*s.vy>=0)===branch,delta=Math.abs(Math.hypot(s.x,s.y)-x)+(same?0:4);if(delta<dist){dist=delta;best=s;}}
    const a=result.view[0].t,b=result.view.at(-1).t;state.time=clamp((best.t-a)/(b-a),0,1);playing=false;updateTransport();dirty=true;
  }else if(state.chapter===0){state.time=x;playing=false;updateTransport();dirty=true;}
}
function safeHash(){
  const q=new URLSearchParams(location.hash.slice(1));if(!q.has('chapter'))return null;
  const restore={};const ranges={b:[0,3.1],E:[.08,8],phi:[0,360],n:[4,24],mass:[.25,4],width:[.012,.25],time:[0,1],count:[200,2400],seed:[0,4294967295],alpha:[1,3],omega:[.5,1]};
  for(const [key,[lo,hi]]of Object.entries(ranges)){if(q.has(key)){const value=Number(q.get(key));if(Number.isFinite(value))restore[key]=clamp(value,lo,hi);}}
  if(restore.count!==undefined)restore.count=[200,800,2400].reduce((a,b)=>Math.abs(b-restore.count)<Math.abs(a-restore.count)?b:a,800);
  if(restore.seed!==undefined)restore.seed=Math.round(restore.seed)>>>0;
  if(q.has('model')&&POTENTIALS[q.get('model')])restore.model=q.get('model');
  if(['hs','vhs','vss'].includes(q.get('collisionModel')))restore.collisionModel=q.get('collisionModel');
  for(const k of ['compare','wrongSampling','explore'])if(q.has(k))restore[k]=q.get(k)==='1';
  if(['deflection','dcs'].includes(q.get('plotMode')))restore.plotMode=q.get('plotMode');
  const c=Number(q.get('chapter')),s=Number(q.get('step'));return {c:Number.isFinite(c)?clamp(Math.floor(c)-1,0,8):0,s:Number.isFinite(s)?clamp(Math.floor(s||1)-1,0,2):0,restore};
}
function stateHash(){const q=new URLSearchParams({chapter:state.chapter+1,step:state.step+1});for(const key of ['model','b','E','phi','n','mass','width','time','count','seed','alpha','omega','collisionModel','plotMode'])q.set(key,String(state[key]));for(const k of ['compare','wrongSampling','explore'])if(state[k])q.set(k,'1');return '#'+q.toString();}
function download(filename,content,type='text/csv;charset=utf-8'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportCSV(){
  const meta=`# Binary collision laboratory; reduced units: length=l0, energy=epsilon, reduced mass=1\n# state=${JSON.stringify(state)}\n# source=original numerical calculation; no experimental data\n`;
  if(state.chapter>=7){const h=measuredHistogram(),rows=['index,b_over_l0,phi_rad,chi_rad,cos_chi,gx_unit,gy_unit,gz_unit,cos_chi_bin_0_based,arrived'];ensemble.hits.forEach((p,i)=>rows.push([i,p.b,p.phi,p.chi,p.mu,...p.dir,Math.min(17,Math.floor((p.mu+1)*9)),i<h.N?1:0].join(',')));download('collision-ensemble.csv',meta+`# d_over_dref=${dsmcDiameter()}; alpha=${dsmcAlpha()}; seed=${state.seed}\n`+rows.join('\n')+'\n');}
  else if(state.chapter===6){const rows=['b_over_l0,theta_signed_rad,chi_polar_rad,rmin_over_l0,status',...curve.map(p=>[p.b,p.theta,p.chi,p.rmin,p.status].join(','))];download('scattering-function.csv',meta+rows.join('\n')+'\n');}
  else {const rows=['t_reduced,x_over_l0,y_over_l0,vx_reduced,vy_reduced,E_over_epsilon,L_reduced',...result.samples.map(p=>{const r=Math.hypot(p.x,p.y),U=result.model==='hs'?0:potential(r,result.model,result.n),E=(p.vx*p.vx+p.vy*p.vy)/2+U,L=p.x*p.vy-p.y*p.vx;return [p.t,p.x,p.y,p.vx,p.vy,E,L].join(',');})];download('relative-trajectory.csv',meta+`# status=${result.status}; chi_rad=${result.chi}; max_relative_energy_error=${result.errorE}\n`+rows.join('\n')+'\n');}
  $('actionStatus').textContent='CSV сохранён';setTimeout(()=>$('actionStatus').textContent='',2200);
}
function applyPreset(name){
  state.model='lj';state.compare=false;state.time=.61;
  if(name==='weak'){state.E=2;state.b=2.5;}
  else if(name==='rainbow'){state.E=1.5;state.b=1.58;}
  else {state.E=.3;state.b=criticalOrbit(state.E).b*.9999;state.time=.55;}
  syncControls();compute();updateTransport();setView('plane');dirty=true;
}
function setProjector(){document.body.classList.toggle('projector');const on=document.body.classList.contains('projector');$('projectorButton').setAttribute('aria-pressed',on);const styles=getComputedStyle(document.documentElement),bstyles=getComputedStyle(document.body);for(const [key,varname]of Object.entries({ink:'--ink',dim:'--dim',muted:'--muted',line:'--line',cyan:'--accent',gold:'--gold'}))C[key]=bstyles.getPropertyValue(varname).trim()||styles.getPropertyValue(varname).trim();dirty=true;}
async function widgetFullscreen(element){try{if(document.fullscreenElement===element)await document.exitFullscreen();else{if(document.fullscreenElement)await document.exitFullscreen();await element.requestFullscreen();}}catch{console.error('Полный экран недоступен');}}

function syncWidgetFullscreen(){for(const [id,target]of [['boardFullscreenButton',$('board')],['plotFullscreenButton',$('plotPanel')]]){const button=$(id),active=document.fullscreenElement===target;button.dataset.fullscreen=String(active);const label=i18n.t(active?'stage.exitFullscreen':'stage.enterFullscreen');button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',label);button.title=label;}}
function syncCameraLabels(){for(const [id,key]of [['view3d','camera.volume'],['viewPlane','camera.plane'],['viewFront','camera.front'],['perspective','camera.projection']]){const button=$(id);if(!button)continue;const label=i18n.t(key);button.title=label;button.setAttribute('aria-label',label);}}
function syncStaticCopy(){
 const copy=i18n.language==='en'?{heading:'Parameters',model:'Potential',phi:'Azimuth φ',mass:'Mass ratio m₁ / m₂',width:'Ring width Δb / d',power:'Exponent n',collisionModel:'Collision model',alpha:'Scattering parameter α',omega:'Viscosity exponent ω',count:'Particle count',seed:'New sample',weak:'Weak deflection',rainbow:'Rainbow',orbit:'Orbiting',compare:'Overlay other potentials',wrong:'Uniform in b: show error',plot:'Measurement'}:{heading:'Параметры',model:'Потенциал',phi:'Азимут φ',mass:'Отношение масс m₁ / m₂',width:'Ширина кольца Δb / d',power:'Показатель n',collisionModel:'Модель столкновения',alpha:'Параметр рассеяния α',omega:'Показатель вязкости ω',count:'Число частиц',seed:'Новая выборка',weak:'Слабое отклонение',rainbow:'Радуга',orbit:'Орбитирование',compare:'Наложить другие потенциалы',wrong:'Равномерно по b: показать ошибку',plot:'Измерение'};
 const setLabel=(id,value)=>{const label=$(id)?.querySelector('label');if(!label)return;const output=label.querySelector('output');const node=[...label.childNodes].find(item=>item.nodeType===Node.TEXT_NODE);if(node)node.nodeValue=value+' ';else label.insertBefore(document.createTextNode(value+' '),output||null);};
 const heading=document.querySelector('.control-heading');if(heading){const node=[...heading.childNodes].find(item=>item.nodeType===Node.TEXT_NODE);if(node)node.nodeValue=copy.heading+' ';}
 for(const [id,key]of [['modelControl','model'],['phiControl','phi'],['massControl','mass'],['widthControl','width'],['powerControl','power'],['collisionModelControl','collisionModel'],['alphaControl','alpha'],['omegaControl','omega'],['countControl','count']])setLabel(id,copy[key]);
 const model=$('model');if(model)for(const [value,text]of [['hs',i18n.language==='en'?'Hard spheres':'Твёрдые сферы'],['ipl',i18n.language==='en'?'Power-law repulsion':'Степенное отталкивание'],['sutherland','Sutherland'],['lj','Lennard-Jones'],['coulomb',i18n.language==='en'?'Coulomb repulsion':'Кулоновское отталкивание']]){const option=[...model.options].find(item=>item.value===value);if(option)option.textContent=text;}
 $('seedButton').textContent=copy.seed;for(const [name,text]of Object.entries({weak:copy.weak,rainbow:copy.rainbow,orbit:copy.orbit})){const button=document.querySelector(`button[data-preset="${name}"]`);if(button)button.textContent=text;}
 const compare=$('compareControl'),wrong=$('wrongControl');if(compare)compare.lastChild.nodeValue=' '+copy.compare;if(wrong)wrong.lastChild.nodeValue=' '+copy.wrong;$('plotTitle').textContent=copy.plot;
}
function bind(){
  $('chapters').innerHTML=CHAPTERS.map((ch,i)=>`<button class="chapter-button" data-chapter="${i}" title="${ch.title.replace('<br>',' ')}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${ch.tab}</span></button>`).join('');
  $('chapters').addEventListener('click',e=>{const el=e.target.closest('[data-chapter]');if(el)applyLesson(Number(el.dataset.chapter),0);});
  $('steps').addEventListener('click',e=>{const el=e.target.closest('[data-step]');if(el)applyLesson(state.chapter,Number(el.dataset.step));});
  $('prevButton').onclick=()=>navigate(-1);$('nextButton').onclick=()=>navigate(1);$('resetButton').onclick=()=>applyLesson(state.chapter,state.step);
  $('playButton').onclick=togglePlay;$('rewindButton').onclick=()=>{state.time=0;playing=false;updateTransport();dirty=true;};
  $('timeSlider').oninput=e=>{state.time=+e.target.value;playing=false;updateTransport();dirty=true;};
  for(const [id,key,convert]of [['b','b',Number],['energy','E',x=>10**Number(x)],['phi','phi',Number],['mass','mass',Number],['width','width',Number],['power','n',Number],['alpha','alpha',Number],['omega','omega',Number],['count','count',Number],['model','model',String],['collisionModel','collisionModel',String]])$(id).addEventListener('input',e=>setParameter(key,convert(e.target.value)));
  for(const [id,key] of [['exactB','b'],['exactEnergy','E']])$(id).onchange=e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&e.target.value!=='')setParameter(key,clamp(v,+e.target.min,+e.target.max));else syncControls();};
  $('compare').onchange=e=>setParameter('compare',e.target.checked);$('wrongSampling').onchange=e=>setParameter('wrongSampling',e.target.checked);
  $('seedButton').onclick=()=>{state.seed=(state.seed+104729)>>>0;compute();dirty=true;};
  $('view3d').onclick=()=>setView('3d');$('viewPlane').onclick=()=>setView('plane');$('viewFront').onclick=()=>setView('front');
  $('perspective').onclick=()=>{camera.projection=camera.projection==='orthographic'?'perspective':'orthographic';camera.update();updateCameraButtons();dirty=true;};
  $('presets').onclick=e=>{const el=e.target.closest('[data-preset]');if(el)applyPreset(el.dataset.preset);};
  $('plotSwitch').onclick=e=>{const el=e.target.closest('[data-plot]');if(el){state.plotMode=el.dataset.plot;syncControls();dirty=true;}};
  $('plot').addEventListener('pointerdown',e=>{pickPlot(e);$('plot').setPointerCapture(e.pointerId);});$('plot').addEventListener('pointermove',e=>{if(e.buttons===1)pickPlot(e);});
  $('boardFullscreenButton').onclick=()=>widgetFullscreen($('board'));$('plotFullscreenButton').onclick=()=>widgetFullscreen($('plotPanel'));
  document.addEventListener('fullscreenchange',syncWidgetFullscreen);syncCameraLabels();syncStaticCopy();syncWidgetFullscreen();i18n.onChange(()=>{setChapterLanguage(i18n.language);$('chapters').innerHTML=CHAPTERS.map((ch,i)=>`<button class="chapter-button" data-chapter="${i}" title="${ch.title.replace('<br>',' ')}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${ch.tab}</span></button>`).join('');updateText();syncCameraLabels();syncStaticCopy();syncControls();updateTransport();syncWidgetFullscreen();});
  document.addEventListener('keydown',e=>{
    if($('helpDialog').open||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
    if(e.key==='ArrowRight'){e.preventDefault();navigate(1,e.shiftKey);}if(e.key==='ArrowLeft'){e.preventDefault();navigate(-1,e.shiftKey);}if(e.code==='Space'){e.preventDefault();togglePlay();}if(e.key.toLowerCase()==='r')applyLesson(state.chapter,state.step);
  });
  window.addEventListener('hashchange',()=>{const q=safeHash();if(q)applyLesson(q.c,q.s,q.restore);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;updateTransport();}});
  window.addEventListener('pagehide',()=>{playing=false;cancelAnimationFrame(frameId);controls.dispose();renderer.dispose();plotObserver.disconnect();},{once:true});
}
// A small read-only test/debug interface; it contains no private or remote data.
window.collisionLab={getState:()=>({...state,playing}),getDiagnostics:()=>({status:result?.status,errorE:result?.errorE,errorL:result?.errorL,chi:result?.chi,theta:result?.theta,rmin:result?.rmin}),go:(c,s=0)=>applyLesson(c,s),set:(key,value)=>setParameter(key,value),redraw:()=>{dirty=true;}};
bind();const restored=safeHash();applyLesson(restored?.c||0,restored?.s||0,restored?.restore||null);frameId=requestAnimationFrame(tick);
