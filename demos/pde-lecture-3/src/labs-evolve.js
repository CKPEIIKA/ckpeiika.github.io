import * as module0 from '../../pde-gallery/board.js';
import module1 from './kernels.js';
const __modules = { "board.js": module0, "kernels.js": module1 };
const moduleValue = (() => {
const K = __modules['kernels.js'];
const {Ink,C,graph,legend,fmt} = __modules['board.js'];
const arr=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const text=lang=>(ru,en)=>lang==='en'?en:ru;
const name=(s,lang)=>({upwind:lang==='en'?'Upwind':'Против потока',lf:lang==='en'?'Lax–Friedrichs':'Лакс — Фридрихс',lw:lang==='en'?'Lax–Wendroff':'Лакс — Вендрофф',ftcs:'FTCS',maccormack:lang==='en'?'MacCormack':'Мак-Кормак'})[s];
function advection(p,lang){
  const L=text(lang),h=1/p.n,dt=p.C*h,x=arr(p.n,i=>i*h),initial=x.map(x=>K.profile(p.profile,x));
  let a=[...initial],b=[...initial],t=0,steps=0,history=[],stop='';
  return {get stop(){return stop;},get time(){return t;},get count(){return steps;},
    step(){if(stop)return false;a=K.advectionStep(a,p.C,p.A);b=K.advectionStep(b,p.C,p.B);steps++;t=steps*dt;
      const exact=x.map(x=>K.profile(p.profile,x,2,t));history.push([t,K.l1Error(a,exact),K.l1Error(b,exact)]);if(history.length>600)history=history.filter((_,i)=>i%2===0);
      if(!a.every(Number.isFinite)||!b.every(Number.isFinite)||Math.max(K.normInf(a),K.normInf(b))>20)stop=L('Остановка: |u| > 20. Дальнейший расчёт продолжать нельзя.','Stopped: |u| > 20. The calculation cannot continue.');
      else if(t>=2)stop=L('Два периода завершены. Измените параметры или сбросьте опыт.','Two periods completed. Change a parameter or reset the experiment.');return true;},
    render(){const exact=x.map(x=>K.profile(p.profile,x,2,t)),ink=new Ink().title(L('Сравнение схем при одном физическом времени','Comparing schemes at the same physical time'),`t = ${fmt(t)}    Δt = ${fmt(dt)}    n = ${steps}`);
      const lo=Math.min(-.25,...a,...b),hi=Math.max(1.2,...a,...b),g=graph(ink,{y:112,h:256,ymin:Math.max(-30,lo-.03),ymax:Math.min(30,hi+.03),ylabel:'u'});
      g.curve(x=>K.profile(p.profile,x,2,t),C.white,2.2,850);g.series(x,a,C.blue,1.8,p.n<=80);g.series(x,b,C.yellow,1.8,p.n<=80);
      legend(ink,[[L('Точное решение','Exact solution'),C.white],['A: '+name(p.A,lang),C.blue],['B: '+name(p.B,lang),C.yellow]],411,72,283);
      if(history.length>1){const hg=graph(ink,{x:76,y:467,w:610,h:80,xmin:0,xmax:Math.max(.2,t),ymin:-8,ymax:2,xticks:4,yticks:2,ylabel:'log₁₀ L₁',xlabel:'t'});hg.series(history.map(r=>r[0]),history.map(r=>Math.log10(Math.max(1e-8,r[1]))),C.blue,1.5);hg.series(history.map(r=>r[0]),history.map(r=>Math.log10(Math.max(1e-8,r[2]))),C.yellow,1.5);}
      else ink.text(76,499,L('Нажмите «Шаг», чтобы увидеть первый разностный слой.','Press “Step” to see the first time level.'),18,C.muted);
      ink.text(729,483,'Δmean(A) = '+fmt(K.sum(a)/p.n-K.sum(initial)/p.n),14,C.blue);ink.text(729,516,'Δmean(B) = '+fmt(K.sum(b)/p.n-K.sum(initial)/p.n),14,C.yellow);
      if(p.A==='maccormack'&&p.B==='lw'||p.B==='maccormack'&&p.A==='lw')ink.text(76,592,L('Для линейного переноса Мак-Кормак и Лакс — Вендрофф совпадают.','For linear advection, MacCormack and Lax–Wendroff are equivalent.'),14,C.green);
      return {ink,stats:[['L₁(A)',fmt(K.l1Error(a,exact))],['L₁(B)',fmt(K.l1Error(b,exact))],['min / max A',fmt(Math.min(...a))+' / '+fmt(Math.max(...a))],['min / max B',fmt(Math.min(...b))+' / '+fmt(Math.max(...b))]],rows:x.map((xx,i)=>({x:xx,exact:exact[i],A:a[i],B:b[i]}))};}
  };
}
function heat(p,lang){
  const L=text(lang),n=p.n,h=1/n,theta=Number(p.theta),dt=p.r*h*h,k=n-2;
  const modes=p.mode==='high'?[[k,1]]:p.mode==='mix'?[[1,1],[k,.15]]:[[1,1]],x=arr(n+1,i=>i*h),analytical=(x,t)=>K.sum(modes.map(([m,A])=>A*Math.sin(m*Math.PI*x)*Math.exp(-((m*Math.PI)**2)*t)));
  let u=x.map(x=>analytical(x,0));u[0]=u[n]=0;let steps=0,t=0,stop='',history=[[0,1]];
  return {get stop(){return stop;},get time(){return t;},get count(){return steps;},step(){if(stop)return false;u=K.heatStep(u,p.r,theta);steps++;t=steps*dt;history.push([steps,K.sum(u.map((v,i)=>v*Math.sin(k*Math.PI*x[i])))*2/n]);if(history.length>120)history.shift();
    if(!u.every(Number.isFinite)||K.normInf(u)>20)stop=L('Остановка: |u| > 20. Дальнейший расчёт продолжать нельзя.','Stopped: |u| > 20. The calculation cannot continue.');else if(t>.5)stop=L('Расчёт завершён при t ≥ 0.5.','The calculation ended at t ≥ 0.5.');return true;},
    render(){const exact=x.map(x=>analytical(x,t)),ink=new Ink().title(L('Точное и численное затухание','Exact and numerical decay'),`θ = ${theta}    r = ${fmt(p.r)}    t = ${fmt(t)}    n = ${steps}`),lim=Math.max(1.2,Math.min(25,K.normInf(u)*1.1));
      const g=graph(ink,{y:112,h:263,ymin:-lim,ymax:lim,ylabel:'u'});g.curve(x=>analytical(x,t),C.white,2,700);g.series(x,u,C.yellow,1.8,true);
      legend(ink,[[L('Точное решение','Exact solution'),C.white],[L('Разностное решение','Difference solution'),C.yellow]],419);
      const G=K.heatAmplification(p.r,theta,k*Math.PI/n),exactDecay=Math.exp(-((k*Math.PI)**2)*dt);
      ink.text(76,473,L('Высокая мода k = ','High mode k = ')+k,18,C.muted);ink.text(76,511,'G = '+fmt(G)+'    |G| '+(Math.abs(G)>1?'>':'≤')+' 1',22,Math.abs(G)>1?C.red:G<0?C.yellow:C.green);
      ink.text(540,473,L('Точное затухание за шаг','Exact decay per step'),18,C.muted);ink.text(540,511,'exp(−k²π²Δt) = '+fmt(exactDecay),22,C.white);
      ink.text(76,566,Math.abs(G)>1?L('Высокочастотное возмущение растёт.','The high-frequency perturbation grows.'):G<0?L('G < 0: мода меняет знак, хотя её модуль не растёт.','G < 0: the mode changes sign even though its magnitude does not grow.'):L('Неявный шаг не отменяет погрешность во времени.','An implicit step still has a time-discretization error.'),17,Math.abs(G)>1?C.red:C.muted);
      return {ink,stats:[[L('СКО','RMS error'),fmt(K.l2Error(u,exact))],['min / max u',fmt(Math.min(...u))+' / '+fmt(Math.max(...u))],['Δt',fmt(dt)],[L('Энергия hΣu²','Energy hΣu²'),fmt(h*K.sum(u.map(v=>v*v)))]],rows:x.map((xx,i)=>({x:xx,exact:exact[i],numerical:u[i]}))};}
  };
}
function shock(p,lang){
  const L=text(lang),h=2/p.n,x=arr(p.n,i=>(i+.5)*h),x0=.6,dt=.4*h/p.left,s=(p.left+p.right)/2,initial=x.map(x=>x<x0?p.left:p.right);
  let a=[...initial],b=[...initial],steps=0,t=0,stop='';
  return {get stop(){return stop;},get time(){return t;},get count(){return steps;},step(){if(stop)return false;a=K.burgersStep(a,dt,h,p.left,p.right,true);b=K.burgersStep(b,dt,h,p.left,p.right,false);steps++;t=steps*dt;if(t>=Math.min(1,(1.6-x0)/s))stop=L('Сравнение завершено до взаимодействия скачка с выходом.','Comparison completed before the shock interacts with the outlet.');return true;},
    render(){const exactFront=x0+s*t,xa=K.shockPosition(a,p.left,p.right),xb=K.shockPosition(b,p.left,p.right),ink=new Ink().title(L('Скорость разрыва из закона сохранения','Shock speed from conservation'),`t = ${fmt(t)}    s = (uL+uR)/2 = ${fmt(s)}    C = 0.4`);
      const g=graph(ink,{y:112,h:268,xmin:0,xmax:2,ymin:0,ymax:Math.max(1.2,p.left*1.18),ylabel:'u'});
      g.series([0,exactFront,exactFront,2],[p.left,p.left,p.right,p.right],C.white,2.2);g.series(x,a,C.blue,2,p.n<=80);g.series(x,b,C.yellow,2,p.n<=80);
      for(const [front,col]of [[exactFront,C.white],[xa,C.blue],[xb,C.yellow]])ink.line(g.X(front),g.y,g.X(front),g.y+g.h+5,col,1.5,true);
      legend(ink,[[L('Точное','Exact'),C.white],[L('Консервативное','Conservative'),C.blue],[L('Неконсервативное','Nonconservative'),C.yellow]],424,72,288);
      ink.text(76,477,L('Положение по массе:','Mass-equivalent front position:'),18,C.muted);ink.text(76,512,`xₛ = (hΣuᵢ − L uR)/(uL − uR)`,22,C.white);
      ink.text(76,563,L('Сгущение сетки не исправляет нарушение закона сохранения на разрыве.','Grid refinement does not repair a broken conservation law at a shock.'),17,C.muted);
      return {ink,stats:[[L('Точное положение','Exact front'),fmt(exactFront)],[L('Консервативное xₛ','Conservative xₛ'),fmt(xa)],[L('Неконсервативное xₛ','Nonconservative xₛ'),fmt(xb)],[L('Ошибка положения (неконс.)','Position error (noncons.)'),fmt(xb-exactFront)]],rows:x.map((xx,i)=>({x:xx,exact:xx<exactFront?p.left:p.right,conservative:a[i],nonconservative:b[i]}))};}
  };
}
function createEvolving(id,p,lang){return ({advection,heat,shock}[id])?.(p,lang)??null;}

return { createEvolving };
})();
export default moduleValue;
