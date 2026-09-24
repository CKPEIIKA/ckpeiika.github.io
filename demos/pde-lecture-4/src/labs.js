import module0 from './board.js';
import module1 from './kernels.js';
const __modules = { "board.js": module0, "kernels.js": module1 };
const moduleValue = (() => {
const {Ink,C,graph,fmt,legend}=__modules['board.js'];
const K=__modules['kernels.js'];
const {range,sum,abs,Cx,cpow,expi,mul,scale,sub,add,norm2,clamp,TAU}=K;
const Xs=n=>range(n,i=>i/(n-1));
const ll=lang=>(ru,en)=>lang==='en'?en:ru;
const maxabs=a=>Math.max(1e-10,...a.filter(Number.isFinite).map(Math.abs));
const padded=a=>Math.max(.01,1.15*maxabs(a));
const logs=a=>a.map(v=>v>0&&Number.isFinite(v)?Math.log10(v):NaN);
const out=(ink,stats,rows=[],note='',warning=false)=>({ink,stats,rows,note,warning});
const lbl=(ink,x,y,s,col=C.white)=>ink.text(x,y,s,17,col);
function panel(ink,title,{x=75,y=115,w=850,h=260,...rest}={}){ink.text(x,y-30,title,17,C.white);ink.cmd.at(-1).maxWidth=w;return graph(ink,{x,y,w,h,...rest});}
function unit(ink,g,col=C.dim){ink.path(range(161,j=>[g.X(Math.cos(TAU*j/160)),g.Y(Math.sin(TAU*j/160))]),col,1.5,true);}
function contourDraw(ink,g,segments,col=C.blue,width=1.4){for(const seg of segments)ink.path(seg.map(([x,y])=>[g.X(x),g.Y(y)]),col,width);}
function timing(ink,n){ink.text(945,32,'n = '+n,17,C.yellow,'right');}
function dynamic(render,step,limit=100){return {count:0,time:0,stop:'',render,step(){if(this.stop)return;if(this.count>=limit){this.stop='■';return;}step.call(this);this.count++;}};}
function lineLog(ink,title,xs,series,{x=80,y=443,w=840,h=110,xlabel='n',ymin,ymax}={}){
 const all=series.flatMap(s=>logs(s.values)).filter(Number.isFinite);ymin=ymin??Math.min(-.1,...all);ymax=ymax??Math.max(.1,...all);
 if(ymax-ymin<.2){ymin-=.1;ymax+=.1;}const g=panel(ink,title,{x,y,w,h,xmin:Math.min(...xs),xmax:Math.max(1,...xs),ymin,ymax,yticks:3,xlabel,ylabel:'log₁₀'});
 for(const s of series)g.series(xs,logs(s.values),s.color,s.width||2,Boolean(s.dots));return g;
}
function errorBudget(p,lang){const L=ll(lang);return {render(){const d=K.ellipticError(p.N,p.iterations,p.k),ink=new Ink();ink.title(L('Три решения одной задачи','Three solutions of one problem'),L('Белое: непрерывное · голубое: дискретное · жёлтое: итерации','White: continuous · blue: discrete · yellow: iterate'));
 const g=panel(ink,L('Решение','Solution'),{y:108,h:205,ymin:-padded(d.star),ymax:padded(d.star),ylabel:'u'});g.series(d.xs,d.exact,C.white,2.2);g.series(d.xs,d.star,C.blue,2);g.series(d.xs,d.iterate,C.yellow,2.5,p.N<=64);
 const s=padded([...d.disc,...d.alg,...d.total]),e=panel(ink,L('Знаковые слагаемые ошибки: жёлтое = голубое + красное','Signed error components: yellow = blue + red'),{y:407,h:125,ymin:-s,ymax:s,ylabel:'e'});e.series(d.xs,d.disc,C.blue);e.series(d.xs,d.alg,C.red);e.series(d.xs,d.total,C.yellow,2.5);
 legend(ink,[[L('Дискретизация','Discretization'),C.blue],[L('Алгебраическая','Algebraic'),C.red],[L('Полная ошибка','Total error'),C.yellow]],577,80,290);
 return out(ink,[[L('‖e дискр.‖₂','‖discretization error‖₂'),fmt(norm2(d.disc,1/p.N))],[L('‖e алгебр.‖₂','‖algebraic error‖₂'),fmt(norm2(d.alg,1/p.N))],[L('‖e полная‖₂','‖total error‖₂'),fmt(norm2(d.total,1/p.N))],[L('Относительная невязка','Relative residual'),fmt(Math.abs(d.q**p.iterations))]],d.xs.map((x,i)=>({x,exact:d.exact[i],discrete:d.star[i],iterate:d.iterate[i],discretization_error:d.disc[i],algebraic_error:d.alg[i],total_error:d.total[i],residual:d.residual[i]})));}};}
function consistency(p,lang){const L=ll(lang),rows=K.consistencyStudy(p.scheme,p.co,p.T,p.logeps,p.noise==='on');return {render(){const ink=new Ink();ink.title(L('Одна физическая задача, пять сеток','One physical problem, five grids'),L('Гладкое решение + начальное возмущение εh²(−1)ʲ','Smooth solution + initial perturbation εh²(−1)ʲ'));
 const x=rows.map(r=>Math.log2(r.N)),common={x:85,y:120,w:355,h:255,xlabel:'log₂ N',xmin:4,xmax:8};
 const left=panel(ink,L('Локальная невязка уменьшается','Local defect decreases'),{...common,ymin:Math.min(...logs(rows.map(r=>r.defect)))-.1,ymax:Math.max(...logs(rows.map(r=>r.defect)))+.1,ylabel:'log₁₀ ‖τₕ‖'});left.series(x,logs(rows.map(r=>r.defect)),C.blue,2.6,true);
 const le=logs(rows.map(r=>r.error)),right=panel(ink,L('Ошибка при одном T','Global error at one T'),{...common,x:570,w:340,ymin:Math.min(-1,...le)-.1,ymax:Math.max(...le)+.15,ylabel:'log₁₀ ‖e(T)‖'});right.series(x,le,C.red,2.5,true);
 const headings=['N','τ','Co',L('‖τₕ‖₂','‖defect‖₂'),L('‖e(T)‖₂','‖error(T)‖₂')],xs=[95,230,390,570,780];headings.forEach((s,i)=>ink.text(xs[i],429,s,16,C.muted));rows.forEach((r,i)=>[r.N,fmt(r.dt),fmt(r.co),fmt(r.defect),fmt(r.error)].forEach((s,j)=>ink.text(xs[j],456+25*i,s,16,j===4?C.red:C.white)));
 const last=rows.at(-1);return out(ink,[[L('Конечное время','Final time'),p.T],[L('Невязка, N=256','Defect, N=256'),fmt(last.defect)],[L('Начальный шум, N=256','Initial noise, N=256'),fmt(last.initialNoise)],[L('Ошибка, N=256','Error, N=256'),fmt(last.error)]],rows.map(({U,truth,...r})=>r),p.noise==='off'?L('Одна гладкая гармоника не проверяет устойчивость ко всем возмущениям.','A single smooth harmonic does not test stability against all perturbations.'):'');}};}
function accumulation(p,lang){const L=ll(lang);let impulse=-1,data=K.errorHistory(p.N,p.p,p.family,impulse);return {count:0,time:0,stop:'',step(){if(this.count>=p.N){this.stop=L('Достигнуто T = 1. Сгущайте N при том же T.','Reached T = 1. Refine N at fixed T.');return;}this.count++;this.time=this.count/p.N;},click(x,y){if(y<350||y>550||x<80||x>920)return false;impulse=clamp(Math.floor((x-80)/840*p.N),0,p.N-1);data=K.errorHistory(p.N,p.p,p.family,impulse);return true;},render(){const ink=new Ink(),n=this.count;ink.title(L('Невязка превращается в накопленную ошибку','Local defects accumulate into global error'),L('Нажмите на нижнюю шкалу: один источник ошибки станет в 8 раз сильнее','Click the lower timeline: make one local defect eight times larger'));timing(ink,n);
 const yMax=padded(data.values),g=panel(ink,L('Ошибка за физическое время','Error over physical time'),{y:110,h:190,xmin:0,xmax:1,ymin:-yMax,ymax:.05*yMax,ylabel:'e'});g.series(range(n+1,j=>j/p.N),data.values.slice(0,n+1),C.yellow,2.5);
 const terms=range(n,m=>-data.dt*data.forcing[m]*data.G**(n-1-m)),M=padded(terms);this.g=panel(ink,L('Вес каждой прошлой невязки в текущем eⁿ','Contribution of each past local defect to current eⁿ'),{y:420,h:100,xmin:0,xmax:p.N,ymin:-M,ymax:M*.2,xlabel:'m',ylabel:'−τGⁿ⁻¹⁻ᵐτₕᵐ'});
 for(let j=0;j<p.N;j++){const c=j===impulse?C.red:C.blue;ink.rect(this.g.X(j+.1),this.g.Y(0),.8*this.g.w/p.N,j<n?this.g.Y(terms[j])-this.g.Y(0):0,c,null);if(j===impulse)ink.dot(this.g.X(j+.5),545,5,C.red);}
 ink.text(82,584,L('Сумма столбиков точно восстанавливает eⁿ; при сгущении T остаётся равным 1.','The bars sum to eⁿ; refinement always keeps T = 1.'),16,C.muted);
 return out(ink,[['G',fmt(data.G)],[L('Локальная невязка hᵖ','Local defect hᵖ'),fmt(data.local)],['|eⁿ|',fmt(Math.abs(data.values[n]))],['|G|ᴺ',fmt(data.G**p.N)]],range(n+1,j=>({step:j,time:j/p.N,error:data.values[j],G:data.G})));}};}
function fourier(p,lang){const L=ll(lang),N=64;let original=range(N,j=>.6*Math.sin(TAU*3*j/N)+p.high*((j%2)?-1:1)),coef=K.dft(original);return {count:0,time:0,stop:'',step(){if(this.count>=90){this.stop=L('90 шагов. Сбросьте опыт или измените r.','90 steps. Reset or change r.');return;}coef=coef.map((z,k)=>scale(z,1-4*p.r*Math.sin(Math.PI*k/N)**2));this.count++;this.time=this.count*p.r/N**2;if(Math.max(...coef.map(abs))>1e6)this.stop=L('Рост превысил 10⁶. Опыт остановлен, данные не обрезаны.','Growth exceeded 10⁶. Stopped; data are not clipped.');},click(x,y){if(this.sg?.contains(x,y)){p.k=clamp(Math.round(this.sg.inverse(x,y)[0]),0,32);return true;}return false;},paint(x,y){if(!this.ug?.contains(x,y))return false;const [xx,yy]=this.ug.inverse(x,y);const u=K.idft(coef),j=clamp(Math.round(xx*N),0,N-1);u[j]=yy;coef=K.dft(u);original=u;this.count=0;this.time=0;this.stop='';return true;},render(){const u=K.idft(coef),en=K.foldedEnergy(coef),isolated=coef.map((z,k)=>k===p.k||k===(N-p.k)%N?z:Cx()),part=K.idft(isolated),ink=new Ink();ink.title(L('Сигнал и его спектральная энергия','Signal and its spectral energy'),L('Рисуйте сверху; выбирайте гармонику снизу','Draw above; select a harmonic below'));timing(ink,this.count);
 const m=Math.max(1,1.15*maxabs(u));this.ug=panel(ink,L('Возмущение и выделенная гармоника','Perturbation and selected harmonic'),{y:110,h:205,ymin:-m,ymax:m,ylabel:'v'});this.ug.series(range(N,j=>j/N),u,C.white,2,true);this.ug.series(range(N,j=>j/N),part,C.yellow,2.8);
 const emax=Math.max(.2,Math.max(...en)*1.15);this.sg=panel(ink,L('Вклад пары ±k в ‖v‖²; k = 0 и N/2 считаются один раз','Energy of pair ±k; k = 0 and N/2 count once'),{y:413,h:112,xmin:0,xmax:32,ymin:0,ymax:emax,xlabel:'k',ylabel:'Eₖ'});
 for(let k=0;k<=32;k++){const w=10;ink.rect(this.sg.X(k)-w/2,this.sg.Y(en[k]),w,this.sg.Y(0)-this.sg.Y(en[k]),k===p.k?C.yellow:C.blue,null);if(k===p.k)ink.dot(this.sg.X(k),548,4,C.yellow);}
 const real=sum(u.map(v=>v*v))/N,spec=sum(coef.map(z=>abs(z)**2));ink.text(85,584,L('DFT и обратное DFT пересчитываются из данных; это не заранее заданные столбики.','DFT and inverse DFT are computed from data, not from predesigned bars.'),15,C.muted);
 return out(ink,[['‖v‖ₕ²',fmt(real)],['Σ |v̂ₖ|²',fmt(spec)],[L('Невязка Парсеваля','Parseval residual'),fmt(Math.abs(real-spec))],['G(k='+p.k+')',fmt(1-4*p.r*Math.sin(Math.PI*p.k/N)**2)]],coef.map((z,k)=>({k,real:z.re,imag:z.im,energy:abs(z)**2,amplification:1-4*p.r*Math.sin(Math.PI*k/N)**2})));}};}
function godograph(p,lang){const L=ll(lang);return dynamic(function(){const ink=new Ink(),n=this.count,c=p.c,t=p.theta*Math.PI,z=K.gain(p.scheme,c,t),samples=range(501,j=>j/500*Math.PI),gains=samples.map(th=>abs(K.gain(p.scheme,c,th))),worst=Math.max(...gains);ink.title(L('Одна схема — множество независимых гармоник','One scheme — many independent harmonics'),L('Нажмите рядом с годографом, чтобы выбрать частоту','Click near the locus to choose a frequency'));timing(ink,n);
 const bound=Math.max(1.5,1.1*worst);this.zg=panel(ink,'G(ϑ)',{x:100,y:105,w:285,h:285,xmin:-bound,xmax:bound,ymin:-bound,ymax:bound,xticks:4,yticks:4,xlabel:'Re',ylabel:'Im'});unit(ink,this.zg);ink.path(range(401,j=>{const v=K.gain(p.scheme,c,-Math.PI+TAU*j/400);return [this.zg.X(v.re),this.zg.Y(v.im)];}),C.blue,2.5);this.zg.dot(z.re,z.im,6,C.yellow);ink.arrow(this.zg.X(0),this.zg.Y(0),this.zg.X(z.re),this.zg.Y(z.im),C.yellow);
 const g=panel(ink,L('Наихудшая гармоника','Worst harmonic'),{x:560,y:105,w:350,h:235,xmin:0,xmax:1,ymin:0,ymax:Math.max(1.3,worst*1.1),xlabel:'ϑ/π',ylabel:'|G|'});g.curve(x=>abs(K.gain(p.scheme,c,x*Math.PI)),C.blue,2.5);g.curve(()=>1,C.dim,1,2,true);g.dot(p.theta,abs(z),6,C.yellow);
 ink.text(565,383,'G = '+fmt(z.re)+' '+(z.im<0?'−':'+')+' '+fmt(Math.abs(z.im))+'i',18,C.yellow);
 const ns=range(n+1),a=ns.map(j=>j===0?1:abs(z)**j);lineLog(ink,L('Амплитуда выбранной моды','Selected modal amplitude'),ns,[{values:a,color:C.yellow}],{y:461,h:90});
 return out(ink,[['ϑ / π',fmt(p.theta)],['|G(ϑ)|',fmt(abs(z))],['max |G|',fmt(worst)],[L('Амплитуда |G|ⁿ','Amplitude |G|ⁿ'),fmt(abs(z)**n)]],samples.map((th,i)=>{const v=K.gain(p.scheme,c,th);return {theta:th,real:v.re,imag:v.im,abs:gains[i]};}),L('Отрицательный G означает смену знака, а не обязательно рост.','Negative G means alternating sign, not necessarily growth.'));
 },function(){this.time++;},100);}
function mol(p,lang){const L=ll(lang),zs=K.modalSpectrum(p.operator,p.s,32),cs=K.contours((x,y)=>abs(K.stability(p.method,Cx(x,y))),-4,2,-3,3,90,90,1);return dynamic(function(){const n=this.count,ink=new Ink(),z=zs[p.k],R=K.stability(p.method,z);ink.title(L('Временной интегратор видит спектр пространственного оператора','The time integrator acts on the spatial spectrum'),L('Область |R(z)| ≤ 1, граница вычислена по функции R','Region |R(z)| ≤ 1; boundary computed from R'));timing(ink,n);
 const g=panel(ink,L('Спектр τAₕ','Spectrum of τAₕ'),{x:92,y:110,w:370,h:370,xmin:-4,xmax:2,ymin:-3,ymax:3,xlabel:'Re z',ylabel:'Im z',xticks:3,yticks:3});
 // Sparse interior hatching indicates the stable side, also for unbounded regions.
 for(let j=0;j<24;j++)for(let i=0;i<24;i++){const x=-4+6*(i+.5)/24,y=-3+6*(j+.5)/24;if(abs(K.stability(p.method,Cx(x,y)))<1)ink.line(g.X(x)-3,g.Y(y)+3,g.X(x)+3,g.Y(y)-3,C.grid,1);}
 contourDraw(ink,g,cs,C.green,2);let outsideView=0;zs.forEach((q,k)=>{if(q.re<-4||q.re>2||Math.abs(q.im)>3)outsideView++;else g.dot(q.re,q.im,k===p.k?6:3.5,k===p.k?C.yellow:abs(K.stability(p.method,q))>1+1e-10?C.red:C.blue);});
 const ns=range(n+1),num=ns.map(j=>abs(cpow(R,j))),truth=ns.map(j=>Math.exp(j*z.re));lineLog(ink,L('Одна мода: |R(z)|ⁿ и |exp(nz)|','One mode: |R(z)|ⁿ and |exp(nz)|'),ns,[{values:num,color:C.yellow},{values:truth,color:C.white}],{x:590,y:160,w:320,h:185});
 ink.text(590,400,'z = '+fmt(z.re)+' '+(z.im<0?'−':'+')+' '+fmt(Math.abs(z.im))+'i',17,C.blue);ink.text(590,432,'|R(z) − exp(z)| = '+fmt(abs(sub(R,scale(expi(z.im),Math.exp(z.re))))),17,C.yellow);
 ink.text(95,530,L('Голубое: |R| ≤ 1 · красное: |R| > 1 · жёлтое: выбранная мода','Blue: |R| ≤ 1 · red: |R| > 1 · yellow: selected mode'),16,C.muted);
 ink.text(95,574,p.operator==='diffusion'?'s = r = τ / h²':'s = Co = τ / h'+(p.operator==='mixed'?';  r = 0.15Co':''),17,C.white);
 const outside=zs.filter(v=>abs(K.stability(p.method,v))>1+1e-10).length;return out(ink,[[L('Мод вне области |R|≤1','Modes outside |R|≤1'),outside+'/32'],['|R(zₖ)|',fmt(abs(R))],[L('Точная амплитуда ОДУ','Exact ODE amplitude'),fmt(Math.exp(n*z.re))],[L('Вне окна графика','Outside plotting window'),outsideView]],zs.map((v,k)=>({k,real:v.re,imag:v.im,absR:abs(K.stability(p.method,v))})),L('Сравнение с точной ОДУ отделяет временную ошибку от пространственной.','The exact ODE comparison isolates temporal error from spatial error.'));},function(){this.time++;},60);}
function roots(p,lang){const L=ll(lang);return dynamic(function(){const n=this.count,data=K.leapfrogSequence(p.co,p.theta*Math.PI,p.eps,100),ink=new Ink();ink.title(L('Что хранится во втором временном слое','What the second time layer stores'),L('Старт: v̂⁰ = 1, v̂¹ = z₊ + ε','Startup: v̂⁰ = 1, v̂¹ = z₊ + ε'));timing(ink,n);
 const g=panel(ink,L('Корни характеристического полинома','Roots of the characteristic polynomial'),{x:100,y:110,w:280,h:280,xmin:-1.7,xmax:1.7,ymin:-1.7,ymax:1.7,xlabel:'Re z',ylabel:'Im z'});unit(ink,g);data.roots.forEach((z,i)=>{g.dot(z.re,z.im,i?5:8,i?C.red:C.blue);ink.text(g.X(z.re)+12,g.Y(z.im)+(i?24:-12),i?'z₋':'z₊',18,i?C.red:C.blue);});
 const shown=data.v.slice(0,n+1),m=Math.max(1.2,maxabs(shown.flatMap(z=>[z.re,z.im]))*1.1),q=panel(ink,L('Реальная рекуррентная последовательность','The actual recurrence sequence'),{x:550,y:110,w:355,h:250,xmin:0,xmax:100,ymin:-m,ymax:m,xlabel:'n',ylabel:'Re, Im'});q.series(range(shown.length),shown.map(z=>z.re),C.yellow,1.8,true);q.series(range(shown.length),shown.map(z=>z.im),C.blue,1.8);
 const mod=shown.map(abs);lineLog(ink,L('Модуль |v̂ⁿ|: норма может расти и при |z| = 1','Magnitude |v̂ⁿ|: growth may occur even when |z| = 1'),range(shown.length),[{values:mod,color:C.yellow}],{y:457,h:92});
 const gap=abs(sub(data.roots[0],data.roots[1]));return out(ink,[['|z₊|',fmt(abs(data.roots[0]))],['|z₋|',fmt(abs(data.roots[1]))],['|z₊ − z₋|',fmt(gap)],['|v̂ⁿ|',fmt(abs(data.v[n]))]],shown.map((v,j)=>({n:j,real:v.re,imag:v.im,abs:abs(v)})),gap<1e-8?L('Кратный корень: ошибка старта создаёт полиномиальный рост.','Repeated root: startup error creates polynomial growth.'):'',gap<1e-8);
 },function(){this.time++;},100);}
function nonnormal(p,lang){const L=ll(lang),A=[p.r,p.K,0,p.s],norms=range(81,n=>K.normMat2(K.matPow2(A,n))),rho=Math.max(p.r,p.s),levels=[1,2,5,10,30],colors=[C.grid,C.dim,C.green,C.blue,C.red],cont=levels.map(v=>K.contours((x,y)=>Math.log10(K.resolventNorm(p.r,p.s,p.K,Cx(x,y))),-1.2,2.2,-1.7,1.7,60,60,Math.log10(v)));let probe=Cx(1.15,.12);const m=dynamic(function(){const n=this.count,ink=new Ink(),An=K.matPow2(A,n),R=Math.max(1.2,K.normMat2(An)*1.15);ink.title(L('Один спектр допускает совершенно разное усиление','One spectrum can hide very different amplification'),L('Изменяйте K, не меняя собственных значений r и s','Change K while keeping eigenvalues r and s fixed'));timing(ink,n);
 const g=panel(ink,L('Образ единичной окружности под Gⁿ','Image of the unit circle under Gⁿ'),{x:95,y:110,w:280,h:280,xmin:-R,xmax:R,ymin:-R,ymax:R,xlabel:'v₁',ylabel:'v₂',xticks:2,yticks:2});unit(ink,g);const ellipse=range(201,j=>{const u=Math.cos(TAU*j/200),v=Math.sin(TAU*j/200);return [g.X(An[0]*u+An[1]*v),g.Y(An[2]*u+An[3]*v)];});ink.path(ellipse,C.yellow,2.5);const a=p.angle*Math.PI/180,u=Math.cos(a),v=Math.sin(a);ink.arrow(g.X(0),g.Y(0),g.X(An[0]*u+An[1]*v),g.Y(An[2]*u+An[3]*v),C.red);
 this.zg=panel(ink,L('Контуры ‖(zI−G)⁻¹‖₂','Contours of ‖(zI−G)⁻¹‖₂'),{x:590,y:110,w:280,h:280,xmin:-1.2,xmax:2.2,ymin:-1.7,ymax:1.7,xlabel:'Re z',ylabel:'Im z',xticks:2,yticks:2});unit(ink,this.zg,C.muted);cont.forEach((cc,i)=>contourDraw(ink,this.zg,cc,colors[i],1.2));this.zg.dot(p.r,0,5,C.yellow);this.zg.dot(p.s,0,4,C.yellow);this.zg.dot(probe.re,probe.im,5,C.white);
 ink.text(585,418,L('Уровни: 1, 2, 5, 10, 30','Levels: 1, 2, 5, 10, 30'),14,C.muted);
 const q=panel(ink,L('Норма степени и спектральный радиус в степени','Power norm versus powered spectral radius'),{x:85,y:467,w:825,h:78,xmin:0,xmax:80,ymin:0,ymax:Math.max(...norms)*1.08,xlabel:'n',ylabel:'‖Gⁿ‖₂'});q.series(range(81),norms,C.yellow);q.series(range(81),range(81,j=>rho**j),C.blue);q.dot(n,norms[n],5,C.red);
 const resol=K.resolventNorm(p.r,p.s,p.K,probe),lower=abs(probe)>1?(abs(probe)-1)*resol:NaN;return out(ink,[['ρ(G)',fmt(rho)],['‖Gⁿ‖₂',fmt(norms[n])],['max₀≤ₘ≤₈₀ ‖Gᵐ‖₂',fmt(Math.max(...norms))],['(|z|−1)‖R(z)‖₂',Number.isFinite(lower)?fmt(lower):L('Выберите |z| > 1','Choose |z| > 1')]],range(81,j=>({n:j,power_norm:norms[j],spectral_power:rho**j})),L('Фиксированная матрица остаётся устойчивой; временный рост не равен неограниченному.','The fixed matrix remains power bounded; transient growth is not unbounded growth.'));
 },function(){this.time++;},80);m.click=function(x,y){if(!this.zg?.contains(x,y))return false;const [re,im]=this.zg.inverse(x,y);probe=Cx(re,im);return true;};return m;}
function sbp(p,lang){const L=ll(lang);let selected=[0,0];return {click(x,y){const cell=260/(p.N+1),i=Math.floor((y-115)/cell),j=Math.floor((x-120)/cell);if(i<0||j<0||i>p.N||j>p.N)return false;selected=[i,j];return true;},render(){const d=K.sbp(p.N,p.weight),xs=range(p.N+1,j=>j/p.N),u=xs.map(x=>.4+Math.sin(Math.PI*x)+.3*x),v=xs.map(x=>.6*Math.cos(TAU*x+p.phase*Math.PI)+.5*x),du=K.mv(d.D,u),dv=K.mv(d.D,v),terms=u.map((a,i)=>d.H[i]*(a*dv[i]+du[i]*v[i])),boundary=u.at(-1)*v.at(-1)-u[0]*v[0],ink=new Ink();ink.title(L('Интегрирование по частям — точное матричное тождество','Integration by parts as an exact matrix identity'),L('Меняется только квадратура H; оператор D остаётся тем же','Only quadrature H changes; the operator D stays fixed'));
 const cell=260/(p.N+1);const matrix=(M,x,title)=>{ink.text(x,84,title,18,C.white);M.forEach((r,i)=>r.forEach((val,j)=>{const xx=x+j*cell,yy=115+i*cell,col=val>1e-10?'#38503a':val< -1e-10?'#603f39':null;ink.rect(xx,yy,cell-1,cell-1,col,C.grid,.7);if(Math.abs(val)>1e-10)ink.text(xx+cell/2,yy+cell*.67,fmt(val,2),Math.min(17,cell*.56),Math.abs(val)>1?C.red:C.white,'center');}));};matrix(d.M,120,'HD + DᵀH');matrix(d.B,600,'B = diag(−1, 0, …, 0, 1)');
 const [i,j]=selected;ink.rect(120+j*cell,115+i*cell,cell,cell,null,C.yellow,2.5);ink.text(435,235,'=',32,d.defect<1e-12?C.green:C.red);if(d.defect>1e-12)ink.line(427,240,456,218,C.red,2.5);
 ink.text(121,402,'H₀₀ = Hᴺᴺ = '+fmt(p.weight)+'h',17,C.blue);ink.text(600,402,'(HD+DᵀH)ᵢⱼ − Bᵢⱼ = '+fmt(d.M[i][j]-d.B[i][j]),16,C.yellow);
 const lim=padded(terms),g=panel(ink,L('Слагаемые uⱼHⱼ(Dv)ⱼ + (Du)ⱼHⱼvⱼ','Terms uⱼHⱼ(Dv)ⱼ + (Du)ⱼHⱼvⱼ'),{x:100,y:460,w:780,h:70,xmin:0,xmax:p.N,ymin:-lim,ymax:lim,yticks:2,xlabel:'j',ylabel:'bⱼ'});terms.forEach((t,k)=>ink.rect(g.X(k)-8,g.Y(Math.max(0,t)),16,Math.abs(g.Y(t)-g.Y(0)),t>=0?C.blue:C.red,null));
 ink.text(100,582,'Σ bⱼ = '+fmt(sum(terms))+';    uᴺvᴺ − u₀v₀ = '+fmt(boundary),18,C.white);
 return out(ink,[[L('Крайний вес / h','Endpoint weight / h'),p.weight],[L('Невязка матрицы, max|·|','Matrix defect, max|·|'),fmt(d.defect)],[L('Сумма по сетке','Discrete sum'),fmt(sum(terms))],[L('Граничное выражение','Boundary term'),fmt(boundary)]],d.M.flatMap((r,i)=>r.map((value,j)=>({row:i,column:j,symmetric_Q:value,B:d.B[i][j],defect:value-d.B[i][j]}))));}};}
function sat(p,lang){const L=ll(lang),h=1/p.N,dt=.12*h/(1+p.sigma),xs=range(p.N+1,j=>j*h),input=t=>p.input==='pulse'&&t>=0&&t<=.3?Math.sin(Math.PI*t/.3)**2:0,initial=x=>Math.sin(Math.PI*x)*Math.exp(-(((x-.22)/.075)**2));let u=xs.map(initial),history=[{t:0,E:K.satEnergy(u,0,p.sigma,h).E}];return {count:0,time:0,stop:'',step(){if(this.time>=1.25){this.stop=L('Возмущение прошло область: t ≥ 1.25.','The perturbation crossed the domain: t ≥ 1.25.');return;}for(let l=0;l<4;l++){u=K.rk4step(u,this.time,dt,(v,t)=>K.satRhs(v,input(t),p.sigma,h));this.time+=dt;}this.count++;const E=K.satEnergy(u,input(this.time),p.sigma,h).E;history.push({t:this.time,E});if(E>1e5)this.stop=L('Энергия превысила 10⁵: остановлено без обрезания данных.','Energy exceeded 10⁵: stopped without clipping data.');},render(){const ink=new Ink(),e=K.satEnergy(u,input(this.time),p.sigma,h),truth=xs.map(x=>x>=this.time?initial(x-this.time):input(this.time-x));ink.title(L('Кто поставляет энергию: вход или ошибочное замыкание?','Who supplies energy: inflow or a faulty closure?'),L('Голубое — точный перенос; жёлтое — решение SBP–SAT','Blue: exact advection; yellow: SBP–SAT solution'));
 const m=Math.max(1.15,padded(u)),lower=Math.min(-.15,1.15*Math.min(...u,...truth)),g=panel(ink,L('Поле и входное значение','Field and inflow value'),{y:110,h:205,ymin:lower,ymax:m,ylabel:'u'});g.series(xs,truth,C.blue,2);g.series(xs,u,C.yellow,2.5);g.dot(0,input(this.time),6,C.red);
 const Emax=Math.max(.05,...history.map(v=>v.E))*1.12,eg=panel(ink,L('Энергия E = uᵀHu/2','Energy E = uᵀHu/2'),{x:90,y:431,w:420,h:100,xmin:0,xmax:Math.max(.2,this.time),ymin:0,ymax:Emax,ylabel:'E',xlabel:'t',yticks:2});eg.series(history.map(v=>v.t),history.map(v=>v.E),C.yellow,2.5);
 const terms=[e.out,e.closure,e.inflow],lim=Math.max(.02,padded(terms)),bg=panel(ink,L('Три вклада в Ė','Three contributions to Ė'),{x:630,y:431,w:270,h:100,xmin:0,xmax:3,ymin:-lim,ymax:lim,xticks:0,yticks:2,xlabel:'',ylabel:'Ė'});terms.forEach((v,j)=>{ink.rect(bg.X(j+.22),bg.Y(Math.max(0,v)),bg.w/3*.55,Math.abs(bg.Y(v)-bg.Y(0)),v>0?C.red:C.blue,null);ink.text(bg.X(j+.5),561,[L('Выход','Outflow'),L('Штраф','Closure'),L('Вход','Inflow')][j],14,C.muted,'center');});
 return out(ink,[['t',fmt(this.time)],['E',fmt(e.E)],['dE/dt',fmt(e.dot)],[L('Невязка энерготождества','Energy identity residual'),fmt(e.residual)]],xs.map((x,i)=>({x,u:u[i],exact:truth[i],time:this.time})),p.sigma<.5&&p.input==='zero'?L('σ < 1/2: однородная граница может создавать энергию.','σ < 1/2: a homogeneous boundary can create energy.'):L('Рост при ненулевом входе нужно сравнивать с энергией, внесённой входными данными.','With nonzero inflow, compare growth with the energy supplied by the input.'),p.sigma<.5);}};}
function boundary(p,lang){const L=ll(lang),N=48,mode=K.boundaryMode(p.co,p.b),eps=10**p.logeps;let u=range(N+1,j=>eps*(mode.localized?mode.kappa**j:Math.exp(-j/3))),history=[K.normInf(u)];return {count:0,time:0,stop:'',step(){if(this.count>=100){this.stop=L('100 шагов.','100 steps.');return;}u=K.boundaryStep(u,p.co,p.b);this.count++;this.time=this.count*p.co/N;history.push(K.normInf(u));},render(){const n=this.count,ink=new Ink();ink.title(L('Устойчивая внутренняя схема не защищает от плохой границы','A stable interior scheme cannot protect against a bad boundary'),L('Внутри Co ≤ 1; меняется только v₀ⁿ⁺¹ = b v₀ⁿ','Interior Co ≤ 1; only v₀ⁿ⁺¹ = b v₀ⁿ changes'));timing(ink,n);
 const m=Math.max(eps*1.2,1.15*maxabs(u)),lower=Math.min(-.1*m,1.15*Math.min(...u)),g=panel(ink,L('Возмущение у входной границы','Perturbation near the inflow boundary'),{x:80,y:118,w:540,h:240,xmin:0,xmax:48,ymin:lower,ymax:m,xlabel:'j',ylabel:'vⱼ'});g.series(range(N+1),u,C.yellow,2.5,true);if(mode.localized)g.series(range(N+1),range(N+1,j=>eps*p.b**n*mode.kappa**j),C.blue,1.5);
 const zg=panel(ink,L('Временной множитель z = b','Temporal factor z = b'),{x:715,y:130,w:170,h:170,xmin:-1.4,xmax:1.4,ymin:-1.4,ymax:1.4,xlabel:'Re',ylabel:'Im',xticks:2,yticks:2});unit(ink,zg);zg.dot(p.b,0,7,p.b>1?C.red:C.green);
 ink.text(700,357,'κ = '+fmt(mode.kappa),18,C.yellow);ink.text(700,387,mode.localized?'|κ| < 1':'|κ| ≥ 1',17,C.muted);
 lineLog(ink,L('Норма возмущения во времени','Perturbation norm over time'),range(history.length),[{values:history,color:C.yellow}],{y:455,h:92});
 return out(ink,[[L('Внутреннее Co','Interior Co'),p.co],['z',p.b],['κ',fmt(mode.kappa)],[L('‖vⁿ‖∞ / ε','‖vⁿ‖∞ / ε'),fmt(K.normInf(u)/eps)]],u.map((value,j)=>({j,value,n,kappa:mode.kappa,z:p.b})),mode.localized?L('Точная локализованная мода ε bⁿ κʲ: b > 1 даёт рост, b < 1 — затухание по времени.','Exact localized mode ε bⁿ κʲ: b > 1 grows in time; b < 1 decays.'):L('Локализованной моды этого вида нет; показано развитие локального начального возмущения.','This localized mode is unavailable; a local initial perturbation is evolved instead.'),p.b>1);}};}
function modified(p,lang){const L=ll(lang);return dynamic(function(){const ink=new Ink(),n=this.count,t=p.theta*Math.PI,r=K.modifiedRate(p.w,p.co,t),thetas=range(401,j=>j/400*Math.PI),rates=thetas.map(t=>K.modifiedRate(p.w,p.co,t));ink.title(L('Полный символ против первого дифференциального приближения','The full symbol versus the first modified equation'),L('Сравниваются скорости изменения амплитуды, не просто два похожих профиля','Compare rates of amplitude change, not merely two similar profiles'));timing(ink,n);
 const lo=Math.max(-5,Math.min(-.05,...rates.map(v=>v.exact).filter(Number.isFinite),...rates.map(v=>v.approx))),hi=Math.max(.05,...rates.map(v=>v.exact).filter(Number.isFinite),...rates.map(v=>v.approx)),g=panel(ink,L('Логарифм множителя за один шаг','Logarithm of the one-step multiplier'),{x:90,y:118,w:820,h:240,xmin:0,xmax:1,ymin:lo,ymax:hi*1.1,xlabel:'kh/π',ylabel:'log |G|'});g.series(thetas.map(v=>v/Math.PI),rates.map(v=>v.exact),C.yellow,2.6);g.series(thetas.map(v=>v/Math.PI),rates.map(v=>v.approx),C.blue,2);g.dot(p.theta,r.exact,6,C.yellow);g.dot(p.theta,r.approx,5,C.blue);
 legend(ink,[[L('Полный символ','Full symbol'),C.yellow],[L('Первое приближение','First approximation'),C.blue]],394,100,430);
 const ns=range(n+1),exact=ns.map(j=>j===0?1:Math.exp(Math.min(690,j*r.exact))),ap=ns.map(j=>Math.exp(Math.min(690,j*r.approx)));lineLog(ink,L('Накопленное изменение выбранной гармоники','Accumulated change of selected harmonic'),ns,[{values:exact,color:C.yellow},{values:ap,color:C.blue}],{y:463,h:85});
 return out(ink,[['μₙᵤₘ / h',fmt((1-2*p.w-p.co)/2)],['log |G|',fmt(r.exact)],['−μk²τ',fmt(r.approx)],[L('Разность скоростей','Rate difference'),fmt(Math.abs(r.exact-r.approx))]],rates.map((r,i)=>({kh:thetas[i],log_abs_G:r.exact,modified_prediction:r.approx})),!Number.isFinite(r.exact)?L('G = 0: мода полностью погашена за один шаг; log|G| = −∞.','G = 0: the mode is annihilated in one step; log|G| = −∞.'):L('При kh ≈ π разложение по малому kh количественно ненадёжно.','Near kh ≈ π, a small-kh expansion is not quantitatively reliable.'));
 },function(){this.time++;},90);}
function packet(p,lang){const L=ll(lang);return dynamic(function(){const n=this.count,d=K.packet(p.co,p.k0,p.width,n),ink=new Ink();ink.title(L('Гребни и огибающая измеряют разные скорости','Crests and envelope measure different velocities'),L('Белое: точная огибающая PDE · жёлтое: численная · голубое: несущая','White: exact PDE envelope · yellow: numerical · blue: carrier'));timing(ink,n);
 const g=panel(ink,L('Пакет без диссипации','A packet with no dissipation'),{x:80,y:112,w:840,h:232,ymin:-1.05,ymax:1.12,ylabel:'u, |ψ|'});g.series(d.xs,d.exactEnv,C.white,1.8);g.series(d.xs,d.u,C.blue,1.5);g.series(d.xs,d.env,C.yellow,2.8);
 const ph=panel(ink,L('Фазовая и групповая скорости','Phase and group velocities'),{x:85,y:453,w:825,h:95,xmin:0,xmax:1,ymin:-1.3,ymax:1.3,xlabel:'kh/π',ylabel:'v / a',yticks:2});ph.curve(x=>K.dispersion(p.co,x*Math.PI).vp,C.blue,2);ph.curve(x=>K.dispersion(p.co,x*Math.PI).vg,C.yellow,2.5);ph.dot(2*p.k0/128,d.vp,5,C.blue);ph.dot(2*p.k0/128,d.vg,5,C.yellow);
 ink.text(85,386,L('На выбранной ветви высокочастотная огибающая может двигаться в обратную сторону.','On the selected branch, the high-frequency envelope can move backwards.'),16,C.muted);
 return out(ink,[['t',fmt(d.time)],['k₀h / π',fmt(2*p.k0/128)],['vₚ / a',fmt(d.vp)],['v𝗀 / a',fmt(d.vg)]],d.xs.map((x,i)=>({x,n,time:d.time,numerical:d.u[i],envelope:d.env[i],exact:d.exact[i],exact_envelope:d.exactEnv[i]})),L('Выбрана одна спектральная ветвь; паразитная мода не подмешана в старт.','One spectral branch is selected; startup contains no computational mode.'));
 },function(){this.time=(this.count+1)*p.co/128;},100);}
function runge(p,lang){const L=ll(lang),rows=K.rungeStudy(p.base,p.path,.05,p.bias);return {render(){const ink=new Ink(),trip=K.rungeTriplet(rows,p.triplet,p.p),reveal=p.reveal==='show';ink.title(L('Три сетки видят различия, но не общую систематическую ошибку','Three grids see differences, not a common systematic error'),L('Одинаковые T = 0.05 и точка x = 1/2; числа получены из дискретной схемы','Same T = 0.05 and point x = 1/2; values come from the discrete scheme'));
 const xx=rows.map(r=>Math.log2(r.N)),ymin=Math.min(...rows.map(r=>r.value),...(reveal?[rows[0].truth,trip.estimate]:[trip.estimate]))-.003,ymax=Math.max(...rows.map(r=>r.value))+.003,g=panel(ink,L('Наблюдаемый функционал J','Observed functional J'),{x:95,y:120,w:370,h:250,xmin:xx[0],xmax:xx.at(-1),ymin,ymax,xlabel:'log₂ N',ylabel:'J'});g.series(xx,rows.map(r=>r.value),C.blue,2.5,true);for(let j=p.triplet;j<p.triplet+3;j++)g.dot(xx[j],rows[j].value,6,C.yellow);g.dot(xx[p.triplet+2],trip.estimate,6,C.red);if(reveal)g.curve(()=>rows[0].truth,C.white,1.8,2,true);
 const delta=rows.slice(1).map((r,j)=>Math.abs(r.value-rows[j].value)),xx2=xx.slice(1),all=logs([...delta,...(reveal?rows.map(r=>r.error):[])]).filter(Number.isFinite),q=panel(ink,reveal?L('Разность сеток и истинная ошибка','Grid difference and actual error'):L('Разности соседних сеток','Differences between adjacent grids'),{x:590,y:120,w:315,h:250,xmin:xx[0],xmax:xx.at(-1),ymin:Math.min(...all)-.15,ymax:Math.max(...all)+.15,xlabel:'log₂ N',ylabel:'log₁₀'});q.series(xx2,logs(delta),C.blue,2.5,true);if(reveal)q.series(xx,logs(rows.map(r=>r.error)),C.red,2.5,true);
 ink.text(95,422,L('N              τ                  J(N)               разность с предыдущим','N              τ                  J(N)               difference from previous'),15,C.muted);
 rows.forEach((r,j)=>{const yy=450+j*23;ink.text(95,yy,r.N,16,C.white);ink.text(210,yy,fmt(r.dt),16,C.muted);ink.text(375,yy,r.value.toFixed(9),16,j>=p.triplet&&j<p.triplet+3?C.yellow:C.white);ink.text(650,yy,j?fmt(Math.abs(r.value-rows[j-1].value)):'—',16,C.blue);});
 return out(ink,[[L('Наблюдаемый порядок p','Observed order p'),fmt(trip.p)],['Jᴿ (p='+p.p+')',fmt(trip.estimate)],[L('Оценка ошибки Рунге','Runge error estimate'),fmt(trip.errorEstimate)],[L('Истинная ошибка мелкой сетки','Actual fine-grid error'),reveal?fmt(trip.actual):L('скрыта','hidden')]],rows.map(r=>reveal?r:(({truth,error,...visible})=>visible)(r)),p.bias?L('Общая добавка η сокращается во всех сеточных разностях.','The common bias η cancels in every grid difference.'):L('Сдвигайте тройку сеток; порядок должен стабилизироваться, а не просто однажды совпасть.','Shift the grid triplet: the observed order should stabilize, not merely match once.'),Boolean(p.bias));}};}
function mms(p,lang){const L=ll(lang),rich=p.rich==='rich',all=[25,50,100,200,400].map(N=>K.mmsSolve(N,p.co,.6,rich,p.bug)),d=all.find(v=>v.N===p.N);return {render(){const ink=new Ink();ink.title(L('Искусственное решение проверяет реальный программный путь','A manufactured solution tests the real code path'),rich?'uᵐˢ = exp(−t)[1 + 0.2x + sin(2πx)]':'uᵐˢ = exp(−t)sin(2πx)');
 const m=padded([...d.u,...d.exact]),g=panel(ink,L('Результат и заданное искусственное решение','Computed and manufactured solutions'),{x:80,y:118,w:460,h:235,ymin:-m,ymax:m,xlabel:'x',ylabel:'u'});g.series(d.xs,d.exact,C.white,2);g.series(d.xs,d.u,C.yellow,2.5);g.dot(0,d.u[0],6,C.red);
 const xx=all.map(v=>Math.log2(v.N)),vals=logs(all.flatMap(v=>[v.L1,v.L2,v.Linf])).filter(Number.isFinite),q=panel(ink,L('Измеренный порядок','Measured convergence order'),{x:660,y:118,w:260,h:235,xmin:xx[0],xmax:xx.at(-1),ymin:Math.min(...vals)-.1,ymax:Math.max(...vals)+.1,xlabel:'log₂ N',ylabel:'log₁₀ E'});q.series(xx,logs(all.map(v=>v.L1)),C.green,2,true);q.series(xx,logs(all.map(v=>v.L2)),C.blue,2.4,true);q.series(xx,logs(all.map(v=>v.Linf)),C.red,2,true);
 const coords=[90,235,420,615,790];[L('Сетка N','Grid N'),'L₁','L₂','L∞',L('p по L₂','p from L₂')].forEach((s,j)=>ink.text(coords[j],423,s,16,C.muted));all.forEach((r,j)=>{const order=j?Math.log2(all[j-1].L2/r.L2):NaN;[r.N,fmt(r.L1),fmt(r.L2),fmt(r.Linf),j?fmt(order):'—'].forEach((s,k)=>ink.text(coords[k],451+j*26,s,17,k===4?C.yellow:C.white));});
 const last=all.at(-1),order=Math.log2(all.at(-2).L2/last.L2),blind=p.bug==='boundary'&&!rich;const result=out(ink,[[L('Число узлов','Node count'),p.N+1],['L₂ (N='+p.N+')',fmt(d.L2)],[L('p на последних сетках','p on finest levels'),fmt(order)],[L('Ожидаемый порядок','Expected order'),'1']],all.map((r,j)=>({N:r.N,h:r.h,steps:r.steps,L1:r.L1,L2:r.L2,Linf:r.Linf,p_observed:j?Math.log2(all[j-1].L2/r.L2):''})),blind?L('Ошибка есть, но g(t) ≡ 0: тест не возбуждает дефект границы.','The bug is present, but g(t) ≡ 0: this test does not exercise the boundary defect.'):L('Проверьте все нормы. MMS не является валидацией физической модели.','Check all norms. MMS does not validate the physical model.'),blind);
 result.equation=rich?'uₜ + uₓ = fᵐˢ; uᵐˢ = e⁻ᵗψ(x); ψ = 1 + 0.2x + sin(2πx); fᵐˢ = e⁻ᵗ(ψ′ − ψ)':null;return result;
 }};}
function createLabBase(id,p,lang='ru'){
 const fn={'error-budget':errorBudget,consistency,accumulation,fourier,godograph,mol,roots,nonnormal,sbp,sat,boundary,modified,packet,runge,mms}[id];if(!fn)throw Error('Unknown laboratory: '+id);const model=fn(p,lang);
 if(id==='godograph')model.click=function(x,y){if(!this.zg?.contains(x,y))return false;let best=Infinity,theta=0;for(let j=0;j<=400;j++){const a=K.gain(p.scheme,p.c,j/400*Math.PI),dist=(this.zg.X(a.re)-x)**2+(this.zg.Y(a.im)-y)**2;if(dist<best){best=dist;theta=j/400;}}p.theta=Math.round(theta*100)/100;return true;};
 return model;
}


function lecture4AnimationValue(id, params, frame) {
  if (id === 'error-budget') {
    const target = Math.max(1, Math.round(Number(params.iterations) || 1));
    return Math.round(target * ((frame % 48) / 47));
  }
  if (id === 'consistency') {
    const base = Number(params["co"]) || 0.5;
    return base * (0.15 + 0.85 * (0.5 + 0.5 * Math.sin(frame * Math.PI / 32)));
  }
  if (id === 'sbp') {
    const base = Number(params.weight) || 0.5;
    const amplitude = Math.min(0.25, Math.max(0.05, Math.abs(base) * 0.5));
    return Math.max(0.05, Math.min(0.95, base + amplitude * Math.sin(frame * Math.PI / 16)));
  }
  if (id === 'runge') return Math.floor(frame / 8) % 4;
  if (id === 'mms') {
    const levels = [25, 50, 100, 200, 400];
    const start = Math.max(0, levels.indexOf(Number(params.N)));
    return levels[(start + Math.floor(frame / 12)) % levels.length];
  }
  return undefined;
}

function createLab(id,p,lang='ru') {
  const original = createLabBase(id,p,lang);
  const fields = {
    'error-budget': 'iterations',
    consistency: "co",
    sbp: 'weight',
    runge: 'triplet',
    mms: 'N'
  };
  const field = fields[id];
  if (!field || !original || typeof original.render !== 'function') return original;

  const params = Object.assign({}, p);
  let frame = 0;
  let current;
  const rebuild = () => {
    const animatedParams = Object.assign({}, params);
    animatedParams[field] = lecture4AnimationValue(id, params, frame);
    current = createLabBase(id, animatedParams, lang);
  };
  rebuild();

  const animated = Object.assign({}, original, {
    count: frame,
    time: 0,
    stop: '',
    step() {
      frame += 1;
      this.count = frame;
      rebuild();
    },
    render(...args) {
      return current.render(...args);
    }
  });
  if (typeof original.click === 'function') {
    animated.click = (...args) => current.click?.(...args) ?? false;
  }
  return animated;
}

return {createLab};
})();
export default moduleValue;
