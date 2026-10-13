import { Ink, C, graph, legend, fmt } from '../../pde-gallery/board.js';
import * as E from './euler.js';
import { Shock2D } from './shock2d.js';

const G=1.4;
const palette=['#f0d477','#e6b5d9','#b6d3a0','#8ac8db','#ef9685','#d3c19c','#bda8ee','#f4b47b','#62d5bc'];
const ids=['roe','roe-entropy','hll','hllc','hlle','vanleer','steger-warming','ausm','ausm-up'];
const labels=['Roe','Roe + entropy','HLL–Davis','HLLC','HLLE–Einfeldt','van Leer','Steger–Warming','AUSM','AUSM+up'];
const name=id=>labels[ids.indexOf(id)]??id;
const color=id=>palette[ids.indexOf(id)]??C.yellow;
const F=x=>Number.isFinite(x)?fmt(x,4):'—';
const extent=(values,pad=.13)=>{let a=Infinity,b=-Infinity;for(const v of values)if(Number.isFinite(v)){a=Math.min(a,v);b=Math.max(b,v);}if(a===Infinity)return[-1,1];const d=Math.max(b-a,Math.abs(a)*.03,1e-8);return[a-pad*d,b+pad*d];};
const maxabs=a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
const norm=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0));
const range=(a,b,n)=>Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));
const W=(rho,u,p,v=0)=>({rho,u,p,v});
const U=w=>E.primitiveToConservative(w,G);
const primitive=u=>E.conservativeToPrimitive(u,G);
const sound=w=>Math.sqrt(G*w.p/w.rho);
const variable=(w,k)=>k==='entropy'?Math.log(w.p/(w.rho**G)):k==='mach'?w.u/sound(w):w[k];
const symbol=k=>({rho:'ρ',u:'u',p:'p',entropy:'ln(p / ρᵞ)',mach:'M'}[k]??k);
const caseList=()=>Array.isArray(E.CASES)?E.CASES:Object.values(E.CASES);
const caseOf=id=>caseList().find(c=>c.id===id)??E.CASES[id];
const asPrimitive=v=>Array.isArray(v)||ArrayBuffer.isView(v)?primitive(v):v;
function note(ink,a,b=''){ink.line(42,531,958,531,C.dim);ink.text(42,559,a,17,C.white);if(b)ink.text(42,587,b,14,C.muted);}
function response(ink,stats=[],rows=[],extra={}){return{ink,stats:stats.map(([k,v])=>[k,typeof v==='number'?F(v):v]),rows,...extra};}
function initialStates(p){return[W(p.rhoL??1,p.uL??0,p.pL??1),W(p.rhoR??.125,p.uR??0,p.pR??.1)];}
function roeAverage(a,b){const l=Math.sqrt(a.rho),r=Math.sqrt(b.rho),h=w=>G*w.p/((G-1)*w.rho)+.5*(w.u*w.u+w.v*w.v);const u=(l*a.u+r*b.u)/(l+r),v=(l*a.v+r*b.v)/(l+r),H=(l*h(a)+r*h(b))/(l+r);return{u,v,H,a:Math.sqrt((G-1)*(H-.5*(u*u+v*v))),rho:l*r};}
function speeds(method,a,b){
  if(E.estimateWaveSpeeds){const s=E.estimateWaveSpeeds(method,U(a),U(b),G);if(s.SL!==undefined)return s;}
  const r=roeAverage(a,b);
  return method==='hlle'?{SL:Math.min(a.u-sound(a),r.u-r.a),SR:Math.max(b.u+sound(b),r.u+r.a),roe:r}:{SL:Math.min(a.u-sound(a),b.u-sound(b)),SR:Math.max(a.u+sound(a),b.u+sound(b)),roe:r};
}
function hllIntermediate(a,b,method){const {SL,SR}=speeds(method,a,b),l=U(a),r=U(b),fl=E.physicalFlux(l,G),fr=E.physicalFlux(r,G);return{SL,SR,state:primitive(l.map((v,k)=>(SR*r[k]-SL*v-fr[k]+fl[k])/(SR-SL)))};}
function exactAt(caseId,x,t){const raw=E.exactProfile(caseId,x,t,G);return raw?.map(asPrimitive)??null;}

function waveModels(p,L){return{render(){
  const ink=new Ink(),c=caseOf(p.caseId??'sod'),a=asPrimitive(c.left),b=asPrimitive(c.right),av=roeAverage(a,b),s=speeds(p.method,a,b),tau=p.tau??.2;
  const contact=(b.p-a.p+a.rho*a.u*(s.SL-a.u)-b.rho*b.u*(s.SR-b.u))/(a.rho*(s.SL-a.u)-b.rho*(s.SR-b.u));
  const ls=p.method==='roe'?[av.u-av.a,av.u,av.u+av.a]:p.method==='hllc'?[s.SL,contact,s.SR]:[s.SL,s.SR];
  const bound=Math.max(...ls.map(Math.abs),Math.abs(a.u)+sound(a),Math.abs(b.u)+sound(b))*tau*1.18;
  ink.title(L('Сколько волн оставляет приближённый решатель?','How many waves does an approximate solver retain?'),name(p.method));
  const g=graph(ink,{x:77,y:122,w:514,h:330,xmin:-bound,xmax:bound,ymin:0,ymax:tau*1.12,xlabel:'x − x₀',ylabel:'t',yticks:3});
  const cols=[C.blue,C.yellow,C.red];ls.forEach((v,i)=>{ink.arrow(g.X(0),g.Y(0),g.X(v*tau),g.Y(tau),cols[i%3],2.7);ink.text(g.X(v*tau),g.Y(tau)-10,F(v),15,cols[i%3],'center');});
  ink.dot(g.X(0),g.Y(0),5,C.white);ink.line(g.x,g.Y(tau),g.x+g.w,g.Y(tau),C.dim,1,true);
  ink.text(632,130,L('Состояния в веере','States in the fan'),21,C.white);
  const modelRows=p.method==='roe'?['U_L → U₁ → U₂ → U_R','λ = ũ − ã, ũ, ũ + ã']:p.method==='hllc'?['U_L → U*L → U*R → U_R','S_L, S*, S_R']:['U_L → U_HLL → U_R','S_L, S_R'];
  modelRows.forEach((v,i)=>ink.text(632,176+i*39,v,19,i?C.yellow:C.white));
  const lines=p.method==='hll'||p.method==='hlle'?[L('Контакт внутри одной средней зоны.','The contact lies inside one mean state.'),L('Его скачок не хранится отдельно.','Its jump is not retained separately.')]:[L('Средняя волна переносит контакт.','The middle wave transports the contact.'),L('u и p непрерывны через контакт.','u and p are continuous at a contact.')];
  lines.forEach((v,i)=>ink.text(632,293+i*33,v,17,C.muted));
  ink.text(632,409,L('Прямые — модель волн решателя.','Straight rays are the solver’s wave model.'),16,C.green);
  note(ink,L('Сравните HLL и HLLC, затем перейдите к неподвижному контакту.','Compare HLL with HLLC, then open the stationary-contact experiment.'),L('Точный веер разрежения содержит непрерывный диапазон скоростей; здесь показана аппроксимация.','An exact rarefaction contains a continuous range of speeds; this diagram shows an approximation.'));
  return response(ink,ls.map((v,i)=>[`S${i+1}`,v]),ls.map((v,i)=>({wave:i+1,speed:v,method:p.method})));}};}

function interfaceFlux(p,L){return{render(){
  const ink=new Ink(),[a,b]=initialStates(p),l=U(a),r=U(b),fl=E.physicalFlux(l,G),fr=E.physicalFlux(r,G),rows=[];
  ink.title(L('Одни состояния — девять численных потоков','The same states, nine numerical fluxes'),`L: (${F(a.rho)}, ${F(a.u)}, ${F(a.p)})   R: (${F(b.rho)}, ${F(b.u)}, ${F(b.p)})   |   (ρ, u, p)`);
  [L('Поток','Flux'),'Fρ','Fρu','FE'].forEach((s,i)=>ink.text([65,446,645,846][i],103,s,20,C.white,i?'right':'left'));
  ids.forEach((id,i)=>{let f;try{f=E.numericalFlux(id,l,r,G,{entropyFix:p.entropyFix??.1,lowMachCutoff:p.lowMachCutoff??1});}catch{f=[NaN,NaN,NaN,NaN];}const y=140+i*36;ink.line(65,y+11,928,y+11,C.grid);ink.text(65,y,name(id),18,color(id));[f[0],f[1],f[3]].forEach((v,j)=>ink.text([446,645,846][j],y,F(v),18,color(id),'right'));rows.push({method:id,mass:f[0],momentum:f[1],energy:f[3]});});
  const q=roeAverage(a,b),du=r.map((v,i)=>v-l[i]),u=q.u,v=q.v,h=q.H;
  const A=[[0,1,0,0],[.5*(G-3)*u*u+.5*(G-1)*v*v,(3-G)*u,-(G-1)*v,G-1],[-u*v,v,u,0],[u*(.5*(G-1)*(u*u+v*v)-h),h-(G-1)*u*u,-(G-1)*u*v,G*u]];
  const residual=norm(A.map((row,i)=>row.reduce((s,c,j)=>s+c*du[j],0)-(fr[i]-fl[i])));
  ink.text(65,498,`Roe:  ‖ Ã ΔU − ΔF ‖₂ = ${F(residual)}`,20,C.green);
  note(ink,L('Численный поток — функция двух состояний. Расхождение здесь ещё не является ошибкой.','A numerical flux is a function of two states. A difference here is not yet an error.'),L('При U_L = U_R каждый согласованный поток должен совпасть с физическим F(U).','At U_L = U_R, every consistent flux must equal the physical flux F(U).'));
  return response(ink,[[L('Невязка Роу','Roe residual'),residual],['ε entropy',p.entropyFix??.1],['M∞ (+up)',p.lowMachCutoff??1]],rows);}};}

function hllSpeeds(p,L){return{render(){
  const ink=new Ink(),[a,b]=initialStates(p),cases=['hll','hlle'].map(id=>({id,...hllIntermediate(a,b,id)})),all=cases.flatMap(c=>[c.SL,c.SR]),[lo,hi]=extent([...all,0],.2);
  ink.title(L('Одна формула HLL, разные оценки крайних скоростей','One HLL formula, different outer-speed estimates'),L('Davis: физические края обоих состояний. Einfeldt: физические и осреднённые края.','Davis: physical endpoints from both states. Einfeldt: physical and Roe-averaged endpoints.'));
  cases.forEach((c,j)=>{const y=130+j*178,g=graph(ink,{x:100,y,w:790,h:76,xmin:lo,xmax:hi,ymin:0,ymax:1,yticks:0,xlabel:'S',ylabel:''});ink.line(g.X(c.SL),g.Y(.5),g.X(c.SR),g.Y(.5),color(c.id),8);g.dot(c.SL,.5,7,color(c.id));g.dot(c.SR,.5,7,color(c.id));ink.text(100,y-15,name(c.id),21,color(c.id));ink.text(100,y+128,`S_L = ${F(c.SL)};   S_R = ${F(c.SR)};    ρ_HLL = ${F(c.state.rho)};    p_HLL = ${F(c.state.p)}`,19,c.state.p>0&&c.state.rho>0?C.white:C.red);});
  note(ink,L('Проверьте сильное разрежение. Какие состояния попадают внутрь скоростной оболочки?','Try strong rarefaction. Which states fall inside the estimated wave envelope?'),L('Положительность промежуточного состояния и положительность полного шага — разные проверки.','Positivity of an intermediate state and positivity of a full update are separate checks.'));
  return response(ink,cases.flatMap(c=>[[`${name(c.id)} ρ*`,c.state.rho],[`${name(c.id)} p*`,c.state.p]]),cases.map(c=>({method:c.id,SL:c.SL,SR:c.SR,rhoHLL:c.state.rho,pHLL:c.state.p})));}};}

function splitFVS(method,w,sign){
  if(E.splitFlux)return E.splitFlux(method,U(w),sign,G);
  const a=sound(w),m=w.u/a,full=E.physicalFlux(U(w),G);
  if(method==='vanleer'){
    if(sign*m>=1)return full;if(sign*m<=-1)return[0,0,0,0];
    const f=sign*.25*w.rho*a*(m+sign)**2,un=((G-1)*w.u+sign*2*a)/G;
    return[f,f*un,f*w.v,f*((((G-1)*w.u+sign*2*a)**2)/(2*(G*G-1))+.5*w.v*w.v)];
  }
  const sp=x=>.5*(x+sign*Math.abs(x)),q0=w.rho*(G-1)/G*sp(w.u),qm=w.rho/(2*G)*sp(w.u-a),qp=w.rho/(2*G)*sp(w.u+a),H=G*w.p/((G-1)*w.rho)+.5*(w.u*w.u+w.v*w.v);
  return[q0+qm+qp,q0*w.u+qm*(w.u-a)+qp*(w.u+a),(q0+qm+qp)*w.v,q0*.5*(w.u*w.u+w.v*w.v)+qm*(H-w.u*a)+qp*(H+w.u*a)];
}
function fluxSplitting(p,L){return{render(){
  const ink=new Ink(),method=p.method??'vanleer',comp={mass:0,momentum:1,energy:3}[p.component??'mass'],xs=range(-2.2,2.2,301),get=(m,s)=>splitFVS(method,W(1,m,1/G),s)[comp],plus=xs.map(m=>get(m,1)),minus=xs.map(m=>get(m,-1)),total=xs.map((m,i)=>plus[i]+minus[i]),ext=extent([...plus,...minus,...total]);
  ink.title(L('Разделить физический поток по направлениям','Split the physical flux by propagation direction'),`${name(method)}   |   ρ = a = 1;  p = 1/γ`);
  const g=graph(ink,{x:90,y:125,w:815,h:290,xmin:-2.2,xmax:2.2,ymin:ext[0],ymax:ext[1],xlabel:'M',ylabel:`F (${p.component})`});g.series(xs,total,C.white,1.5);g.series(xs,plus,C.yellow,2.3);g.series(xs,minus,C.blue,2.3);
  [-1,1].forEach(x=>ink.line(g.X(x),g.y,g.X(x),g.y+g.h,C.dim,1.4,true));const m=p.mach??.3;g.dot(m,get(m,1),6,C.yellow);g.dot(m,get(m,-1),6,C.blue);legend(ink,[['F = F⁺ + F⁻',C.white],['F⁺',C.yellow],['F⁻',C.blue]],464);
  ink.text(89,506,`M = ${F(m)}:    F⁺ = ${F(get(m,1))};    F⁻ = ${F(get(m,-1))}`,20,C.white);
  note(ink,L('Проследите переход через M = ±1. Затем проверьте, что происходит с контактом.','Follow the transition through M = ±1. Then test what happens to a contact.'),L('van Leer здесь — расщепление потока Эйлера, а не ограничитель наклона из предыдущей лекции.','Here van Leer means Euler flux-vector splitting, not the slope limiter from the previous lecture.'));
  return response(ink,[['M',m],['F⁺',get(m,1)],['F⁻',get(m,-1)],['F',get(m,1)+get(m,-1)]],xs.map((m,i)=>({mach:m,positive:plus[i],negative:minus[i],physical:total[i]})));}};}

function machSplit(m,s,up){if(Math.abs(m)>=1)return.5*(m+s*Math.abs(m));const basic=s*.25*(m+s)**2;return up?basic+s*.125*(m*m-1)**2:basic;}
function pressureSplit(m,s,alpha=0){if(Math.abs(m)>=1)return .5*(1+s*Math.sign(m));return .25*(m+s)**2*(2-s*m)+s*alpha*m*(m*m-1)**2;}
function ausmSplit(p,L){return{render(){
  const ink=new Ink(),up=p.variant==='ausm-up',ml=p.machL??.2,mr=p.machR??-.1,m0=Math.sqrt(Math.min(1,Math.max((ml*ml+mr*mr)/2,(p.lowMachCutoff??.1)**2))),fa=m0*(2-m0),alpha=up?3/16*(-4+5*fa*fa):0,xs=range(-2,2,241);
  ink.title(L('AUSM: раздельные полиномы для переноса и давления','AUSM: separate polynomials for advection and pressure'),`${up?'AUSM+up: M₄, P₅':'AUSM: M₂, P₃'}   |   f_a = ${F(fa)};  α = ${F(alpha)}`);
  const a=graph(ink,{x:83,y:142,w:370,h:250,xmin:-2,xmax:2,ymin:-2.1,ymax:2.1,xlabel:'M',ylabel:'M⁺, M⁻'}),b=graph(ink,{x:562,y:142,w:345,h:250,xmin:-2,xmax:2,ymin:-.1,ymax:1.1,xlabel:'M',ylabel:'P⁺, P⁻'});
  for(const s of[1,-1]){const col=s===1?C.yellow:C.blue;a.series(xs,xs.map(m=>machSplit(m,s,up)),col,2.4);b.series(xs,xs.map(m=>pressureSplit(m,s,alpha)),col,2.4);}
  a.dot(ml,machSplit(ml,1,up),6,C.yellow);a.dot(mr,machSplit(mr,-1,up),6,C.blue);b.dot(ml,pressureSplit(ml,1,alpha),6,C.yellow);b.dot(mr,pressureSplit(mr,-1,alpha),6,C.blue);
  const mf=machSplit(ml,1,up)+machSplit(mr,-1,up),pf=pressureSplit(ml,1,alpha)+pressureSplit(mr,-1,alpha),pu=up?-.75*pressureSplit(ml,1,alpha)*pressureSplit(mr,-1,alpha)*2*fa*(mr-ml):0;
  ink.text(82,454,`M⁺(M_L) + M⁻(M_R) = ${F(mf)}`,20,C.yellow);ink.text(82,495,`P⁺(M_L) + P⁻(M_R) = ${F(pf)};    P_u / (ρa²) = ${F(pu)}`,20,C.blue);
  note(ink,up?L('Добавки M_p и P_u связывают скачки давления и скорости с численными потоками.','The M_p and P_u terms couple pressure and velocity jumps to the numerical fluxes.'):L('Сложите положительную часть слева и отрицательную справа.','Combine the positive contribution from the left with the negative contribution from the right.'),L('Полиномиальный этап: коэффициенты нормированы, скачок давления нулевой, M_p = 0.','Polynomial stage: normalized coefficients, zero pressure jump, M_p = 0.'));
  return response(ink,[['M split',mf],['P split',pf],['f_a',fa],['P_u / ρa²',pu]],xs.map(m=>({mach:m,Mplus:machSplit(m,1,up),Mminus:machSplit(m,-1,up),Pplus:pressureSplit(m,1,alpha),Pminus:pressureSplit(m,-1,alpha)})));}};}

function lowMach(p,L){return{render(){
  const ink=new Ink(),selected=[p.methodA??'roe',p.methodB??'ausm-up'],xs=range(-4,0,100),grad=p.gradient??.1;
  const measure=(method,log)=>{const m=10**log,a=W(1,m*(1-grad/2),1/G),b=W(1,m*(1+grad/2),1/G),ul=U(a),ur=U(b),central=.5*(E.physicalFlux(ul,G)[1]+E.physicalFlux(ur,G)[1]),f=E.numericalFlux(method,ul,ur,G,{lowMachCutoff:p.cutoffMode==='fixed'?(p.lowMachCutoff??.01):m,entropyFix:.1})[1];return Math.abs(central-f)/(m*m);};
  const ys=selected.map(method=>xs.map(x=>Math.log10(Math.max(1e-15,measure(method,x))))),ext=extent(ys.flat());
  ink.title(L('Малое число Маха: сколько диссипации остаётся?','Low Mach number: how much dissipation remains?'),L('Локальный тест: ρ = a = 1, p = 1/γ; Δu = ε M. Временного расчёта нет.','Local test: ρ = a = 1, p = 1/γ; Δu = ε M. No time integration.'));
  const g=graph(ink,{x:88,y:137,w:800,h:270,xmin:-4,xmax:0,ymin:Math.floor(ext[0]),ymax:Math.ceil(ext[1]),xlabel:'log₁₀ M',ylabel:'log₁₀(|Dρu| / M²)'});
  selected.forEach((id,i)=>g.series(xs,ys[i],color(id),2.6));const at=p.logMach??-2;ink.line(g.X(at),g.y,g.X(at),g.y+g.h,C.dim,1.5,true);selected.forEach(id=>g.dot(at,Math.log10(Math.max(1e-15,measure(id,at))),6,color(id)));legend(ink,selected.map(id=>[name(id),color(id)]),455,88,360);
  ink.text(88,499,`M = ${F(10**at)};   M∞ = ${p.cutoffMode==='fixed'?F(p.lowMachCutoff??.01):'M'};   ε = ${F(grad)}`,20,C.white);
  note(ink,L('Наклон −1 означает диссипацию порядка M вместо масштаба инерции M².','A slope of −1 means dissipation of order M instead of the inertial scale M².'),L('Это диагностика потока; она не заменяет вихревой тест и не задаёт рейтинг для акустики.','This flux diagnostic does not replace a vortex test or rank methods for acoustic propagation.'));
  return response(ink,selected.map(id=>[`${name(id)} |D|/M²`,measure(id,at)]),xs.map((x,i)=>({mach:10**x,cutoff:p.cutoffMode==='fixed'?p.lowMachCutoff:10**x,[selected[0]]:10**ys[0][i],[selected[1]]:10**ys[1][i]})));}};}

function comparison(id,p,L){
  const caseId=p.caseId??(id==='comparison'?'sod':id),c=caseOf(caseId),selected=p.mode==='all'?ids:[...new Set([p.methodA??'roe',p.methodB??'hllc'])],n=p.N??200;
  const solvers=selected.map(method=>new E.Euler1D({method,caseId,n,cfl:p.cfl??.35,gamma:G,order:1,entropyFix:p.entropyFix??.1,lowMachCutoff:p.lowMachCutoff??1,safety:'strict'}));
  const tEnd=c.tEnd,dx=((c.xMax??1)-(c.xMin??0))/n;
  let time=0,count=0,stopped='';
  const xs=solvers[0].x;
  function step(){if(stopped)return;let speed=0;for(const s of solvers)if(!s.failed)for(const u of s.U){const w=primitive(u);speed=Math.max(speed,Math.abs(w.u)+sound(w));}
    for(const side of[c.left,c.right])if(side){const w=asPrimitive(side);speed=Math.max(speed,Math.abs(w.u)+sound(w));}
    if(!(speed>0)){stopped=L('Все расчёты остановлены.','All runs stopped.');return;}
    const dt=Math.min((p.cfl??.35)*dx/speed,tEnd-time);if(dt<=1e-14){stopped='■';return;}
    for(const s of solvers)if(!s.failed)s.step(dt);
    time+=dt;count++;if(solvers.every(s=>s.failed))stopped=L('Все методы потеряли допустимость; значения не обрезаны.','All methods lost admissibility; values were not clipped.');else if(time>=tEnd-1e-12)stopped='■';
  }
  return{get time(){return time;},get count(){return count;},get stop(){return stopped;},step,render(){
    const ink=new Ink(),key=p.variable??'rho',reference=exactAt(caseId,xs,time),profiles=solvers.map(s=>s.failed?null:Array.from(s.profile(key))),exact=reference?.map(w=>variable(w,key)),valid=profiles.filter(Boolean),ext=extent([...valid.flat(),...(exact??[])]),all=p.mode==='all';
    ink.title(L('Меняется поток; сетка и шаг времени общие','Change the flux; keep the grid and time step shared'));
    const errors=solvers.map(s=>s.failed||!reference?null:Array.from(s.profile('rho')).reduce((z,v,i)=>z+Math.abs(v-reference[i].rho),0)/n);
    selected.forEach((method,i)=>{const col=all?i%3:i,row=all?Math.floor(i/3):0,x=84+col*(all?292:350),y=91+row*25;ink.line(x,y-5,x+21,y-5,color(method),2.5);ink.text(x+31,y,name(method)+(solvers[i].failed?' ×':all&&errors[i]!==null?` ${F(errors[i])}`:''),15,solvers[i].failed?C.red:color(method));});
    const residual=!all&&exact?profiles.map(v=>v?.map((u,i)=>u-exact[i])):null,showResidual=!!residual&&maxabs(residual.filter(Boolean).flat())>1e-6;
    const g=graph(ink,{x:84,y:all?179:130,w:825,h:all?243:showResidual?243:340,xmin:c.xMin??0,xmax:c.xMax??1,ymin:ext[0],ymax:ext[1],xlabel:'x',ylabel:symbol(key)});
    if(exact)g.series(xs,exact,C.white,1.7);
    profiles.forEach((v,i)=>{if(v)g.series(xs,v,color(selected[i]),2.25);});
    const failures=solvers.map((s,i)=>s.failed?`${name(selected[i])}: ${L('сбой при t','failed at t')}=${F(s.failureTime??s.time)}`:null).filter(Boolean);
    const rows=Array.from(xs,(x,i)=>{const r={x,time};solvers.forEach((s,j)=>{r[`${selected[j]}_${key}`]=s.failed?'':profiles[j][i];r[`${selected[j]}_time`]=s.time;r[`${selected[j]}_status`]=s.failed?'failed':'valid';});if(reference)r[`exact_${key}`]=exact[i];return r;});
    if(showResidual){const rex=extent(residual.filter(Boolean).flat(),.2),r=graph(ink,{x:84,y:433,w:825,h:64,xmin:c.xMin??0,xmax:c.xMax??1,ymin:rex[0],ymax:rex[1],xlabel:'x',ylabel:L('разность','difference'),yticks:2,xticks:3});residual.forEach((v,i)=>{if(v)r.series(xs,v,color(selected[i]),1.8);});}
    else if(all||!exact){const text=reference?L('Числа в легенде: среднее |ρ − ρточн| в центрах.','Legend numbers: mean |ρ − ρexact| at centers.'):L('Аналитического эталона нет. Сравните сетки N и 2N.','No analytic reference. Compare grids N and 2N.');ink.text(84,464,text,17,C.white);}
    const active=solvers.filter(s=>!s.failed),minP=active.length?Math.min(...active.map(s=>s.minP)):NaN;
    note(ink,failures.length?failures.slice(0,2).join(' · '):L('Белая линия — точное решение; цветные — расчёт.','White: the exact solution; colored: computed.'));
    const stats=[['t',time],['min p',minP]];if(failures.length)stats.push([L('Сбоев','Failed'),failures.length]);
    if(!all)selected.forEach((m,i)=>{if(errors[i]!==null)stats.push([`${name(m)} Eρ`,errors[i]]);});
    const failureDetail=solvers.filter(s=>s.failed).map(s=>`${name(s.method)}: ${s.failureReason}`).join(' | ');
    return response(ink,stats,rows,{note:failureDetail||L('Пробел: расчёт. N: один общий шаг.','Space: run. N: one shared step.'),warning:!!failureDetail});
  }};
}

function heatColor(z,diverging=false){z=Math.max(0,Math.min(1,z));const stops=diverging?[[50,92,124],[230,232,221],[197,90,72]]:[[23,41,39],[82,136,131],[226,207,135]];const k=z<.5?0:1,t=k===0?z*2:(z-.5)*2;return`rgb(${stops[k].map((v,i)=>Math.round(v+(stops[k+1][i]-v)*t)).join(',')})`;}
function shock(p,L){
  const selected=[p.methodA??'roe',p.methodB??'hlle'],nx=p.nx??96,ny=Math.max(16,Math.round(nx/3/2)*2),opts={nx,ny,mach:p.mach??6,perturbation:p.perturbation??.001,cfl:p.cfl??.3,entropyFix:p.entropyFix??.1,lowMachCutoff:p.lowMachCutoff??1};
  const solvers=selected.map(method=>new Shock2D({...opts,method})),history=solvers.map(s=>[[0,s.metrics().transverseRms]]);let time=0,count=0,stopped='';const tEnd=3;
  return{get time(){return time;},get count(){return count;},get stop(){return stopped;},step(){if(stopped)return;let dt=Infinity;for(const s of solvers)if(!s.failed){if(s.stableDt)dt=Math.min(dt,s.stableDt());else if(s.timeStep)dt=Math.min(dt,s.timeStep());else dt=Math.min(dt,(p.cfl??.3)/(nx*1.6+ny*1.6));}dt=Math.min(dt,tEnd-time);if(!(dt>1e-14&&Number.isFinite(dt))){stopped='■';return;}for(const s of solvers)if(!s.failed)s.step(dt);time=Math.max(...solvers.map(s=>s.time));count++;if(count%4===0)solvers.forEach((s,i)=>{const m=s.metrics();history[i].push([s.time,m.transverseRms??m.ripple??0]);});if(solvers.every(s=>s.failed))stopped=L('Оба расчёта остановлены.','Both runs stopped.');else if(time>=tEnd-1e-10)stopped='■';},render(){
    const ink=new Ink(),trans=p.field==='transverse',fields=solvers.map(s=>trans?s.transverseVelocityField():s.densityField()),all=fields.flatMap(v=>Array.from(v));let lo,hi;if(trans){hi=Math.max(1e-7,maxabs(all));lo=-hi;}else{lo=Math.min(...all);hi=Math.max(...all);}
    ink.title(L('Карбанкл: неустойчивость плоской ударной волны в 2D','Carbuncle: a two-dimensional planar shock instability'));
    solvers.forEach((s,k)=>{const x=73+k*471,y=136,w=405,h=w*ny/nx;ink.text(x,101,name(selected[k])+(s.failed?' ×':''),20,s.failed?C.red:color(selected[k]));const f=fields[k],flipped=new Float64Array(f.length);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)flipped[(ny-1-j)*nx+i]=f[j*nx+i];
      ink.field(flipped,nx,ny,{x,y,w,h,min:lo,max:hi>lo?hi:lo+1e-9,palette:trans?'diverging':'chalk'});
      ink.rect(x,y,w,h,null,C.dim,1);ink.text(x,y+h+23,'0',14,C.muted);ink.text(x+w,y+h+23,'1  x',14,C.muted,'right');ink.text(x-6,y+4,F(s.yMax),12,C.muted,'right');ink.text(x-6,y+h,'0',12,C.muted,'right');const m=s.metrics();ink.text(x,342,`${L('Изгиб фронта','Front ripple')} = ${F(m.ripple)} Δx`,18,C.white);});
    const xx=history.flatMap(a=>a.map(q=>q[0])),yy=history.flatMap(a=>a.map(q=>Math.log10(Math.max(q[1],1e-14))));
    if(xx.length>1){const ex=extent(yy,.1),g=graph(ink,{x:85,y:395,w:824,h:92,xmin:0,xmax:Math.max(.1,time),ymin:Math.floor(ex[0]),ymax:Math.ceil(ex[1])||1,xlabel:'t',ylabel:'',xticks:3,yticks:2});ink.text(909,g.y-12,'log₁₀ RMS(v)',14,C.muted,'right');history.forEach((a,i)=>g.series(a.map(q=>q[0]),a.map(q=>Math.log10(Math.max(q[1],1e-14))),color(selected[i]),1.8));}
    else ink.text(84,445,L('Запустите расчёт: здесь появится рост поперечного возмущения.','Run the calculation: the growth of the transverse perturbation appears here.'),17,C.muted);
    note(ink,L('Одинаковая цветовая шкала:','Shared color scale:')+` ${trans?'v':'ρ'} ∈ [${F(lo)}, ${F(hi)}]`);
    const rows=[];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const row={i,j,time};fields.forEach((f,k)=>{row[`${selected[k]}_${trans?'v':'rho'}`]=f[j*nx+i];row[`${selected[k]}_time`]=solvers[k].time;});rows.push(row);}
    const metrics=solvers.map(s=>s.metrics());return response(ink,[[`${name(selected[0])} RMS(v)`,metrics[0].transverseRms],[`${name(selected[1])} RMS(v)`,metrics[1].transverseRms],['t',time]],rows,{note:solvers.some(s=>s.failed)?solvers.filter(s=>s.failed).map(s=>s.failureReason).join(' | '):L('Сравните ε=0 и малое возмущение. Рост вычисляется, а не задаётся анимацией.','Compare ε=0 with a small perturbation. Growth is computed by the solver.'),warning:solvers.some(s=>s.failed)});
  }};
}

export function createLab(id,params,lang='ru'){
  const L=(ru,en)=>lang==='en'?en:ru,p={...params};
  const factories={'wave-models':waveModels,'interface-flux':interfaceFlux,'hll-speeds':hllSpeeds,'flux-splitting':fluxSplitting,'ausm-split':ausmSplit,'low-mach':lowMach,'carbuncle':shock};
  return factories[id]?factories[id](p,L):comparison(id,p,L);
}
export default { createLab };
