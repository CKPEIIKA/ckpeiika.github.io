import * as module0 from '../../pde-gallery/board.js';
import module1 from './kernels.js';
const __modules = { "board.js": module0, "kernels.js": module1 };
const moduleValue = (() => {
const K = __modules['kernels.js'];
const {Ink,C,graph,legend,fmt} = __modules['board.js'];
const range=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const frac=x=>{for(let d=1;d<=360;d++)if(Math.abs(x*d-Math.round(x*d))<1e-8)return d===1?String(Math.round(x)):Math.round(x*d)+'/'+d;return fmt(x);};
const lbl=(lang)=>(ru,en)=>lang==='en'?en:ru;
const out=(ink,stats=[])=>({ink,stats});
function card(ink,x,y,w,title,value,color=C.yellow){ink.rect(x,y,w,74,'#15251c',C.grid);ink.text(x+16,y+23,title,13,C.muted);ink.text(x+16,y+54,value,22,color);}
function gridLab(p,lang){const L=lbl(lang);return {render(){
  const ink=new Ink().title(L('Дискретные данные и среднее по ячейке','Discrete data and the cell average'),L('Нажмите на график, чтобы выделить ближайший интервал.','Click the plot to select the nearest interval.'));
  const g=graph(ink,{y:113,h:294,ymin:-1.25,ymax:1.25,ylabel:'u'}),xs=K.sampleGrid(p.n,p.stretch),fn=x=>Math.sin(K.TAU*p.k*x+.35);
  g.curve(fn,C.white,2,900);
  let selected=p.selected??Math.floor(p.n/2);selected=K.clamp(selected,0,p.n-1);
  xs.forEach((x,i)=>{ink.line(g.X(x),g.Y(-1.22),g.X(x),g.Y(1.22),i===selected?C.dim:C.grid,1);if(p.view==='nodes')g.dot(x,fn(x),4.5,C.yellow);});
  let averages=xs.slice(0,-1).map((x,i)=>(Math.cos(K.TAU*p.k*x+.35)-Math.cos(K.TAU*p.k*xs[i+1]+.35))/(K.TAU*p.k*(xs[i+1]-x)));
  if(p.view==='averages')averages.forEach((v,i)=>{const a=g.X(xs[i]),b=g.X(xs[i+1]),zero=g.Y(0),q=g.Y(v);ink.rect(a,Math.min(zero,q),b-a,Math.abs(zero-q),i===selected?'#76673c':'#334d39',C.green);ink.line(a,q,b,q,C.yellow,2);});
  if(p.view==='nodes'&&p.stretch===0&&p.k>=p.n/2){const ka=((p.k+p.n/2)%p.n)-p.n/2;g.curve(x=>Math.sin(K.TAU*ka*x+.35),C.blue,2,400,true);ink.text(90,145,L(`Такие же отсчёты: k = ${ka}`,`Identical samples: k = ${ka}`),16,C.blue);}
  const hs=xs.slice(0,-1).map((x,i)=>xs[i+1]-x);
  ink.arrow(g.X(xs[selected]),445,g.X(xs[selected+1]),445,C.yellow);ink.text((g.X(xs[selected])+g.X(xs[selected+1]))/2,476,'hᵢ = '+fmt(hs[selected]),15,C.yellow,'center');
  legend(ink,[[L('Исходная функция','Original function'),C.white],[p.view==='nodes'?L('Узловые значения','Nodal values'):L('Средние по ячейкам','Cell averages'),C.yellow]],524);
  ink.text(72,566,L('Линия между отсчётами не восстанавливается однозначно.','Samples do not uniquely determine the curve between them.'),17,C.muted);
  this.g=g;this.xs=xs;
  return out(ink,[[L('Интервалов','Intervals'),p.n],[L('Минимальный h','Minimum h'),fmt(Math.min(...hs))],[L('Максимальный h','Maximum h'),fmt(Math.max(...hs))],[L('Среднее выбранной ячейки','Selected cell average'),fmt(averages[selected])]]);
},click(x,y){if(!this.g?.contains(x,y))return false;const v=this.g.inverse(x,y)[0];p.selected=v>=1?this.xs.length-2:Math.max(0,this.xs.findIndex(a=>a>v)-1);return true;}};}
function differences(p,lang){const L=lbl(lang);return {render(){
  const f=K.FUNCTIONS[p.fn],st=K.STENCILS[p.method],weights=K.fdWeights(st),approx=K.derivative(f.f,p.x,p.h,st),exact=f.d(p.x),err=Math.abs(approx-exact),half=Math.abs(K.derivative(f.f,p.x,p.h/2,st)-exact);
  const xmin=p.x-2.3*p.h,xmax=p.x+2.3*p.h,ys=range(201,i=>f.f(xmin+(xmax-xmin)*i/200)),mi=Math.min(...ys),ma=Math.max(...ys),pad=Math.max(.15,(ma-mi)*.17);
  const terms=[];st.forEach((s,i)=>{const w=weights[i];if(Math.abs(w)<1e-12)return;const shift=s===0?'x':`x ${s>0?'+':'−'} ${Math.abs(s)===1?'':Math.abs(s)}h`;const coefficient=Math.abs(w)===1?'':`${frac(Math.abs(w))} `;const sign=terms.length===0?(w<0?'−':''):(w<0?' − ':' + ');terms.push(`${sign}${coefficient}f(${shift})`);});
  const formula=`Dₕf(x) = [${terms.join('')}] / h`;
  const ink=new Ink().title(L('Разностная производная','Finite-difference derivative'),formula);
  const g=graph(ink,{xmin,xmax,ymin:mi-pad,ymax:ma+pad,y:111,h:284,ylabel:'f'});
  g.curve(f.f,C.white,2.2);g.curve(x=>f.f(p.x)+exact*(x-p.x),C.blue,2,100,true);g.curve(x=>f.f(p.x)+approx*(x-p.x),C.yellow,2.5,100);
  st.forEach((s,i)=>{const x=p.x+s*p.h;g.dot(x,f.f(x),5,C.yellow);ink.line(g.X(x),g.Y(f.f(x)),g.X(x),g.y+g.h,C.dim,1,true);ink.text(g.X(x),438,'s = '+s,13,C.muted,'center');ink.text(g.X(x),463,frac(weights[i]),20,C.yellow,'center');});
  legend(ink,[[L('Функция','Function'),C.white],[L('Точная касательная','Exact tangent'),C.blue],[L('Разностный наклон','Difference slope'),C.yellow]],516,72,288);
  ink.text(72,565,L(`При h/2 ошибка равна ${fmt(half)}.`,`At h/2 the error is ${fmt(half)}.`),17,C.muted);
  return out(ink,[["f′(x)",fmt(exact)],["Dₕf(x)",fmt(approx)],[L('Абсолютная ошибка','Absolute error'),fmt(err)],[L('E(h) / E(h/2)','E(h) / E(h/2)'),half>1e-15?fmt(err/half):'—']]);
}};}
function stencil(p,lang){const L=lbl(lang);let nodes=[...(p.nodes??[-1,0,1])];return {render(){
  const ink=new Ink().title(L('Выберите узлы: коэффициенты пересчитаются','Select nodes: the weights will be recalculated'),L('Щёлкните по окружности. Жёлтые узлы включены.','Click a circle. Yellow nodes are included.'));
  ink.line(145,120,855,120,C.muted,2);this.buttons=[];
  for(let s=-3;s<=3;s++){const x=200+s*100+300;this.buttons.push({x,y:120,s});const active=nodes.includes(s);ink.dot(x,120,19,active?C.yellow:C.dim,active?'#655931':C.bg);ink.text(x,126,String(s),17,active?C.white:C.muted,'center');}
  if(nodes.length<=Number(p.m)){ink.text(100,232,L(`Нужно не менее ${Number(p.m)+1} узлов. Сейчас: ${nodes.length}.`,`At least ${Number(p.m)+1} points are required. Selected: ${nodes.length}.`),22,C.red);return out(ink,[[L('Состояние','State'),L('Недостаточно данных','Insufficient data')]]);}
  const ws=K.fdWeights(nodes,Number(p.m)),mom=K.moments(nodes,ws,9),order=K.formalOrder(nodes,ws,Number(p.m));
  nodes.forEach((s,i)=>ink.text(500+s*100,170,frac(ws[i]),18,C.yellow,'center'));
  ink.text(76,205,L('Коэффициент при hᵏ⁻ᵐ f⁽ᵏ⁾','Coefficient of hᵏ⁻ᵐ f⁽ᵏ⁾'),20,C.muted);
  const base=220,cellw=91;
  mom.forEach((m,k)=>{const x=76+k*cellw,col=k===Number(p.m)?C.yellow:Math.abs(m)<1e-9?C.green:C.red;
    ink.rect(x,base,78,80,'#16251d',C.grid);ink.text(x+39,base+21,'k = '+k,13,C.muted,'center');ink.text(x+39,base+48,Math.abs(m)<1e-10?'0':frac(m),16,col,'center');ink.text(x+39,base+68,k===Number(p.m)?'= 1':Math.abs(m)<1e-9?'✓':'≠ 0',14,col,'center');});
  ink.text(76,330,L(`Момент k = m равен 1. Следующие моменты до k = m + p − 1 равны 0.`,`Moment k = m equals 1. The following moments through k = m + p − 1 equal 0.`),18,C.white);
  ink.text(76,361,L(`При k = m + p появляется первый остаток. Поэтому ошибка имеет порядок hᵖ, p = ${order}.`,`The first remainder appears at k = m + p. The error therefore has order hᵖ, p = ${order}.`),18,C.yellow);
  const testDegree=Math.max(1,Math.min(8,Number(p.degree??(Number(p.m)+order)))),testH=.5,testX=.35,testPower=testDegree-Number(p.m),testFactorial=Array.from({length:testDegree},(_,i)=>i+1).reduce((a,b)=>a*b,1),testFactorialPower=Array.from({length:Math.max(0,testPower)},(_,i)=>i+1).reduce((a,b)=>a*b,1),testExact=testPower>=0?Math.pow(testX,testPower)/testFactorialPower:0,testValue=testPower>=0?ws.reduce((sum,w,i)=>sum+w*Math.pow(testX+testH*nodes[i],testDegree)/testFactorial,0)/Math.pow(testH,Number(p.m)):0,plotX=76,plotY=380,plotW=215,plotH=100;
  ink.rect(plotX,plotY,plotW,plotH,'#15251c',C.grid);ink.rect(305,380,520,128,'#15251c',C.grid);
  ink.text(320,403,L('Проверка точности на полиноме','Accuracy test with a polynomial'),18,C.white);
  ink.text(320,425,L(`Pₙ(x) = xⁿ/n!,  n = ${testDegree},  h = 1/2,  x = ${testX}`,`Pₙ(x) = xⁿ/n!,  n = ${testDegree},  h = 1/2,  x = ${testX}`),15,C.muted);
  ink.text(320,449,L(`точная производная: ${fmt(testExact)}`,`exact derivative: ${fmt(testExact)}`),14,C.blue);
  ink.text(320,474,L(`разностный результат: ${fmt(testValue)}`,`stencil result: ${fmt(testValue)}`),14,C.yellow);
  ink.text(320,499,L(`модуль ошибки: ${fmt(Math.abs(testValue-testExact))}`,`absolute error: ${fmt(Math.abs(testValue-testExact))}`),14,C.red);
  const poly=[];for(let i=0;i<=80;i++){const x=-1+2*i/80,y=Math.pow(x,testDegree)/testFactorial;poly.push([plotX+12+(plotW-24)*i/80,plotY+plotH/2-y/(1/testFactorial)*(plotH*.38)]);}ink.line(plotX+12,plotY+plotH/2,plotX+plotW-12,plotY+plotH/2,C.dim,1);ink.line(plotX+plotW/2,plotY+8,plotX+plotW/2,plotY+plotH-8,C.dim,1);ink.path(poly,C.yellow,2.2);ink.text(plotX+15,plotY+17,`P${testDegree}(x)`,14,C.white);ink.text(plotX+12,plotY+plotH-7,'−1',12,C.muted);ink.text(plotX+plotW/2,plotY+plotH-7,'0',12,C.muted,'center');ink.text(plotX+plotW-12,plotY+plotH-7,'1',12,C.muted,'right');
  return out(ink,[[L('Смещения','Offsets'),nodes.join(', ')],[L('Производная m','Derivative m'),p.m],[L('Порядок p','Order p'),order],[L('Сумма весов','Sum of weights'),fmt(K.sum(ws))]]);
},click(x,y){const hit=this.buttons?.find(b=>Math.hypot(x-b.x,y-b.y)<30);if(!hit)return false;nodes=nodes.includes(hit.s)?nodes.filter(s=>s!==hit.s):[...nodes,hit.s].sort((a,b)=>a-b);p.nodes=[...nodes];return true;}};}
function roundoff(p,lang){const L=lbl(lang);return {render(){
  const ink=new Ink();
  ink.text(480,28,L('Погрешность фактического вычисления','Error from the actual calculation'),22,C.white,'center');
  ink.text(480,55,L('Считаем численную производную f′(0) для f(x) = eˣ.','We approximate f′(0) for f(x) = eˣ.'),15,C.muted,'center');
  ink.text(480,82,L('h — шаг сетки: расстояние между соседними узлами x.','h is the grid step: the distance between neighboring x-nodes.'),18,C.white,'center');
  ink.text(480,105,L('E(h) = |Dₕ f(0) − e|. Ищем значение h, где ошибка минимальна.','E(h) = |Dₕ f(0) − e|. We seek h where the error is minimal.'),17,C.white,'center');
  const xs=range(321,i=>-16+i*15.75/320),errs=xs.map(q=>Math.abs(K.roundedDerivative(1,10**q,p.method,p.precision)-Math.E));
  const minIndex=errs.reduce((best,e,i)=>e<errs[best]?i:best,0),g=graph(ink,{xmin:-16,xmax:0,ymin:-17,ymax:2,y:126,h:268,xlabel:'log₁₀ h',ylabel:'log₁₀ E',xticks:8,yticks:5});
  g.series(xs,errs.map(e=>Math.log10(Math.max(1e-17,e))),C.yellow,2);
  g.dot(xs[minIndex],Math.log10(Math.max(1e-17,errs[minIndex])),5,C.blue);
  ink.text(32,426,L(`Решаем задачу выбора шага: минимум при h ≈ 10^${xs[minIndex].toFixed(2)}.`,`The task is to choose h: the minimum is at h ≈ 10^${xs[minIndex].toFixed(2)}.`),17,C.white);
  xs.forEach((x,i)=>{if(errs[i]===0)g.dot(x,-16.8,3,C.blue);});
  const h=10**p.logh,d=K.roundedDerivative(1,h,p.method,p.precision),e=Math.abs(d-Math.E),R=p.precision==='f32'?Math.fround:x=>x,xx=R(1),hh=R(h),fp=R(Math.exp(R(xx+hh))),fm=R(Math.exp(p.method==='central'?R(xx-hh):xx));
  ink.line(g.X(p.logh),g.y,g.X(p.logh),g.y+g.h,C.blue,1.8,true);g.dot(p.logh,Math.log10(Math.max(1e-17,e)),5,C.blue);
  ink.text(76,458,'f(x+h)   '+fp.toPrecision(p.precision==='f32'?9:17),17,C.white);
  ink.text(76,491,(p.method==='central'?'f(x−h)   ':'f(x)       ')+fm.toPrecision(p.precision==='f32'?9:17),17,C.white);
  ink.text(535,458,L('Разность значений','Subtracted values')+'   '+fmt(R(fp-fm)),17,C.yellow);
  ink.text(535,491,'Dₕf       '+fmt(d,9),17,C.yellow);
  ink.text(76,557,L('Одинаковые округлённые значения → нулевой числитель.','Identical rounded values → a zero numerator.'),18,C.muted);
  return out(ink,[['h',fmt(h)],['Dₕ exp(1)',fmt(d,8)],[L('Ошибка','Error'),fmt(e)],[L('Точность','Precision'),p.precision==='f32'?'binary32':'binary64']]);
}};}
const OPS={shift:{1:1},forward:{0:-1,1:1},central:{'-1':-.5,1:.5},laplace:{'-1':1,0:-2,1:1},compose:{0:1,1:-2,2:1}};
function shift(p,lang){const L=lbl(lang);return {render(){
  const u=range(16,i=>Math.sin(K.TAU*i/16+p.phase)),coeffs=OPS[p.op],v=K.applyShiftOperator(u,coeffs),i=p.node;
  const ink=new Ink().title(L('Каждая строка результата — линейная комбинация входа','Each output entry is a linear combination of the input'),L('Периодическое продолжение: после индекса 15 следует 0.','Periodic continuation: index 15 is followed by index 0.'));
  const x=j=>91+j*54,dy=70,inputY=143;
  ink.text(44,84,L('Исходная функция: u(x) = sin(2πx + φ)','Input function: u(x) = sin(2πx + φ)'),18,C.white);
  const curve=Array.from({length:161},(_,q)=>{const z=q/160;return [x(0)+(x(15)-x(0))*z,112-19*Math.sin(K.TAU*z+p.phase)];});
  ink.line(x(0),112,x(15),112,C.dim,1);ink.path(curve,C.blue,2);ink.text(44,116,'u(x)',14,C.muted);
  ink.text(44,125,'u',18,C.white);
  for(let j=0;j<16;j++){
    const involved=Object.entries(coeffs).some(([s,w])=>w&&K.wrap(i+Number(s),16)===j);
    ink.rect(x(j)-22,inputY,46,58,involved?'#3d4c32':'#15251c',involved?C.green:C.grid);ink.text(x(j),inputY+34,fmt(u[j],2),14,C.white,'center');ink.text(x(j),inputY-18,String(j),14,C.muted,'center');
    ink.rect(x(j)-22,dy+255,46,58,j===i?'#665a32':'#15251c',j===i?C.yellow:C.grid);ink.text(x(j),dy+289,fmt(v[j],2),14,C.yellow,'center');
  }
  Object.entries(coeffs).forEach(([s,w])=>{const j=K.wrap(i+Number(s),16);ink.arrow(x(j),inputY+66,x(i),dy+244,C.yellow,2);ink.text((x(j)+x(i))/2+(Number(s)*8),260+Number(s)*14,(w>0?'+':'')+frac(w),14,C.yellow,'center');});
  const outBase=475,outScale=26/Math.max(1e-6,...v.map(q=>Math.abs(q))),outPoints=v.map((q,j)=>[x(j),outBase-q*outScale]);
  ink.text(44,420,p.op==='compose'?'vᵢ = Δ²uᵢ':'vᵢ = P(E)uᵢ',16,C.yellow);ink.line(x(0),outBase,x(15),outBase,C.dim,1);ink.path(outPoints,C.yellow,2);outPoints.forEach((pt,j)=>ink.dot(pt[0],pt[1],j===i?5:3,j===i?C.blue:C.yellow));
  ink.text(75,545,p.op==='compose'?'(E−I)(E−I) = E²−2E+I':p.op==='laplace'?'(E−I)(I−E⁻¹) = E−2I+E⁻¹':'Eˢuᵢ = uᵢ₊ₛ',18,C.yellow);
  ink.text(75,580,L('Здесь h = 1/N; для производной разность делят на hᵐ.','Here h = 1/N; divide an m-th difference by hᵐ for a derivative.'),14,C.muted);
  return out(ink,[[L('Индекс i','Index i'),i],[L('Вход uᵢ','Input uᵢ'),fmt(u[i])],[L('Результат','Output'),fmt(v[i])],[L('Сумма весов','Sum of weights'),fmt(K.sum(Object.values(coeffs)))]]);
}};}
function compact(p,lang){const L=lbl(lang);return {render(){
  const n=p.n,h=1/n,xs=range(n,i=>i*h),u=xs.map(x=>Math.sin(K.TAU*p.k*x)),exact=xs.map(x=>K.TAU*p.k*Math.cos(K.TAU*p.k*x)),d=K.compactDerivative(u,h,p.kind),i=Math.min(n-1,Math.floor(p.node*n)),alpha=p.kind==='compact4'?.25:p.kind==='compact6'?1/3:0;
  const ink=new Ink().title(L('Один шаблон на каждую строку; решается весь вектор d','One stencil per row; the entire vector d is solved'),L('Верхний график: производные в узлах. Нижняя полоса: ненулевые элементы выбранной строки A.','Top: nodal derivatives. Bottom: nonzero entries in the selected row of A.'));
  ink.text(691,94,L('— точная   • разностная','— exact   • numerical'),14,C.muted);
  const lim=K.TAU*p.k*1.25,g=graph(ink,{y:112,h:265,ymin:-lim,ymax:lim,ylabel:'du/dx'});
  g.curve(x=>K.TAU*p.k*Math.cos(K.TAU*p.k*x),C.white,2,700);g.series(xs,d,C.yellow,1.7,true);ink.line(g.X(xs[i]),g.y,g.X(xs[i]),g.y+g.h,C.blue,1.4,true);
  const visible=Math.min(n,40),bw=840/visible,start=Math.max(0,Math.min(i-Math.floor(visible/2),n-visible));
  for(let j=start;j<start+visible;j++){const a=j===i?1:((j===K.wrap(i-1,n)||j===K.wrap(i+1,n))?alpha:0),x=77+(j-start)*bw;
    ink.rect(x,436,bw-2,49,a?'#514e2d':'#142019',a?C.yellow:C.grid);if(a)ink.text(x+bw/2,466,frac(a),Math.min(16,bw/1.7),C.yellow,'center');}
  ink.text(77,419,`A[${i}, :]`,15,C.muted);ink.text(77,524,alpha?L('Соседние d неизвестны → циклическая трёхдиагональная система.','Neighboring d values are unknown → a cyclic tridiagonal system.'):L('A = I: производные вычисляются независимо.','A = I: each derivative is evaluated independently.'),18,C.white);
  ink.text(77,562,p.kind==='compact6'?'α = 1/3, a = 14/9, b = 1/9':p.kind==='compact4'?'α = 1/4, a = 3/2, b = 0':L('Явная формула: α = 0.','Explicit formula: α = 0.'),17,C.muted);
  return out(ink,[[L('СКО производной','Derivative RMS error'),fmt(K.l2Error(d,exact))],[L('Узлов на волну','Points per wave'),fmt(n/p.k)],[L('Строка i','Row i'),i],['dᵢ',fmt(d[i])]]);
}};}
function dispersion(p,lang){const L=lbl(lang);return {render(){
  const xi=p.xi*Math.PI,ks=K.modifiedWave(p.kind,xi),ink=new Ink().title(L('Как сетка искажает производную волны','How the grid distorts a wave derivative'),L('Для u(x) = sin(kx) проверяем, как сетка меняет волновое число k.','For u(x) = sin(kx), we check how the grid changes the wavenumber k.'));
  const g=graph(ink,{x:70,y:126,w:460,h:294,xmin:0,xmax:Math.PI,ymin:0,ymax:Math.PI,xticks:4,xlabel:'ξ',ylabel:'ξ*'});
  g.curve(x=>x,C.white,1.8);const kinds=['central','fourth','compact4','compact6'],cols=[C.red,C.blue,C.green,C.yellow];
  kinds.forEach((kind,j)=>g.curve(x=>K.modifiedWave(kind,x),cols[j],p.kind===kind?3:1.2));
  ink.line(g.X(xi),g.y,g.X(xi),g.y+g.h,C.muted,1,true);g.dot(xi,ks,5,C.yellow);
  const q=graph(ink,{x:631,y:160,w:292,h:220,xmin:0,xmax:2,ymin:-1.2,ymax:1.2,xlabel:'x/λ',ylabel:'uₓ/k',xticks:2,yticks:2});
  q.curve(x=>Math.cos(K.TAU*x),C.white,2);q.curve(x=>ks/xi*Math.cos(K.TAU*x),C.yellow,2.5);
  ink.text(643,428,L('Отношение амплитуд: k*/k = ','Amplitude ratio: k*/k = ')+fmt(ks/xi),16,C.yellow);
  kinds.forEach((kind,j)=>{const names=lang==='en'?['explicit 2','explicit 4','compact 4','compact 6']:['явная 2','явная 4','компактная 4','компактная 6'];ink.line(77+j*217,483,100+j*217,483,cols[j],3);ink.text(110+j*217,489,names[j],14,C.muted);});
  ink.text(77,548,p.xi>.97?L('При ξ ≈ π центральная разность теряет короткую волну: k*/k → 0.','Near ξ ≈ π, the centered difference loses the shortest wave: k*/k → 0.'):L('При малом ξ длинные волны передаются почти без искажения: k*/k ≈ 1.','For small ξ, long waves pass with little distortion: k*/k ≈ 1.'),15,C.muted);
  return out(ink,[['ξ = kh',fmt(xi)],[L('Узлов на волну','Points per wave'),fmt(2*Math.PI/xi)],['k*/k',fmt(ks/xi)],[L('Относительная ошибка','Relative error'),fmt(Math.abs(1-ks/xi)*100)+'%']]);
}};}
function spacetime(p,lang){const L=lbl(lang);return {render(){
  const ink=new Ink().title(L('Откуда берётся значение в верхнем узле?','Where does the value at the top node come from?'),L('Веса определяют численные связи. aΔt = Ch — физическое смещение.','Weights define numerical links. aΔt = Ch is the physical displacement.'));
  const weights=K.advectionWeights(p.scheme,p.C),active=weights.map((v,j)=>({s:j-1,w:v})).filter(q=>Math.abs(q.w)>1e-12),sx=49,sy=58,origin={x:355,y:146},steps=p.steps;
  const bottom=origin.y+steps*sy;
  for(let r=0;r<=steps;r++){ink.line(76,origin.y+r*sy,654,origin.y+r*sy,C.grid);ink.text(59,origin.y+r*sy+5,r===0?'n+1':`n${r>1?'−'+(r-1):''}`,13,C.muted,'right');for(let j=-5;j<=5;j++)ink.dot(origin.x+j*sx,origin.y+r*sy,2.3,C.dim);}
  let current=new Set([0]);
  for(let r=0;r<steps;r++){const next=new Set();for(const j of current){for(const q of active){const k=j+q.s;next.add(k);if(Math.abs(j)<=5&&Math.abs(k)<=5)ink.line(origin.x+j*sx,origin.y+r*sy,origin.x+k*sx,origin.y+(r+1)*sy,q.w<0?'#795249':'#3d6157',1.2);}}current=next;for(const k of next)if(Math.abs(k)<=5)ink.dot(origin.x+k*sx,origin.y+(r+1)*sy,3.6,C.blue);}
  const foot=origin.x-steps*p.C*sx;ink.arrow(foot,bottom,origin.x,origin.y,C.yellow,3);ink.dot(origin.x,origin.y,8,C.yellow);ink.text(origin.x+17,origin.y-16,L('искомое uᵢⁿ⁺¹','target uᵢⁿ⁺¹'),16,C.yellow);
  ink.text(708,144,L('Веса одного шага','One-step weights'),18,C.white);
  weights.forEach((v,j)=>{ink.text(708,191+j*47,['w₋','w₀','w₊'][j]+' = '+fmt(v),21,v<0?C.red:C.green);});
  const gmax=K.maxAmplification(p.scheme,p.C),stable=gmax<=1+1e-10;
  ink.text(708,365,'max |G| = '+fmt(gmax),19,stable?C.green:C.red);
  ink.text(708,400,stable?L('нет роста мод','no modal growth'):L('есть растущие моды','growing modes exist'),16,stable?C.green:C.red);
  ink.text(77,545,Math.abs(p.C)>1?L('Характеристика уходит за пределы области численной зависимости.','The characteristic lies outside the numerical domain of dependence.'):p.scheme==='ftcs'?L('CFL выполнено, но FTCS неустойчива: |G| > 1 при C ≠ 0.','CFL is satisfied, but FTCS is unstable: |G| > 1 when C ≠ 0.'):L('Попадание характеристики в численную область — только необходимая проверка.','Containing the characteristic is only a necessary check.'),17,stable?C.muted:C.red);
  return out(ink,[['C',fmt(p.C)],[L('Сумма весов','Sum of weights'),fmt(K.sum(weights))],['max |G|',fmt(gmax)],[L('Отрицательные веса','Negative weights'),weights.filter(v=>v<0).length]]);
}};}
function balance(p,lang){const L=lbl(lang),n=8,h=1/n,a=Number(p.speed??1),dt=Number(p.dt??.04);
  const initial=()=>Array.from({length:n},(_,i)=>p.profile==='step'?(i<n/2?1:.2):p.profile==='wave' ? .8+.22*Math.sin(K.TAU*i/n):.65+.4*Math.exp(-(((i-2)/1.25)**2)));
  const fluxes=state=>{const F=new Array(n+1);F[0]=a*state[n-1];for(let j=1;j<n;j++)F[j]=a*state[j-1];F[n]=F[0];return F;};
  const advance=(state,F)=>state.map((value,i)=>value+dt/h*(F[i]-F[i+1]));
  let u=initial(),t=0,count=0,stop='';
  return {get time(){return t;},get count(){return count;},get stop(){return stop;},step(){u=advance(u,fluxes(u));t+=dt;count++;return true;},render(){
  const F=fluxes(u),v=advance(u,F),M=K.sum(u)*h,Mn=K.sum(v)*h;
  const ink=new Ink().title(L('Поток переносит запас по сетке','Flux transports content across the grid'),L('Стрелки Fᵢ меняются вместе с профилем uᵢ. Контур: состояние после одного шага.','Arrows Fᵢ move with the profile uᵢ. Outline: state after one step.'));
  const x0=115,w=94,base=330,dy=136;
  for(let i=0;i<n;i++){const x=x0+i*w;ink.rect(x,base-u[i]*125,w-6,u[i]*125,'#334c3c',C.green);ink.rect(x+4,base-v[i]*125,w-14,v[i]*125,null,C.yellow,2);ink.text(x+w/2-3,base+29,'i = '+i,14,C.muted,'center');ink.text(x+w/2-3,base+59,fmt(v[i]-u[i],3),16,C.yellow,'center');}
  for(let j=0;j<=n;j++){const x=x0+j*w-3,dx=F[j]*50;ink.arrow(x-dx/2,dy,x+dx/2,dy,C.blue,2.3);ink.text(x,dy-22,fmt(F[j],2),14,C.blue,'center');}
  ink.text(75,420,L('Один шаг переноса:','One transport step:'),18,C.white);
  ink.text(75,463,'uᵢⁿ⁺¹ = uᵢⁿ + (aΔt/h)(uᵢ₋₁ⁿ − uᵢⁿ)',21,C.yellow);
  ink.text(75,506,`t = ${fmt(t,3)};   ${L('сумма до','total before')} = ${fmt(M)};   ${L('после','after')} = ${fmt(Mn)}`,17,C.white);
  ink.text(75,560,L('Периодическая граница возвращает поток справа налево. Внутренние потоки меняют распределение, сумма запаса сохраняется.','The periodic boundary returns the right flux to the left. Interior fluxes change the distribution while conserving the total.'),16,C.muted);
  return out(ink,[['t',fmt(t)],['Mⁿ',fmt(M)],['Mⁿ⁺¹',fmt(Mn)],[L('Изменение суммы','Change in total'),fmt(Mn-M)]]);
  }};}
function poisson(p,lang){const L=lbl(lang);const {A,b,u}=K.laplaceSolve(p.n,p.left,p.right);let selected=Math.floor(p.n*p.n/2);return {render(){
  const n=p.n,N=n*n,ink=new Ink().title(L('Локальные связи превращаются в разреженный оператор','Local connections become a sparse operator'),L('Щёлкните по узлу слева или строке справа. Углы границы не участвуют в шаблоне.','Click a node on the left or a row on the right. Boundary corners do not enter the stencil.'));
  const x0=94,y0=126,side=320,h=side/(n+1),i=selected%n,j=Math.floor(selected/n),max=Math.max(p.left,p.right,1e-8);
  ink.rect(x0,y0,side,side,null,C.muted,2);
  for(let jj=0;jj<n;jj++)for(let ii=0;ii<n;ii++){const k=jj*n+ii,x=x0+(ii+1)*h,y=y0+(jj+1)*h,v=u[k]/max,fill=`rgb(${Math.round(29+v*113)},${Math.round(48+v*108)},${Math.round(36+v*61)})`;
    ink.rect(x-h*.4,y-h*.4,h*.8,h*.8,fill,k===selected?C.yellow:C.grid,k===selected?3:1);if(n<=6)ink.text(x,y+4,fmt(u[k],2),12,C.white,'center');
    if(A[selected][k]!==0&&k!==selected)ink.line(x0+(i+1)*h,y0+(j+1)*h,x,y,C.yellow,2);}
  ink.text(x0-17,y0+side/2,fmt(p.left),17,C.green,'right');ink.text(x0+side+17,y0+side/2,fmt(p.right),17,C.green);ink.text(x0+side/2,y0-14,'0',17,C.green,'center');ink.text(x0+side/2,y0+side+24,'0',17,C.green,'center');
  const mx=535,my=126,ms=320,cell=ms/N;
  ink.rect(mx,my,ms,ms,'#111e17',C.muted);ink.rect(mx,my+selected*cell,ms,cell,'#555035',null);
  for(let r=0;r<N;r++)for(let k=0;k<N;k++)if(A[r][k])ink.rect(mx+k*cell+.2,my+r*cell+.2,Math.max(.8,cell-.4),Math.max(.8,cell-.4),r===selected?C.yellow:A[r][k]===4?C.white:C.blue,null);
  ink.text(mx-12,my+selected*cell+cell/2+4,String(selected),13,C.yellow,'right');ink.text(mx+ms+14,my+selected*cell+cell/2+4,'b = '+fmt(b[selected]),14,C.yellow);
  ink.text(78,505,`(i,j) = (${i},${j})  →  k = jn+i = ${selected}`,20,C.yellow);
  const terms=A[selected].map((v,k)=>v?`${v>0?'+':''}${v}u${k}`:'').filter(Boolean).join(' ');
  ink.text(78,545,terms+' = '+fmt(b[selected]),18,C.white);
  this.geo={x0,y0,side,h,mx,my,ms,cell};
  let residual=0;for(let r=0;r<N;r++)residual=Math.max(residual,Math.abs(K.sum(A[r].map((v,k)=>v*u[k]))-b[r]));
  return out(ink,[[L('Неизвестных','Unknowns'),N],[L('Ненулевых элементов','Nonzero entries'),A.flat().filter(v=>v).length],['uₖ',fmt(u[selected])],[L('Невязка ∞','Residual ∞'),fmt(residual)]]);
},click(x,y){const g=this.geo;if(!g)return false;if(x>=g.mx&&x<=g.mx+g.ms&&y>=g.my&&y<g.my+g.ms){selected=K.clamp(Math.floor((y-g.my)/g.cell),0,p.n*p.n-1);return true;}if(x>=g.x0&&x<=g.x0+g.side&&y>=g.y0&&y<=g.y0+g.side){const i=K.clamp(Math.round((x-g.x0)/g.h)-1,0,p.n-1),j=K.clamp(Math.round((y-g.y0)/g.h)-1,0,p.n-1);selected=j*p.n+i;return true;}return false;}};}
function cost(p,lang){const L=lbl(lang);return {render(){
  const a=K.costEstimate(p),b=K.costEstimate({...p,n:p.n*2}),ratio=b.operations/a.operations,ink=new Ink().title(L('Уточнение сетки увеличивает и число узлов, и число шагов','Refinement increases both grid size and the number of time steps'),L('Расчёт до одного и того же физического времени T = 1.','Both calculations reach the same physical time T = 1.'));
  const base=350,barmax=200,barw=85,xs=[145,435,725],vals=[[a.dof,b.dof],[a.steps,b.steps],[a.operations,b.operations]],names=[L('Неизвестные','Unknowns'),L('Временные шаги','Time steps'),L('Работа','Work')];
  for(let j=0;j<3;j++){const max=vals[j][1],h1=barmax*vals[j][0]/max,h2=barmax;ink.rect(xs[j],base-h1,barw,h1,'#375344',C.green);ink.rect(xs[j]+barw+14,base-h2,barw,h2,'#76673d',C.yellow);ink.text(xs[j]+barw,392,names[j],19,C.white,'center');ink.text(xs[j]+barw,436,'× '+fmt(vals[j][1]/vals[j][0]),27,C.yellow,'center');ink.text(xs[j]+barw/2,base+22,'n',15,C.green,'center');ink.text(xs[j]+barw*1.5+14,base+22,'2n',15,C.yellow,'center');}
  ink.text(82,510,`W(2n) / W(n) = 2${p.dim===1?'¹':p.dim===2?'²':'³'} × ${p.mode==='diffusion'?'2²':'2'} = ${ratio}`,25,C.white);
  ink.text(82,557,L(`Память: ${fmt(a.memory/2**20)} → ${fmt(b.memory/2**20)} MiB; три массива binary64.`,`Memory: ${fmt(a.memory/2**20)} → ${fmt(b.memory/2**20)} MiB; three binary64 arrays.`),17,C.muted);
  return out(ink,[['N_dof',fmt(a.dof)],['N_steps',fmt(a.steps)],[L('Условных операций','Illustrative operations'),fmt(a.operations)],[L('Показатель n','Power of n'),a.exponent]]);
}};}
function createStatic(id,p,lang){const factories={grid:gridLab,differences,stencil,roundoff,shift,compact,dispersion,spacetime,balance,poisson,cost};if(!factories[id])return null;return factories[id](p,lang);}

return { createStatic };
})();
export default moduleValue;
