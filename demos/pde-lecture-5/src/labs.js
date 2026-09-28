import * as module0 from '../../pde-gallery/board.js';
import module1 from './kernels.js';
const __modules = { "board.js": module0, "kernels.js": module1 };
const moduleValue = (() => {
const {Ink,C,graph,legend,fmt,fmtTex}=__modules['board.js'];
const {clamp,mod,linspace,sum,maxabs,norm1,tv,metrics,linearCoefficients,linearStep,predictorCorrector,slope,limiter,limitedFluxes,fluxLimitedStep,polynomialFromAverages,polynomialAverage,poly,eno,weno5,wenoPolynomials,faceStates,numericalFlux,rkStep,initialAverages,profile,localData,reconstructionStudy,burgersAverage,convergenceRate}=__modules['kernels.js'];
const colors=[C.blue,C.yellow,C.red];
const F=x=>fmt(x,4),T=x=>fmtTex(x,4);
const diff=(a,b)=>a.map((v,i)=>v-b[i]);
const average=a=>sum(a)/a.length;
const extent=(a,pad=.16)=>{const l=Math.min(...a),r=Math.max(...a),d=Math.max(r-l,.1);return [l-pad*d,r+pad*d];};
const centers=n=>Array.from({length:n},(_,i)=>(i+.5)/n);
const names={upwind:'upwind',lw:'Lax–Wendroff',lf:'Lax–Friedrichs',bw:'Beam–Warming',fromm:'Fromm',mc:'MUSCL / MC',eno3:'ENO3',wenojs:'WENO-JS',wenoz:'WENO-Z',linear5:'linear 5',minmod:'minmod',superbee:'superbee',vanleer:'van Leer'};
function foot(ink,a,b=''){ink.line(42,519,958,519,C.dim);ink.text(42,549,a,18,C.white);if(b)ink.text(42,579,b,16,C.muted);}
function footMath(ink,tex,b=''){ink.line(42,519,958,519,C.dim);ink.math(42,549,tex,18,C.white);if(b)ink.text(42,579,b,16,C.muted);}
// Board formulas are TeX (lib/chalkish/src/tex.js); numbers go in through T.
function formula(ink,x,y,tex,col=C.yellow,size=20){ink.math(x,y,tex,size,col);}
function bars(ink,g,values,col=C.yellow,labels=false,width=.66){values.forEach((v,i)=>{ink.rect(g.X(i-width/2),g.Y(Math.max(0,v)),g.w/(g.xmax-g.xmin)*width,Math.abs(g.Y(v)-g.Y(0)),col,col);if(labels)ink.text(g.X(i),g.Y(v)+(v<0?23:-9),F(v),14,col,'center');});}
function staircase(ink,g,u,{color=C.white,width=2,x0=0,h=1/u.length,select=-1}={}){const pts=[];u.forEach((v,i)=>{pts.push([x0+i*h,v],[x0+(i+1)*h,v]);if(i===select&&v>=g.ymin&&v<=g.ymax)ink.rect(g.X(x0+i*h),g.y,g.w/(g.xmax-g.xmin)*h,g.h,null,C.yellow,1.3);});let group=[];const flush=()=>{if(group.length>1)ink.path(group,color,width);group=[];};pts.forEach(([x,y])=>{if(x>=g.xmin-1e-9&&x<=g.xmax+1e-9&&y>=g.ymin&&y<=g.ymax)group.push([g.X(x),g.Y(y)]);else flush();});flush();}
// Grid lines on the cell faces ξ = i ± ½ between a and b.
function faces(a,b){return Array.from({length:Math.round(b-a)+1},(_,i)=>a+i);}
function localGraph(ink,data,{y=111,h=252,w=858,xmin=-3.5,xmax=3.5,selection=[]}={}){
 const vals=Array.from({length:Math.ceil(xmax-xmin)+1},(_,i)=>data.get(Math.floor(xmin)+i)),ex=extent(vals);
 const g=graph(ink,{y,h,w,xmin,xmax,ymin:Math.min(ex[0],-.1),ymax:ex[1],xticks:faces(xmin,xmax),yticks:4,xlabel:'ξ',ylabel:'ū, p'});
 for(let j=Math.ceil(xmin-.5);j<=Math.floor(xmax+.5);j++){
  if(j-.5<g.xmin||j+.5>g.xmax)continue;
  ink.line(g.X(j-.5),g.y,g.X(j-.5),g.y+g.h,C.grid);
  ink.line(g.X(j-.42),g.Y(data.get(j)),g.X(j+.42),g.Y(data.get(j)),selection.includes(j)?C.yellow:C.white,selection.includes(j)?4:2);
  g.dot(j,data.get(j),3,selection.includes(j)?C.yellow:C.white);
 }
 g.curve(data.f,C.dim,1.4,400,true);ink.line(g.X(.5),g.y-4,g.X(.5),g.y+g.h,C.green,2,true);
 return g;
}
function stageBoxes(ink,labels,stage){const start=90,w=250,gap=40;labels.forEach((s,i)=>{ink.rect(start+i*(w+gap),79,w,35,i===stage?C.grid:null,i===stage?C.yellow:C.dim,1.5);ink.text(start+i*(w+gap)+w/2,103,s,17,i===stage?C.yellow:C.muted,'center');if(i<2)ink.arrow(start+i*(w+gap)+w+5,96,start+(i+1)*(w+gap)-6,96,C.muted);});}
function response(ink,stats,rows,note='',warning=false){return {ink,stats:stats.map(([k,v])=>[k,typeof v==='number'?F(v):v]),rows,note,warning};}

function linearBuilder(p,L){let plane;return {render(){const ink=new Ink(),c=linearCoefficients(p.nu,'family',p.q),mon=c.every(([,b])=>b>=-1e-12),err=p.q-p.nu*p.nu;
 ink.title(L('Согласование моментов строит схему','Moment conditions construct the scheme'),L('Нажмите на плоскость параметров. Жёлтая точка — текущая схема.','Click the parameter plane. Yellow is the current method.'));
 plane=graph(ink,{x:83,y:115,w:420,h:284,xmin:0,xmax:1,ymin:0,ymax:1.2,xlabel:'ν',ylabel:'q'});
 for(let i=0;i<=40;i++){const x=i/40;ink.line(plane.X(x),plane.Y(x),plane.X(x),plane.Y(1),C.grid,5);}
 plane.curve(x=>x,C.green,2);plane.curve(x=>x*x,C.blue,3);ink.line(plane.X(0),plane.Y(1),plane.X(1),plane.Y(1),C.green,2);plane.dot(p.nu,p.q,7,C.yellow);
 ink.text(plane.X(.17),plane.Y(.8),L('bⱼ ≥ 0','bⱼ ≥ 0'),22,C.green);
 const bgraph=graph(ink,{x:594,y:115,w:302,h:230,xmin:-.65,xmax:2.65,ymin:-.5,ymax:1.3,xticks:0,xlabel:'',ylabel:'bⱼ'});bars(ink,bgraph,c.map(v=>v[1]),C.yellow,true);
 ['b₋','b₀','b₊'].forEach((s,i)=>ink.text(bgraph.X(i),381,s,20,C.white,'center'));
 formula(ink,580,435,String.raw`\sum_j b_j = 1;\quad \sum_j j\,b_j = -\nu`,C.white,20);
 formula(ink,580,470,String.raw`\sum_j j^2 b_j - \nu^2 = ${T(err)}`,Math.abs(err)<1e-12?C.green:C.red,20);
 legend(ink,[['q = ν²',C.blue],['ν ≤ q ≤ 1',C.green]],449,85,220);
 foot(ink,mon?L('Коэффициенты неотрицательны: шаг сохраняет порядок данных.','Nonnegative coefficients: the step preserves the ordering of data.'):L('Есть отрицательный коэффициент: найдётся неотрицательное возмущение с отрицательным откликом.','A negative coefficient allows a positive perturbation to produce a negative response.'),L('При 0 < ν < 1 парабола второго порядка проходит ниже области монотонности.','For 0 < ν < 1 the second-order parabola lies below the monotonicity region.'));
 return response(ink,[['ν',p.nu],['q',p.q],[L('min b','min b'),Math.min(...c.map(v=>v[1]))],[L('Второй момент − ν²','Second moment − ν²'),err]],c.map(([offset,coefficient])=>({offset,coefficient})));},click(x,y){if(!plane?.contains(x,y))return false;const[a,b]=plane.inverse(x,y);p.nu=Math.round(clamp(a,0,1)/.02)*.02;p.q=Math.round(clamp(b,0,1.2)/.02)*.02;return true;}};}

function twoStage(p,L){const u=initialAverages(48,p.profile),non=p.equation==='burgers',sol=predictorCorrector(u,p.nu,p.method,non),other=predictorCorrector(u,p.nu,p.method==='maccormack'?'richtmyer':'maccormack',non),xs=centers(48);let phase=0;
 return {get count(){return phase;},get time(){return phase===2?p.nu/48:0;},get stop(){return phase>=2?'■':'';},step(){phase=Math.min(2,phase+1);},render(){const ink=new Ink();ink.title(L('Не скрываем предиктор и корректор','Expose the predictor and corrector'),`${p.method==='maccormack'?'MacCormack':'Richtmyer'}   |   f(u) = ${non?'u²/2':'u'}`);stageBoxes(ink,[L('Данные uⁿ','Data uⁿ'),L('Предиктор u*','Predictor u*'),L('Корректор uⁿ⁺¹','Corrector uⁿ⁺¹')],phase);
 const ex=extent([...u,...sol.pred,...sol.after]),g=graph(ink,{y:153,h:220,ymin:ex[0],ymax:ex[1]});g.series(xs,u,C.white,2,false);
 if(phase>=1)g.series(p.method==='richtmyer'?xs.map(v=>v+1/96):xs,sol.pred,C.blue,2,true);
 if(phase>=2)g.series(xs,sol.after,C.yellow,2.7,true);
 legend(ink,[[L('вход','input'),C.white],[L('предиктор','predictor'),C.blue],[L('итог','update'),C.yellow]],417);
 formula(ink,74,457,p.method==='richtmyer'?String.raw`u^*_{i+½} = \frac12(u_i+u_{i+1}) - \frac12\lambda\left[f(u_{i+1})-f(u_i)\right]`:String.raw`u^*_i = u_i - \lambda\left[f(u_{i+1})-f(u_i)\right]`,C.blue,20);
 formula(ink,74,491,p.method==='richtmyer'?String.raw`u^{n+1}_i = u_i - \lambda\left[f(u^*_{i+½})-f(u^*_{i-½})\right]`:String.raw`u^{n+1}_i = \frac12\left\{u_i+u^*_i - \lambda\left[f(u^*_i)-f(u^*_{i-1})\right]\right\}`,C.yellow,20);
 const difference=maxabs(diff(sol.after,other.after));footMath(ink,String.raw`\max|\text{MacCormack} - \text{Richtmyer}| = ${T(difference)}`,non?L('Нелинейность потока разрушает прежнюю алгебраическую эквивалентность.','A nonlinear flux breaks the previous algebraic equivalence.'):L('Один и тот же итоговый LW-шаг; промежуточные поля различны.','The same final LW step; different intermediate fields.'));
 return response(ink,[[L('Этап','Stage'),`${phase}/2`],['τ/h',p.nu],['Δ MC/R',difference],[L('Изменение среднего','Mean change'),average(sol.after)-average(u)]],u.map((v,i)=>({x:xs[i],input:v,predictor:sol.pred[i],predictor_x:p.method==='richtmyer'?xs[i]+1/96:xs[i],after:sol.after[i],other_after:other.after[i]})));}};}

function orderTest(p,L){return {render(){const ink=new Ink(),n=14,u=Array.from({length:n},(_,i)=>.5+.1*Math.sin(i)),v=[...u];v[p.j]+=p.delta;const a=linearStep(u,p.nu,p.scheme),b=linearStep(v,p.nu,p.scheme),incr=diff(b,a);
 ink.title(L('Монотонность — свойство оператора H','Monotonicity is a property of the operator H'),L('Сверху меняем один вход, снизу измеряем все выходные отклики.','One input is changed above; every output response is measured below.'));
 const top=graph(ink,{y:110,h:105,xmin:-.5,xmax:13.5,ymin:0,ymax:1.15,xticks:7,yticks:2,xlabel:'j',ylabel:'v − u'});bars(ink,top,diff(v,u),C.green,false);
 const bottom=graph(ink,{y:292,h:136,xmin:-.5,xmax:13.5,ymin:-.35,ymax:1.3,xticks:7,yticks:3,xlabel:'i',ylabel:'H(v) − H(u)'});incr.forEach((d,i)=>bars(ink,{...bottom,X:j=>bottom.X(j+i)},[d],d< -1e-14?C.red:C.blue,true));
 ink.arrow(top.X(p.j),240,bottom.X(p.j),264,C.yellow);formula(ink,600,259,String.raw`\delta = ${T(p.delta)};\quad \nu = ${T(p.nu)}`,C.white,20);
 const c=linearCoefficients(p.nu,p.scheme);formula(ink,72,480,c.map(([j,b])=>`b_{${j}} = ${T(b)}`).join(String.raw`\qquad `),C.white,19);
 const neg=Math.min(...incr);foot(ink,neg<-1e-12?L('v ≥ u, но не H(v) ≥ H(u): отрицательный отклик найден.','v ≥ u, but not H(v) ≥ H(u): a negative response was found.'):L('Для этого линейного шага все коэффициенты и отклики неотрицательны.','For this linear step, all coefficients and responses are nonnegative.'),L('Не путайте монотонность H с визуальной монотонностью одного профиля.','Do not confuse order preservation by H with a monotone-looking profile.'));
 return response(ink,[[L('min(v−u)','min(v−u)'),0],[L('min отклика','Minimum response'),neg],[L('Σ откликов','Response sum'),sum(incr)]],u.map((x,i)=>({cell:i,u:x,v:v[i],Hu:a[i],Hv:b[i],response:incr[i]})));}};}

function variation(p,L){const n=16;let u=Array.isArray(p.values)&&p.values.length===n?[...p.values]:initialAverages(n,p.profile),before=[...u],initialTV=tv(u),count=0,g;return {get count(){return count;},get time(){return count*p.nu/n;},get stop(){return count>=80?'■':'';},step(){before=[...u];u=fluxLimitedStep(u,p.nu,p.method);count++;},paint(x,y){if(!g?.contains(x,y))return false;const[q,z]=g.inverse(x,y),i=clamp(Math.floor(q*n),0,n-1);u[i]=clamp(z,-.2,1.2);before=[...u];initialTV=tv(u);count=0;p.values=[...u];return true;},render(){const ink=new Ink();ink.title(L('Полная вариация: посчитайте каждую ступеньку','Total variation: account for every jump'),L('Рисуйте по верхнему графику. Периодический шов учтён в первом столбике.','Draw on the upper plot. The first bar includes the periodic seam.'));
 const ex=extent([...u,...before]);g=graph(ink,{y:105,h:180,ymin:Math.min(-.25,ex[0]),ymax:Math.max(1.25,ex[1]),xlabel:'x',ylabel:'ū'});staircase(ink,g,before,{color:C.dim,width:2});staircase(ink,g,u,{color:C.yellow,width:3});
 const old=before.map((v,i)=>Math.abs(v-before[mod(i-1,n)])),now=u.map((v,i)=>Math.abs(v-u[mod(i-1,n)]));const low=graph(ink,{y:350,h:109,xmin:-.6,xmax:15.6,ymin:0,ymax:Math.max(.2,...old,...now)*1.1,xticks:0,yticks:2,xlabel:'i',ylabel:'|Δū|'});
 old.forEach((v,i)=>{ink.rect(low.X(i-.35),low.Y(v),low.w/16*.28,low.Y(0)-low.Y(v),C.dim);ink.rect(low.X(i+.02),low.Y(now[i]),low.w/16*.28,low.Y(0)-low.Y(now[i]),now[i]>v+1e-12?C.red:C.yellow);});
 legend(ink,[[L('до шага','before'),C.dim],[L('после шага','after'),C.yellow],[L('локальный рост','local increase'),C.red]],496);
 footMath(ink,String.raw`\mathrm{TV}^n = ${T(tv(before))}\quad\to\quad \mathrm{TV}^{n+1} = ${T(tv(u))}\qquad \Delta\mathrm{TV} = ${T(tv(u)-tv(before))}`,L('Локальная ступенька может вырасти; TVD ограничивает сумму всех ступенек.','A local jump may grow; TVD bounds the sum of all jumps.'));
 return response(ink,[[L('Шаг','Step'),count],['TV / TV₀',initialTV?tv(u)/initialTV:1],['ΔTV',tv(u)-tv(before)],['Δ mean',average(u)-average(before)]],u.map((v,i)=>({cell:i,before:before[i],after:v,jump_before:old[i],jump_after:now[i]})));}};}

function muscl(p,L){return {render(){const ink=new Ink(),dm=p.center-p.left,dp=p.right-p.center,s=slope(dm,dp,p.limiter),sc=.5*(dm+dp),vals=[p.left,p.center,p.right],ex=extent([...vals,p.center-sc/2,p.center+sc/2,p.center-s/2,p.center+s/2]);
 ink.title(L('Среднее не обязано совпадать со значением на грани','A cell average is not an interface value'),L('Три заданных средних. Меняется только реконструкция центральной ячейки.','Three prescribed averages. Only the center-cell reconstruction changes.'));
 const g=graph(ink,{y:116,h:252,xmin:-1.5,xmax:1.5,ymin:ex[0],ymax:ex[1],xticks:faces(-1.5,1.5),xlabel:'ξ',ylabel:'ū, p(ξ)'});
 vals.forEach((v,i)=>{const j=i-1;ink.line(g.X(j-.5),g.y,g.X(j-.5),g.y+g.h,C.dim);ink.line(g.X(j-.45),g.Y(v),g.X(j+.45),g.Y(v),C.white,3);g.dot(j,v,4,C.white);});ink.rect(g.X(-.5),g.y,g.X(.5)-g.X(-.5),g.h,null,C.yellow,2);
 ink.line(g.X(-.5),g.Y(p.center-sc/2),g.X(.5),g.Y(p.center+sc/2),C.red,2,true);
 ink.line(g.X(-.5),g.Y(p.center-s/2),g.X(.5),g.Y(p.center+s/2),C.yellow,4);g.dot(-.5,p.center-s/2,6,C.yellow);g.dot(.5,p.center+s/2,6,C.yellow);
 legend(ink,[[L('средние','averages'),C.white],[L('центральный наклон','centered slope'),C.red],[L('ограниченный','limited'),C.yellow]],414);
 formula(ink,73,457,String.raw`\Delta_- = ${T(dm)}\qquad \Delta_+ = ${T(dp)}\qquad \sigma = ${T(s)}`,C.white,22);
 formula(ink,73,492,String.raw`u^-_{i+½} = ${T(p.center+s/2)}\qquad u^+_{i-½} = ${T(p.center-s/2)}`,C.yellow,22);
 footMath(ink,String.raw`\int_{-½}^{+½} p_i(\xi)\,d\xi = \bar u_i = ${T(p.center)}`,L('Не ограничиваем сами средние: ограничиваем наклон внутри ячейки.','We limit the within-cell slope, not the prescribed averages.'));
 return response(ink,[['Δ₋',dm],['Δ₊',dp],['σ',s],[L('Ошибка среднего','Average error'),polynomialAverage([p.center,s],-.5,.5)-p.center]],[-1,0,1].map((j,i)=>({offset:j,average:vals[i],center_slope:s,left_face:p.center-s/2,right_face:p.center+s/2})));}};}

function fluxLimiter(p,L){return {render(){const ink=new Ink(),finite=Math.abs(p.dp)>1e-14,r=finite?p.dm/p.dp:null,s=slope(p.dm,p.dp,p.limiter),phi=finite?s/p.dp:null,F0=.5,corr=.5*(1-p.nu)*s;
 ink.title(L('Один и тот же φ(r) управляет реальной коррекцией потока','The same φ(r) controls the actual flux correction'),L('Слева — достаточная область TVD. Справа — разложение потока на слагаемые.','Left: sufficient TVD region. Right: actual flux contributions.'));
 const g=graph(ink,{x:77,y:123,w:425,h:284,xmin:-1,xmax:4,ymin:-.25,ymax:2.5,xlabel:'r',ylabel:'φ(r)'});
 for(let k=0;k<=80;k++){const x=k/20;ink.line(g.X(x),g.Y(0),g.X(x),g.Y(Math.min(2*x,2)),C.grid,3);}
 g.curve(x=>x<0?0:Math.min(2*x,2),C.green,1.8);g.curve(x=>limiter(x,p.limiter),C.yellow,3);g.dot(1,1,4,C.white);
 if(finite&&r>=-1&&r<=4)g.dot(r,phi,7,C.red);else ink.text(100,443,finite?`r = ${F(r)} ${L('вне окна','outside view')}`:L('r не определён при Δ₊=0','r undefined at Δ₊=0'),17,C.red);
 const vals=[F0,corr,F0+corr],bg=graph(ink,{x:589,y:151,w:299,h:215,xmin:-.6,xmax:2.6,ymin:-.7,ymax:1.4,xticks:0,xlabel:'',ylabel:'F'});bars(ink,bg,vals,C.blue,true);['Fup','ΔF','F'].forEach((s,i)=>ink.text(bg.X(i),401,s,19,C.white,'center'));
 formula(ink,571,449,String.raw`\sigma(\Delta_-,\Delta_+) = ${T(s)}`,C.yellow,21);formula(ink,571,482,String.raw`\Delta F = \frac12(1-\nu)\sigma = ${T(corr)}`,C.white,18);
 footMath(ink,String.raw`\Delta_- = ${T(p.dm)};\quad \Delta_+ = ${T(p.dp)};\quad ${finite?String.raw`r = ${T(r)};\quad \varphi = ${T(phi)}`:String.raw`\text{${L('σ вычисляется без деления на ноль','σ is evaluated without dividing by zero')}}`}`,
 L('Выпуклое смешивание потоков не заменяет проверку условий TVD.','Mixing fluxes does not replace a check of the TVD conditions.'));
 return response(ink,[['r',finite?F(r):'—'],['φ',finite?F(phi):'—'],['ΔF',corr],['F',F0+corr]],linspace(-1,4,101).map(x=>({r:x,phi:limiter(x,p.limiter),tvd_upper:x<0?0:Math.min(2*x,2)})));}};}

function extrema(p,L){let u=initialAverages(p.N,p.profile),time=0,count=0;const initial=[...u],xs=centers(p.N);return {get time(){return time;},get count(){return count;},get stop(){return time>=1-1e-12?'■':'';},step(){if(time>=1-1e-12)return;const dt=Math.min(p.nu/p.N,1-time);u=fluxLimitedStep(u,dt*p.N,p.method);time+=dt;count++;},render(){const ink=new Ink(),exact=initialAverages(p.N,p.profile,time),ex=extent([...u,...exact]);ink.title(L('Сохранить TV — не значит сохранить форму пика','Preserving TV does not preserve the peak shape'),`${names[p.method]}   |   N = ${p.N}   |   t = ${F(time)}`);
 const g=graph(ink,{y:111,h:246,ymin:ex[0],ymax:ex[1],ylabel:'ū'});g.series(xs,exact,C.white,2);g.series(xs,u,C.yellow,2,true);
 u.forEach((v,i)=>{const dm=v-u[mod(i-1,p.N)],dp=u[mod(i+1,p.N)]-v;if(Math.abs(slope(dm,dp,p.method)-dp)>Math.max(1e-8,.2*Math.abs(dp)))ink.line(g.X(xs[i]),380,g.X(xs[i]),394,C.yellow,2);});
 legend(ink,[[L('точные средние','exact averages'),C.white],[names[p.method],C.yellow]],427,72,380);
 formula(ink,72,466,String.raw`\max\bar u = ${T(Math.max(...u))}\qquad \max\bar u_{\text{exact}} = ${T(Math.max(...exact))}`,C.white,22);
 formula(ink,72,500,String.raw`\mathrm{TV} = ${T(tv(u))}\qquad \mathrm{TV}_0 = ${T(tv(initial))}\qquad L_1 = ${T(norm1(diff(u,exact)))}`,C.yellow,20);
 foot(ink,L('Метки под графиком: участки, где ограничитель изменяет LW-коррекцию.','Marks under the graph: where the limiter changes the LW correction.'),L('Экстремум и разрыв — разные причины уменьшать коррекцию; последствия тоже различны.','A smooth extremum and a jump both reduce corrections, but the consequences differ.'));
 return response(ink,[['t',time],['L₁',norm1(diff(u,exact))],['TV / TV₀',tv(u)/tv(initial)],[L('Дефект массы','Mass defect'),average(u)-average(initial)]],u.map((v,i)=>({x:xs[i],numerical:v,exact:exact[i],error:v-exact[i]})));}};}

function ssp(p,L){const n=40,h=1/n,u=initialAverages(n,p.profile),sol=rkStep(u,p.nu*h,h,{method:'minmod'},p.method);let phase=0;return {get count(){return phase;},get time(){return phase>=sol.stages.length-1?p.nu*h:0;},get stop(){return phase>=sol.stages.length-1?'■':'';},step(){phase=Math.min(sol.stages.length-1,phase+1);},render(){const ink=new Ink(),arr=sol.stages,shown=arr[Math.min(phase,arr.length-1)],ex=extent(arr.flat());
 ink.title(L('Один пространственный оператор, два метода времени','One spatial operator, two time methods'),p.method==='ssp2'?'SSP RK2:  u → Euler → Euler → convex combination':'Explicit midpoint:  u → half Euler step → midpoint derivative');
 const g=graph(ink,{y:114,h:220,ymin:ex[0],ymax:ex[1],ylabel:'ū'});g.series(centers(n),u,C.white,2);g.series(centers(n),shown,C.yellow,2.5,true);
 const tvs=arr.map(v=>tv(v));const x0=94,step=220;tvs.forEach((v,i)=>{ink.rect(x0+i*step,386,190,63,null,i===phase?C.yellow:C.dim);ink.math(x0+i*step+95,410,i===0?'u^n':i===arr.length-1?'u^{n+1}':`u^{(${i})}`,17,C.white,'center');ink.text(x0+i*step+95,435,`TV = ${F(v)}`,17,i===phase?C.yellow:C.muted,'center');});
 if(p.method==='ssp2')formula(ink,72,491,String.raw`\mathrm{TV}(u^{n+1}) = ${T(tv(sol.out))}\quad\le\quad \frac12\mathrm{TV}(u^n)+\frac12\mathrm{TV}(u^{(2)}) = ${T((tvs[0]+tvs[2])/2)}`,C.green,20);
 else ink.text(72,491,L('Второй порядок ≠ общая SSP-гарантия','Second order ≠ a general SSP guarantee'),21,C.yellow);
 foot(ink,p.nu<=.5?L('ν ≤ 1/2: достаточное TVD-условие эйлерова шага для этого MUSCL-оператора.','ν ≤ 1/2: sufficient forward-Euler TVD condition for this MUSCL operator.'):L('ν > 1/2: показанная достаточная гарантия больше не применима.','ν > 1/2: the displayed sufficient guarantee no longer applies.'),L('На выбранных данных негарантированный метод тоже может не увеличивать TV.','A method without the general guarantee can still avoid TV growth on these particular data.'));
 const output=response(ink,[[L('Этап','Stage'),`${phase}/${sol.stages.length-1}`],['ν',p.nu],['TVⁿ',tv(u)],['TVⁿ⁺¹',tv(sol.out)]],u.map((v,i)=>({cell:i,input:v,stage1:arr[1][i],stage2:arr[2]?.[i]??sol.out[i],after:sol.out[i]})));output.equation={tex:p.method==='ssp2'?String.raw`\text{SSP RK2: } u^{(1)} = u^n + \tau L(u^n);\qquad u^{(2)} = u^{(1)} + \tau L(u^{(1)});\qquad u^{n+1} = \frac12 u^n + \frac12 u^{(2)}`:String.raw`\text{Midpoint: } u^* = u^n + \frac12\tau L(u^n);\qquad u^{n+1} = u^n + \tau L(u^*)`};return output;}};}

function enoLab(p,L){return {render(){const data=localData(p.profile,p.position,1,p.noise),sel=eno(data.get,0,p.order),coef=polynomialFromAverages(sel.values,sel.offsets),ink=new Ink();
 ink.title(L('ENO: не взвешиваем, а рекурсивно выбираем','ENO: recursively select, rather than blend'),L('Жёлтые отрезки — выбранные средние; зелёная линия — общая правая грань.','Yellow segments are the selected averages; green marks the target interface.'));
 const exactAtJump=p.profile==='jump'&&Math.abs(p.position-.5)<1e-10;const g=localGraph(ink,data,{y:110,h:220,xmin:-3.5,xmax:3.5,selection:sel.offsets});
 g.curve(x=>x>=sel.offsets[0]-.5&&x<=sel.offsets.at(-1)+.5?poly(coef,x):NaN,C.yellow,3,550);g.dot(.5,sel.value,6,C.green);
 ink.text(72,378,L('Сравнение |Δᵏū|','Compare |Δᵏū|'),17,C.white);ink.text(429,378,L('выбор','choice'),17,C.white);ink.text(660,378,L('текущий набор ячеек','current cell set'),17,C.white);
 let left=0;
 sel.decisions.forEach((d,k)=>{const y=407+32*k;ink.text(72,y,`k=${d.degree}:  ${F(Math.abs(d.dl))}   :   ${F(Math.abs(d.dr))}`,18,C.white);ink.text(435,y,d.chooseLeft?L('← влево','← left'):L('вправо →','right →'),18,C.yellow);left=d.chosen;ink.text(656,y,`{${Array.from({length:d.degree+1},(_,j)=>left+j).join(', ')}}`,18,C.yellow);});
 const integralErr=maxabs(sel.offsets.map((j,k)=>polynomialAverage(coef,j-.5,j+.5)-sel.values[k]));
 footMath(ink,String.raw`\text{${L('Грань','Interface')}}:\quad u^-_{i+½} = ${T(sel.value)}\qquad \text{${L('ошибка средних','mean residual')}} = ${T(integralErr)}`,L('Меньшая разность — локальный критерий; «ENO» не означает строгую TVD-гарантию.','The smaller difference is a local criterion; ENO does not mean a strict TVD guarantee.'));
 return response(ink,[[L('Ячейки','Cells'),sel.offsets.join(', ')],['u⁻',sel.value],[L('Эталон на грани','Reference at face'),exactAtJump?L('разрыв','jump'):data.f(.5)],[L('Невязка средних','Average residual'),integralErr]],sel.decisions.map(d=>({degree:d.degree,delta_left:d.dl,delta_right:d.dr,chosen_left:d.chosen,face_value:sel.value})));}};}

function wenoCandidates(p,L){return {render(){const data=localData(p.profile,p.position),vals=[-2,-1,0,1,2].map(data.get),polys=wenoPolynomials(vals),w=weno5(vals,'linear'),ink=new Ink();
 ink.title(L('Три трёхъячеечных шаблона — одна общая грань','Three three-cell stencils share one interface'),L('Отрезки — средние. Кривые — интегрально согласованные параболы.','Segments are averages; curves are quadratics fitted to those averages.'));
 const exactAtJump=p.profile==='jump'&&Math.abs(p.position-.5)<1e-10;const selected=p.candidate>=0?Array.from({length:3},(_,j)=>p.candidate+j-2):[],g=localGraph(ink,data,{y:117,h:241,xmin:-2.5,xmax:2.5,selection:selected});
 polys.forEach((co,k)=>{const col=p.candidate===-1||p.candidate===k?colors[k]:C.dim;g.curve(x=>x>=k-2.5&&x<=k+.5?poly(co,x):NaN,col,p.candidate===k?3.5:2,400);g.dot(.5,w.q[k],5,col);});
 for(let k=0;k<3;k++){const x=80+k*300;ink.line(x,400,x+32,400,colors[k],3);ink.text(x+43,406,`S${k}:  q${k} = ${F(w.q[k])}`,19,colors[k]);ink.text(x,441,`d${k} = ${w.optimal[k]}`,20,C.white);}
 formula(ink,78,490,String.raw`\sum_k d_k q_k = ${T(w.value)}\qquad u(x_{i+½}) = ${exactAtJump?String.raw`\text{${L('разрыв','jump')}}`:T(data.f(.5))}`,C.green,23);
 foot(ink,L('Пятый порядок получается для значения на грани, а не для произвольного x.','Fifth order is obtained at the interface, not at arbitrary x.'),L('После разрыва оптимальные линейные веса уже не знают, какой шаблон следует подавить.','At a jump, optimal linear weights do not know which contaminated stencil to suppress.'));
 return response(ink,[['q₀',w.q[0]],['q₁',w.q[1]],['q₂',w.q[2]],[L('Ошибка на грани','Interface error'),exactAtJump?'—':w.value-data.f(.5)]],w.q.map((q,k)=>({stencil:k,interface_value:q,optimal_weight:w.optimal[k],weighted_term:w.optimal[k]*q,reference:exactAtJump?'undefined_at_jump':data.f(.5)})));}};}

function wenoWeights(p,L){return {render(){const data=localData(p.profile,p.position,p.amplitude),v=[-2,-1,0,1,2].map(data.get),js=weno5(v,'js',10**p.logeps),z=weno5(v,'z',10**p.logeps),ink=new Ink();
 ink.title(L('Индикатор гладкости меняет нелинейные веса','Smoothness indicators change the nonlinear weights'),L('JS и Z видят одни и те же пять средних. Показатель обеих формул: 2.','JS and Z see the same five averages. Both formulas use exponent 2.'));
 const g=localGraph(ink,data,{y:131,h:228,w:419,xmin:-2.5,xmax:2.5});
 const co=wenoPolynomials(v);co.forEach((c,k)=>g.curve(x=>x>=k-2.5&&x<=k+.5?poly(c,x):NaN,colors[k],1+3*js.weights[k],300));
 const x0=553;['βₖ','ω JS','ω Z'].forEach((s,i)=>ink.text(x0+i*133,110,s,20,C.white));
 js.beta.forEach((b,k)=>{const y=158+k*81;ink.text(x0-35,y,`S${k}`,18,colors[k]);ink.text(x0,y,F(b),18,colors[k]);ink.text(x0+133,y,F(js.weights[k]),18,C.yellow);ink.text(x0+266,y,F(z.weights[k]),18,C.green);ink.rect(x0+132,y+9,105*js.weights[k],7,C.yellow);ink.rect(x0+265,y+9,105*z.weights[k],7,C.green);ink.text(x0,y+42,`αJS=${F(js.alpha[k])};  αZ=${F(z.alpha[k])}`,13,C.muted);});
 formula(ink,73,410,String.raw`\varepsilon = ${T(10**p.logeps)}\qquad \tau_5 = |\beta_0-\beta_2| = ${T(js.tau)}`,C.white,20);
 formula(ink,73,449,String.raw`u^-_{\mathrm{JS}} = ${T(js.value)}\qquad u^-_{\mathrm{Z}} = ${T(z.value)}`,C.yellow,23);
 formula(ink,73,486,String.raw`d = (0.1,\,0.6,\,0.3);\qquad \sum\omega^{\mathrm{JS}} = ${T(sum(js.weights))};\qquad \sum\omega^{\mathrm{Z}} = ${T(sum(z.weights))}`,C.muted,18);
 foot(ink,L('Уменьшите амплитуду: β ∼ A², но фиксированное ε не масштабируется.','Reduce the amplitude: β ∼ A², but fixed ε does not scale with it.'),L('Положительные ω не гарантируют монотонность: каждый qₖ содержит отрицательные коэффициенты.','Positive ω do not guarantee monotonicity: each qₖ contains negative coefficients.'));
 return response(ink,[['τ₅',js.tau],['ε',10**p.logeps],['u⁻ JS',js.value],['u⁻ Z',z.value]],js.beta.map((b,k)=>({stencil:k,beta:b,candidate:js.q[k],alpha_JS:js.alpha[k],alpha_Z:z.alpha[k],weight_JS:js.weights[k],weight_Z:z.weights[k],optimal:js.optimal[k]})));}};}

function critical(p,L){let g,probe=4;return {click(x,y){if(!g?.contains(x,y))return false;const v=g.inverse(x,y)[0];probe=clamp(Math.round(v)-1,0,7);return true;},render(){const rows=reconstructionStudy(p.profile,10**p.logeps,p.scaling,p.offset),ink=new Ink(),xvals=rows.map(r=>Math.log2(1/r.h));
 ink.title(L('Пространственная реконструкция: измеренный порядок','Spatial reconstruction: measured order'),L('Временного интегрирования нет. Нажмите на левый график для выбора пары сеток.','There is no time integration. Click the left plot to select a pair of grids.'));
 g=graph(ink,{x:84,y:120,w:418,h:282,xmin:1,xmax:9,ymin:-16,ymax:0,xticks:4,yticks:4,xlabel:'log₂(1/h)',ylabel:'log₁₀ E'});
 [['linear_error',C.white],['js_error',C.yellow],['z_error',C.green]].forEach(([key,col])=>g.series(xvals,rows.map(r=>Math.max(-16,Math.log10(Math.max(r[key],1e-16)))),col,2.3,true));
 ink.line(g.X(xvals[probe]),g.y,g.X(xvals[probe]),g.y+g.h,C.blue,2,true);
 const q=graph(ink,{x:608,y:120,w:280,h:282,xmin:1,xmax:9,ymin:-16,ymax:0,xticks:4,yticks:4,xlabel:'log₂(1/h)',ylabel:'log₁₀ max|ω−d|'});
 [['js_weight_error',C.yellow],['z_weight_error',C.green]].forEach(([key,col])=>q.series(xvals,rows.map(r=>Math.max(-16,Math.log10(Math.max(r[key],1e-16)))),col,2.3,true));
 legend(ink,[[L('оптимальные d','optimal d'),C.white],['WENO-JS',C.yellow],['WENO-Z',C.green]],454);
 const rate=key=>{const r=convergenceRate(rows,key,probe);return r===null?'—':T(r);};
 formula(ink,72,493,String.raw`h = ${T(rows[probe].h)} \to h/2:\quad p_{\text{linear}} = ${rate('linear_error')};\quad p_{\mathrm{JS}} = ${rate('js_error')};\quad p_{\mathrm{Z}} = ${rate('z_error')}`,C.white,19);
 foot(ink,L('Изменяйте положение критической точки и ε, а не только число сеток.','Vary the critical-point location and ε, not just the grid count.'),L('Ошибки ниже 10⁻¹⁶ показаны на нижней линии; порядок при E ≤ 10⁻¹⁴ не выводится.','Errors below 10⁻¹⁶ are placed at the floor; rates involving E ≤ 10⁻¹⁴ are suppressed.'));
 return response(ink,[['h',rows[probe].h],['p linear',rate('linear_error')],['p JS',rate('js_error')],['p Z',rate('z_error')]],rows.map((r,i)=>({...r,p_linear:i<8?convergenceRate(rows,'linear_error',i)??'':'',p_JS:i<8?convergenceRate(rows,'js_error',i)??'':'',p_Z:i<8?convergenceRate(rows,'z_error',i)??'':''})));}};}

function faceReport(u,i,method,eps,L){const get=j=>u[mod(j,u.length)];if(['wenojs','wenoz','linear5'].includes(method)){const r=weno5([-2,-1,0,1,2].map(j=>get(i+j)),method==='wenoz'?'z':method==='linear5'?'linear':'js',eps);return {text:`ω = (${r.weights.map(F).join(', ')})     u⁻ = ${F(r.value)}`,weights:r.weights};}
 if(method==='eno3'){const r=eno(get,i,3);return {text:`ENO: {${r.offsets.map(j=>`i${j>=0?'+':''}${j}`).join(', ')}}    u⁻ = ${F(r.value)}`};}
 const s=slope(get(i)-get(i-1),get(i+1)-get(i),method);return {text:`σ = ${F(s)}     u⁻ = ${F(get(i)+s/2)}`};}

function transport(p,L){let a=initialAverages(p.N,p.profile),b=[...a],time=0,count=0,stop='',selected=Math.floor(p.N*.35),g;const initial=[...a],xs=centers(p.N),eps=10**p.logeps;return {get time(){return time;},get count(){return count;},get stop(){return stop;},step(){if(stop)return;const dt=Math.min(p.nu/p.N,1-time);a=rkStep(a,dt,1/p.N,{method:p.methodA,epsilon:eps}).out;b=rkStep(b,dt,1/p.N,{method:p.methodB,epsilon:eps}).out;time+=dt;count++;
 if(!a.every(Number.isFinite)||!b.every(Number.isFinite)||maxabs(a)>1e4||maxabs(b)>1e4)stop=L('Рост решения: опыт остановлен, данные не обрезались.','Solution growth: stopped without clipping the data.');else if(time>=1-1e-12)stop='■';},click(x,y){if(!g?.contains(x,y))return false;selected=mod(Math.round(g.inverse(x,y)[0]*p.N)-1,p.N);return true;},render(){const ink=new Ink(),exact=initialAverages(p.N,p.profile,time),ex=extent([...a,...b,...exact]);ink.title(L('Один перенос; меняется только реконструкция','Same transport problem; change the reconstruction'),`A: ${names[p.methodA]}    B: ${names[p.methodB]}    t = ${F(time)};  N = ${p.N};  SSP RK3`);
 g=graph(ink,{y:111,h:237,ymin:ex[0],ymax:ex[1],ylabel:'ū'});g.series(xs,exact,C.white,1.6);g.series(xs,b,C.blue,2);g.series(xs,a,C.yellow,2.4);ink.line(g.X((selected+1)/p.N),g.y,g.X((selected+1)/p.N),g.y+g.h,C.green,2,true);
 legend(ink,[[L('точные средние','exact averages'),C.white],[`A: ${names[p.methodA]}`,C.yellow],[`B: ${names[p.methodB]}`,C.blue]],398);
 const fr=faceReport(a,selected,p.methodA,eps,L);ink.text(72,443,`${L('Грань A','A interface')} ${selected+1}: ${fr.text}`,20,C.yellow);
 if(fr.weights)fr.weights.forEach((w,k)=>{ink.text(85+k*295,482,`S${k}`,17,colors[k]);ink.rect(127+k*295,467,210*w,15,colors[k]);});
 else formula(ink,72,482,String.raw`\mathrm{TV}(A) = ${T(tv(a))};\quad \min(A) = ${T(Math.min(...a))};\quad \max(A) = ${T(Math.max(...a))}`,C.white,19);
 footMath(ink,String.raw`L_1(A) = ${T(norm1(diff(a,exact)))}\qquad L_1(B) = ${T(norm1(diff(b,exact)))}`,L('Щёлкните по графику: локальные веса вычисляются заново из текущего решения.','Click the plot: the local weights are recomputed from the current solution.'));
 return response(ink,[['t',time],['TV A',tv(a)],['TV B',tv(b)],['Δ mass A',average(a)-average(initial)],['Δ mass B',average(b)-average(initial)]],a.map((v,i)=>({x:xs[i],A:v,B:b[i],exact:exact[i],error_A:v-exact[i],error_B:b[i]-exact[i]})));}};}

function burgers(p,L){const h=2/p.N,xs=Array.from({length:p.N},(_,i)=>-1+(i+.5)*h),initial=xs.map(x=>burgersAverage(x-h/2,x+h/2,0,p.uL,p.uR)),final=.32/Math.max(1,Math.abs(p.uL),Math.abs(p.uR));let u=[...initial],time=0,count=0,budget=0,stop='',selected=Math.floor(p.N/2)-1,g;
 const options={method:p.method,epsilon:1e-6,equation:'burgers',flux:p.flux,boundary:'reservoir',left:p.uL,right:p.uR};return {get count(){return count;},get time(){return time;},get stop(){return stop;},step(){if(stop)return;const dt=Math.min(.32*h/Math.max(.1,maxabs(u),Math.abs(p.uL),Math.abs(p.uR)),final-time),r=rkStep(u,dt,h,options);u=r.out;budget+=r.boundaryChange;time+=dt;count++;if(!u.every(Number.isFinite)||maxabs(u)>1e4)stop=L('Рост решения: остановлено без обрезки.','Solution growth: stopped without clipping.');else if(time>=final-1e-12)stop='■';},click(x,y){if(!g?.contains(x,y))return false;selected=clamp(Math.round((g.inverse(x,y)[0]+1)/h)-1,0,p.N-2);return true;},render(){const ink=new Ink(),exact=xs.map(x=>burgersAverage(x-h/2,x+h/2,time,p.uL,p.uR)),ex=extent([...exact,...u]);ink.title(L('Состояния на грани и численный поток — разные решения','Interface states and the numerical flux are separate choices'),`${names[p.method]}  +  ${p.flux==='godunov'?'Godunov':'Rusanov'};   uL = ${F(p.uL)}, uR = ${F(p.uR)};   t = ${F(time)}`);
 g=graph(ink,{y:111,h:237,xmin:-1,xmax:1,ymin:ex[0],ymax:ex[1],ylabel:'ū'});g.series(xs,exact,C.white,2);g.series(xs,u,C.yellow,2.5,true);ink.line(g.X(-1+(selected+1)*h),g.y,g.X(-1+(selected+1)*h),g.y+g.h,C.green,2,true);
 legend(ink,[[L('точные средние','exact averages'),C.white],[L('численные средние','computed averages'),C.yellow]],396,72,380);
 const get=i=>i<0?p.uL:i>=p.N?p.uR:u[i],[left,right]=faceStates(get,selected,p.method,1e-6),f=numericalFlux(left,right,'burgers',p.flux);
 formula(ink,74,440,String.raw`u^- = ${T(left)}\qquad u^+ = ${T(right)}\qquad\to\qquad F(u^-,u^+) = ${T(f)}`,C.green,22);
 const mass=h*sum(u),initialMass=h*sum(initial),balance=mass-initialMass-budget;
 formula(ink,74,481,String.raw`M-M_0 = ${T(mass-initialMass)}\qquad \int(F_L-F_R)\,dt = ${T(budget)}`,C.white,19);
 footMath(ink,String.raw`L_1 = ${T(2*norm1(diff(u,exact)))}\qquad \text{${L('дефект баланса массы','mass-balance defect')}} = ${T(balance)}`,L('Точное решение — энтропийное; выбросы реконструкции не маскируются.','The exact reference is the entropy solution; reconstruction overshoots are not masked.'));
 return response(ink,[['t',time],['u⁻',left],['u⁺',right],['F',f],[L('Дефект баланса','Balance defect'),balance]],u.map((v,i)=>({x:xs[i],numerical:v,exact:exact[i],error:v-exact[i]})));}};}

function createLab(id,params,lang='ru'){
 const L=(ru,en)=>lang==='en'?en:ru;
 const factories={'linear-builder':linearBuilder,'two-stage':twoStage,'order-test':orderTest,'variation':variation,'muscl':muscl,'flux-limiter':fluxLimiter,'extrema':extrema,'ssp':ssp,'eno':enoLab,'weno-candidates':wenoCandidates,'weno-weights':wenoWeights,'critical':critical,'transport':transport,'burgers':burgers};
 if(!factories[id])throw new Error('Unknown experiment: '+id);
 return factories[id](params,L);
}

return {createLab};
})();
export default moduleValue;
