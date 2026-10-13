const moduleValue = (() => {
/** Lecture 6: ideal-gas Euler fluxes. The labels specify the implemented
 * variants; a numerical flux is compared inside the same first-order method. */
const R = (key,ru,en,value,min,max,step=1) => ({key,label:[ru,en],type:'range',value,min,max,step});
const O = (value,ru,en=ru) => ({value,label:[ru,en]});
const S = (key,ru,en,value,options) => ({key,label:[ru,en],type:'select',value,options});
const P = (ru,en,values) => ({label:[ru,en],values});

const groups = [
  ['Задача на грани','At an interface'],
  ['Ударная волна и контакт','Shock and contact'],
  ['Энтропия и положительность','Entropy and positivity'],
  ['Расщепление потоков','Flux splitting'],
  ['Трудные режимы','Difficult regimes'],
  ['Общее сравнение','Compare the methods']
];

const sources = {
  roe:{label:'Roe (1981): Approximate Riemann solvers, parameter vectors, and difference schemes',url:'https://doi.org/10.1016/0021-9991(81)90128-5'},
  harten:{label:'Harten (1983): High resolution schemes for hyperbolic conservation laws',url:'https://doi.org/10.1016/0021-9991(83)90136-5'},
  hll:{label:'Harten, Lax & van Leer (1983): On upstream differencing and Godunov-type schemes',url:'https://doi.org/10.1137/1025002'},
  davis:{label:'Davis (1988): Simplified second-order Godunov-type methods',url:'https://doi.org/10.1137/0909030'},
  einfeldt:{label:'Einfeldt (1988): On Godunov-type methods for gas dynamics',url:'https://doi.org/10.1137/0725021'},
  positivity:{label:'Einfeldt, Munz, Roe & Sjögreen (1991): On Godunov-type methods near low densities',url:'https://doi.org/10.1016/0021-9991(91)90211-3'},
  hllc:{label:'Toro, Spruce & Speares (1994): Restoration of the contact surface in the HLL-Riemann solver',url:'https://doi.org/10.1007/BF01414629'},
  vanleer:{label:'van Leer (1982): Flux-vector splitting for the Euler equations',url:'https://doi.org/10.1007/3-540-11948-5_66'},
  steger:{label:'Steger & Warming (1981): Flux vector splitting of the inviscid gasdynamic equations',url:'https://doi.org/10.1016/0021-9991(81)90210-2'},
  ausm:{label:'Liou & Steffen (1993): A new flux splitting scheme',url:'https://doi.org/10.1006/jcph.1993.1122'},
  ausmTM:{label:'Liou & Steffen (1991): Original AUSM, full NASA technical memorandum',url:'https://ntrs.nasa.gov/citations/19910013501'},
  ausmup:{label:'Liou (2006): A sequel to AUSM, Part II: AUSM+-up for all speeds',url:'https://doi.org/10.1016/j.jcp.2005.09.020'},
  su2:{label:'SU2: implemented original AUSM and AUSM+up fluxes',url:'https://github.com/su2code/SU2/blob/master/SU2_CFD/src/numerics/flow/convection/ausm_slau.cpp'},
  euler:{label:'Clawpack Riemann book: Euler, Roe and HLLE solvers',url:'https://www.clawpack.org/riemann_book/html/Euler_approximate.html'},
  sod:{label:'Sod (1978): A survey of several finite difference methods for systems of nonlinear hyperbolic conservation laws',url:'https://doi.org/10.1016/0021-9991(78)90023-2'},
  shuosher:{label:'NASA High-Fidelity CFD Workshop: Shu–Osher shock–entropy wave test',url:'https://turbmodels.larc.nasa.gov/Highfidelitycfd2021/UnsteadySupHypersonic_Shu-Osher_HFW_2021.pdf'},
  quirk:{label:'Quirk (1992/1994): A contribution to the great Riemann solver debate',url:'https://ntrs.nasa.gov/citations/19930015894'},
  thinshock:{label:'Simon & Mandal (2018): HLLC shock instability and a stationary thin-shock test',url:'https://arxiv.org/abs/1803.04954'}
};

const methods = [
  O('roe','Roe'),
  O('roe-entropy','Roe + поправка энтропии','Roe + entropy fix'),
  O('hll','HLL–Davis'),
  O('hllc','HLLC'),
  O('hlle','HLLE–Einfeldt'),
  O('vanleer','van Leer FVS'),
  O('steger-warming','Steger–Warming FVS'),
  O('ausm','AUSM (1993)'),
  O('ausm-up','AUSM+up (2006)')
];
const variables = [
  O('rho','Плотность ρ','Density ρ'), O('u','Скорость u','Velocity u'),
  O('p','Давление p','Pressure p'), O('entropy','Энтропия ln(p/ρᵞ)','Entropy ln(p/ρᵞ)'),
  O('mach','Число Маха u/a','Mach number u/a')
];
const cases = [
  O('sod','Труба Сода','Sod tube'),
  O('contact','Неподвижный контакт','Stationary contact'),
  O('moving-contact','Движущийся контакт','Moving contact'),
  O('transonic','Трансзвуковое разрежение','Transonic rarefaction'),
  O('double-rarefaction','Два разрежения','Double rarefaction'),
  O('shu-osher','Шу — Ошер','Shu–Osher'),
  O('strong-shock','Сильный перепад давления','Strong pressure jump'),
  O('low-mach','Медленный перенос энтропии','Slow entropy advection')
];
const pairControls = (a='roe',b='hlle',mode='pair') => [
  S('methodA','Метод A','Method A',a,methods),
  S('methodB','Метод B','Method B',b,methods),
  S('mode','Показывать','Show',mode,[O('pair','Два метода','Two methods'),O('all','Все девять','All nine')]),
  S('N','Число ячеек N','Number of cells N',200,[100,200,400].map(n=>O(n,String(n)))),
  R('cfl','Число CFL','CFL number',.35,.05,.6,.05),
  S('variable','Величина на графике','Plot variable','rho',variables),
  R('entropyFix','Roe: ε в δ = εã','Roe: ε in δ = εã',.1,0,.5,.01),
  S('lowMachCutoff','AUSM+up: опорное M','AUSM+up: reference M',1,[1,.3,.1,.03,.01].map(n=>O(n,String(n))))
];
const stateControls = (left={rho:1,u:0,p:1},right={rho:.125,u:0,p:.1}) => [
  R('rhoL','Слева: плотность ρL','Left: density ρL',left.rho,.05,5,.025),
  R('uL','Слева: скорость uL','Left: velocity uL',left.u,-4,4,.05),
  R('pL','Слева: давление pL','Left: pressure pL',left.p,.01,10,.01),
  R('rhoR','Справа: плотность ρR','Right: density ρR',right.rho,.05,5,.025),
  R('uR','Справа: скорость uR','Right: velocity uR',right.u,-4,4,.05),
  R('pR','Справа: давление pR','Right: pressure pR',right.p,.01,10,.01)
];
const pairPresets = [
  P('Контакт: Roe и HLLE','Contact: Roe and HLLE',{methodA:'roe',methodB:'hlle',mode:'pair'}),
  P('HLL и HLLC','HLL and HLLC',{methodA:'hll',methodB:'hllc',mode:'pair'}),
  P('AUSM и AUSM+up','AUSM and AUSM+up',{methodA:'ausm',methodB:'ausm-up',mode:'pair'}),
  P('Все девять потоков','All nine fluxes',{mode:'all'})
];
const fvEquation = {tex:String.raw`\bar U_i^{n+1}=\bar U_i^n-\frac{\Delta t}{\Delta x}(F_{i+1/2}-F_{i-1/2}),\qquad \gamma=1.4`};
const strictCaveat = [
  'Одинаковые сетка, начальные данные и физическое время; кусочно-постоянные состояния и явный Эйлер. При ρ ≤ 0 или p ≤ 0 расчёт останавливается: скрытого обрезания и замены потока нет.',
  'Same grid, initial data and physical time; piecewise-constant states and forward Euler. A run stops at ρ ≤ 0 or p ≤ 0: there is no hidden clipping or flux substitution.'
];

const demos = [
{
  id:'wave-models',group:0,title:['Какие волны оставляет решатель?','Which waves does a solver retain?'],
  short:['Две волны или три: локальные модели задачи Римана.','Two waves or three: local models of the Riemann problem.'],
  equation:{tex:String.raw`\lambda_1=u-a,\qquad \lambda_2=u,\qquad \lambda_3=u+a,\qquad a=\sqrt{\gamma p/\rho}`},
  controls:[S('caseId','Начальные состояния','Initial states','sod',[cases[0],cases[1],cases[3]]),S('method','Приближённый решатель','Approximate solver','hll',methods.filter(m=>['roe','hll','hllc','hlle'].includes(m.value))),R('tau','Время среза t','Slice time t',.2,.02,.25,.01)],
  presets:[P('HLL: один промежуточный слой','HLL: one middle state',{method:'hll',caseId:'sod'}),P('HLLC: вернуть контакт','HLLC: restore the contact',{method:'hllc',caseId:'sod'}),P('Изолированный контакт','Isolated contact',{caseId:'contact',method:'hllc'}),P('Roe и веер разрежения','Roe and a rarefaction fan',{caseId:'transonic',method:'roe'})],
  question:['Найдите контакт: на нём меняется плотность, но непрерывны давление и скорость. Что происходит с этой волной в HLL?','Find the contact: density changes while pressure and velocity remain continuous. What happens to this wave in HLL?'],
  explanation:['HLL оставляет две крайние скорости и одно среднее состояние между ними. HLLC вводит внутреннюю контактную волну. Roe раскладывает скачок по собственным векторам усреднённой матрицы; разрежение при этом представлено скачком в линейной модели.','HLL retains two outer speeds and one averaged middle state. HLLC adds an internal contact wave. Roe decomposes the jump into eigenvectors of an averaged matrix; a rarefaction is represented by a jump in this local linear model.'],
  caveat:['Показана одна локальная задача Римана, а не весь конечно-объёмный расчёт. Скорости приближённого веера и ошибки накопленной эволюции — разные вещи.','This is one local Riemann problem, not a complete finite-volume computation. Approximate fan speeds and accumulated evolution errors are different quantities.'],
  sources:['roe','hll','hllc','euler'],dynamic:false
},
{
  id:'interface-flux',group:0,title:['Девять потоков на одной грани','Nine fluxes at one interface'],
  short:['Одни состояния слева и справа — разные переносы массы, импульса и энергии.','One pair of states, different mass, momentum and energy transfers.'],
  equation:{tex:String.raw`F(U_L,U_R)=\begin{pmatrix}F_\rho\\F_{\rho u}\\F_E\end{pmatrix},\qquad F(U,U)=f(U)`},
  controls:[...stateControls(),R('entropyFix','Roe: ε в δ = εã','Roe: ε in δ = εã',.1,0,.5,.01),S('lowMachCutoff','AUSM+up: опорное M','AUSM+up: reference M',1,[1,.1,.01].map(n=>O(n,String(n))))],
  presets:[P('Грань в трубе Сода','Sod interface',{rhoL:1,uL:0,pL:1,rhoR:.125,uR:0,pR:.1}),P('Неподвижный контакт','Stationary contact',{rhoL:1,uL:0,pL:1,rhoR:.125,uR:0,pR:1}),P('Равные состояния','Equal states',{rhoL:1,uL:.5,pL:1,rhoR:1,uR:.5,pR:1}),P('Движущийся контакт','Moving contact',{rhoL:1,uL:.5,pL:1,rhoR:.125,uR:.5,pR:1})],
  question:['Сначала сделайте оба состояния одинаковыми. Затем оставьте u = 0 и равное давление, изменив только плотность. Какие методы сохраняют нулевой поток массы?','First make both states equal. Then keep u = 0 and equal pressure, changing only density. Which methods preserve zero mass flux?'],
  explanation:['При равных состояниях проверяется согласованность F(U,U)=f(U). На неподвижном контакте физический поток равен (0,p,0). Ненулевой поток массы показывает численную диффузию контакта ещё до первого шага по времени.','Equal states test consistency, F(U,U)=f(U). At a stationary contact the physical flux is (0,p,0). Nonzero mass flux exposes contact diffusion before the first time step.'],
  caveat:['Здесь нет сетки и эволюции. Roe с поправкой означает квадратичное сглаживание Хартена только акустических собственных значений, δ = εã. У AUSM+up явно задаётся опорное число Маха.','There is no grid or time evolution here. Modified Roe means Harten quadratic smoothing of acoustic eigenvalues only, δ = εã. The AUSM+up reference Mach number is explicit.'],
  sources:['roe','harten','vanleer','steger','ausm','ausmup','su2'],dynamic:false
},
{
  id:'sod',group:1,title:['Труба Сода: найти три волны','Sod tube: find all three waves'],
  short:['Разрежение, контакт, ударная волна — и точный эталон.','Rarefaction, contact, shock, and an exact reference.'],
  equation:{tex:String.raw`(\rho,u,p)_L=(1,0,1),\qquad(\rho,u,p)_R=(0.125,0,0.1)`},
  controls:pairControls('hll','hllc'),presets:pairPresets,
  question:['Сравните плотность и давление. Почему дополнительный размазанный скачок заметен на плотности, но не на давлении?','Compare density and pressure. Why is an extra smeared jump visible in density but absent from pressure?'],
  explanation:['Контакт переносит скачок плотности при непрерывных u и p. Поэтому одной кривой давления недостаточно, чтобы оценить его разрешение. Сопоставляйте участки разрежения, контакта и ударной волны отдельно; ошибка всего профиля смешивает эти три эффекта.','A contact carries a density jump while u and p remain continuous. A pressure curve alone cannot measure its resolution. Compare the rarefaction, contact and shock regions separately; a whole-profile error combines all three effects.'],
  caveat:strictCaveat,sources:['sod','hll','hllc','euler'],dynamic:true,action:['Запустить трубу','Run the tube'],thumbSteps:8
},
{
  id:'contact',group:1,title:['Контакт: стоять или двигаться','A contact at rest and in motion'],
  short:['Численная диффузия без ударной волны.','Numerical diffusion without a shock wave.'],
  equation:{tex:String.raw`p_L=p_R,\qquad u_L=u_R=u_0,\qquad \rho(x,t)=\rho(x-u_0t,0)`},
  controls:[S('caseId','Движение контакта','Contact motion','contact',[cases[1],cases[2]]),...pairControls('roe','vanleer')],
  presets:[P('Неподвижный: Roe и van Leer','At rest: Roe and van Leer',{caseId:'contact',methodA:'roe',methodB:'vanleer',variable:'rho',mode:'pair'}),P('Неподвижный: HLL и HLLC','At rest: HLL and HLLC',{caseId:'contact',methodA:'hll',methodB:'hllc',variable:'rho',mode:'pair'}),P('Движение: AUSM и AUSM+up','Moving: AUSM and AUSM+up',{caseId:'moving-contact',methodA:'ausm',methodB:'ausm-up',variable:'p',mode:'pair'}),P('Все методы на контакте','All methods on a contact',{mode:'all',variable:'rho'})],
  question:['Запустите неподвижный контакт. Откуда появляется движение плотности? Затем включите перенос и проверьте, остаётся ли давление постоянным.','Run the stationary contact. Why does its density profile change? Then enable advection and check whether pressure stays uniform.'],
  explanation:['У Roe, HLLC и AUSM-семейства неподвижный изолированный контакт может сохраняться точно. HLL(E) и классические FVS добавляют диффузию. При движении появляется ошибка переноса; исходный AUSM с разными aL и aR также отличается от вариантов с общей скоростью звука на грани.','Roe, HLLC and the AUSM family can exactly preserve an isolated stationary contact. HLL(E) and classical FVS add diffusion. Motion introduces advection error; original AUSM with separate aL and aR also differs from variants using a shared interface sound speed.'],
  caveat:['Точное разрешение контакта в локальном потоке не означает точного переноса по сетке при произвольном CFL. '+strictCaveat[0],'Exact contact resolution by a local flux does not imply exact grid advection at arbitrary CFL. '+strictCaveat[1]],
  sources:['roe','hllc','vanleer','ausmTM','ausmup'],dynamic:true,action:['Переносить контакт','Advect contact'],thumbSteps:8
},
{
  id:'transonic',group:2,title:['Roe: разрежение через звуковую точку','Roe: a rarefaction through the sonic point'],
  short:['Почему сохранения скачка недостаточно для физического решения.','Why conserving a jump is not enough to select a physical solution.'],
  equation:{tex:String.raw`\psi_\delta(\lambda)=\begin{cases}|\lambda|,&|\lambda|\ge\delta\\(\lambda^2+\delta^2)/(2\delta),&|\lambda|<\delta\end{cases}`},
  controls:pairControls('roe','roe-entropy'),
  presets:[P('Roe без поправки и с ней','Roe with and without the fix',{methodA:'roe',methodB:'roe-entropy',entropyFix:.1,mode:'pair'}),P('Выключить поправку','Disable the fix',{methodA:'roe',methodB:'roe-entropy',entropyFix:0,mode:'pair'}),P('Увеличить сглаживание','Increase smoothing',{methodA:'roe',methodB:'roe-entropy',entropyFix:.3,mode:'pair'}),P('Сравнить с HLLE','Compare with HLLE',{methodA:'roe-entropy',methodB:'hlle',mode:'pair'})],
  question:['Найдите место, где u−a меняет знак. Уменьшите ε до нуля: какой дефект остаётся внутри физического веера разрежения?','Locate the sign change of u−a. Reduce ε to zero: which defect remains inside the physical rarefaction fan?'],
  explanation:['Roe заменяет нелинейный веер одной линейной волной. У звуковой точки её диссипация может исчезнуть и оставить нефизический скачок разрежения. Здесь поправка Хартена сглаживает |λ| при |λ|<δ, где δ=εã; контактное собственное значение не изменяется.','Roe replaces the nonlinear fan with a single linear wave. Near a sonic point its dissipation may vanish and leave an unphysical expansion jump. Here Harten’s fix smooths |λ| for |λ|<δ, with δ=εã; the contact eigenvalue is unchanged.'],
  caveat:['Данные получены обращением сторон стационарного удара M = 1.5: F_L = F_R, но скачок нарушает условие энтропии. Поправка здесь квадратичная, по Хартену, не полный алгоритм Хартена — Хаймана. Она не гарантирует положительность и не устраняет все двумерные ударные неустойчивости.','The data reverse the sides of a stationary M = 1.5 shock: F_L = F_R, but the jump violates the entropy condition. The fix here is Harten quadratic smoothing, not the full Harten–Hyman procedure. It does not guarantee positivity or remove every two-dimensional shock instability.'],
  sources:['roe','harten','euler'],dynamic:true,action:['Развивать разрежение','Evolve rarefaction'],thumbSteps:8
},
{
  id:'double-rarefaction',group:2,title:['Два разрежения: давление почти исчезло','Double rarefaction: pressure nearly vanishes'],
  short:['Проверка положительности там, где обычной трубы Сода мало.','Test positivity beyond the ordinary Sod tube.'],
  equation:{tex:String.raw`(\rho,u,p)_{L,R}=(1,\mp2,0.4),\qquad p_*\approx0.00189387,\quad \rho_*\approx0.0218521`},
  // Density is uniform at t = 0; pressure is what nearly vanishes, so it is plotted first.
  controls:pairControls('roe','hlle').map(c=>c.key==='variable'?{...c,value:'p'}:c),
  presets:[P('Roe и HLLE','Roe and HLLE',{methodA:'roe',methodB:'hlle',variable:'p',mode:'pair'}),P('Энтропийная поправка — достаточно?','Is an entropy fix enough?',{methodA:'roe-entropy',methodB:'hlle',variable:'p',mode:'pair'}),P('HLLC и HLLE','HLLC and HLLE',{methodA:'hllc',methodB:'hlle',variable:'rho',mode:'pair'}),P('Все методы: минимумы p и ρ','All methods: minimum p and ρ',{mode:'all',variable:'p'})],
  question:['Следите за минимумами p и ρ, а не только за гладкостью кривой. Если расчёт остановился, в какой момент и какая величина потеряла положительность?','Watch minimum p and ρ, not only curve smoothness. If a run stops, when does it fail and which quantity first loses positivity?'],
  explanation:['Газ расходится от центра, оставляя малые плотность и давление. Точное симметричное решение имеет u*=0 и положительные p*,ρ*: настоящего вакуума здесь нет. Roe может выйти из области физических состояний; оценки скоростей Эйнфельдта созданы с учётом этой проблемы.','Gas moves away from the centre, leaving low density and pressure. The exact symmetric solution has u*=0 and positive p*,ρ*: this case contains no true vacuum. Roe can leave the physical state region; Einfeldt wave-speed estimates address this problem.'],
  caveat:strictCaveat,sources:['positivity','einfeldt','euler'],dynamic:true,action:['Развести потоки','Separate the streams'],thumbSteps:8
},
{
  id:'hll-speeds',group:2,title:['HLL и HLLE: дело в скоростях','HLL and HLLE: the wave speeds matter'],
  short:['Одна формула потока, две оценки границ веера.','One flux formula, two estimates of the fan boundaries.'],
  equation:{tex:String.raw`F_{\text{HLL}}=\frac{S_RF_L-S_LF_R+S_LS_R(U_R-U_L)}{S_R-S_L},\qquad S_L<0<S_R`},
  controls:stateControls({rho:1,u:-2,p:.4},{rho:1,u:2,p:.4}),
  presets:[P('Два разрежения','Double rarefaction',{rhoL:1,uL:-2,pL:.4,rhoR:1,uR:2,pR:.4}),P('Труба Сода','Sod tube',{rhoL:1,uL:0,pL:1,rhoR:.125,uR:0,pR:.1}),P('Большой перепад плотности','Large density contrast',{rhoL:5,uL:1,pL:1,rhoR:.05,uR:0,pR:1}),P('Сверхзвуковой перенос вправо','Supersonic transport to the right',{rhoL:1,uL:4,pL:1,rhoR:.5,uR:3,pR:.1})],
  question:['Сопоставьте крайние скорости и промежуточное состояние. Всегда ли HLL и HLLE дают разные числа? Что меняется, если весь веер идёт вправо?','Compare outer speeds and the middle state. Do HLL and HLLE always give different numbers? What changes when the entire fan moves right?'],
  explanation:['В HLL–Davis здесь SL=min(uL−aL,uR−aR), SR=max(uL+aL,uR+aR). В HLLE–Einfeldt: SL=min(uL−aL,ũ−ã), SR=max(uR+aR,ũ+ã). Тильда обозначает средние Roe. При одностороннем веере выбирается соответствующий физический поток.','Here HLL–Davis uses SL=min(uL−aL,uR−aR), SR=max(uL+aL,uR+aR). HLLE–Einfeldt uses SL=min(uL−aL,ũ−ã), SR=max(uR+aR,ũ+ã), with Roe averages marked by tildes. A one-sided fan selects the corresponding physical flux.'],
  caveat:['HLL — семейство двухволновых потоков; HLLE — выбор скоростей внутри этого семейства. На некоторых данных оценки совпадают. Две одинаковые кривые в таком случае правильны.','HLL is a family of two-wave fluxes; HLLE specifies wave speeds within it. Some data give identical estimates. Coincident curves are then the correct result.'],
  sources:['hll','davis','einfeldt','positivity','euler'],dynamic:false
},
{
  id:'flux-splitting',group:3,title:['Steger–Warming и van Leer','Steger–Warming and van Leer'],
  short:['Как разделить один поток на правую и левую части.','Split one physical flux into right- and left-going parts.'],
  equation:{tex:String.raw`F_{i+1/2}=f^+(U_L)+f^-(U_R),\qquad f=f^++f^-`},
  controls:[S('method','Расщепление','Splitting','vanleer',[O('vanleer','van Leer'),O('steger-warming','Steger–Warming')]),R('mach','Число Маха M','Mach number M',.3,-2,2,.05),S('component','Компонента потока','Flux component','mass',[O('mass','Масса','Mass'),O('momentum','Импульс','Momentum'),O('energy','Энергия','Energy')])],
  presets:[P('Покой: части не нулевые','At rest: nonzero split parts',{mach:0,component:'mass'}),P('Около M = 1','Near M = 1',{mach:1,component:'mass'}),P('Сверхзвуковой поток','Supersonic flow',{mach:1.5}),P('Сравнить излом Steger–Warming','Inspect the Steger–Warming kink',{method:'steger-warming',mach:1})],
  question:['При M = 0 полный поток массы равен нулю. Равны ли нулю обе части? Почему их компенсация нарушается на контакте между разными состояниями?','At M = 0 the total mass flux is zero. Are both split parts zero? Why does their cancellation fail across a contact joining different states?'],
  explanation:['Steger–Warming разделяет собственные значения как λ±=(λ±|λ|)/2. van Leer использует полиномиальное расщепление в дозвуковой области. При M≥1 или M≤−1 поток становится односторонним. Сумма частей всегда восстанавливает исходный поток одного состояния.','Steger–Warming splits eigenvalues as λ±=(λ±|λ|)/2. van Leer uses polynomial splitting in the subsonic region. For M≥1 or M≤−1 the flux is one-sided. The two parts always sum to the physical flux of one state.'],
  caveat:['Показаны исходные FVS, без сглаживания Steger–Warming и без модификации van Leer — Hänel. Это расщепление потока, а не одноимённый ограничитель наклона van Leer из прошлой лекции.','These are the original FVS forms, without Steger–Warming smoothing or the van Leer–Hänel modification. van Leer here is a flux splitting, not the slope limiter from the previous lecture.'],
  sources:['steger','vanleer'],dynamic:false
},
{
  id:'ausm-split',group:3,title:['AUSM: перенос отдельно от давления','AUSM: separate advection and pressure'],
  short:['Направление переноса выбирает число Маха на грани.','The interface Mach number selects the advection direction.'],
  equation:{tex:String.raw`F=\dot m\,(1,u,H)^T+(0,p_f,0)^T,\qquad M_f=M^+(M_L)+M^-(M_R)+M_p`},
  controls:[S('variant','Вариант AUSM','AUSM variant','ausm',[O('ausm','AUSM (1993)'),O('ausm-up','AUSM+up (2006)')]),R('machL','Слева: ML','Left: ML',.2,-2,2,.05),R('machR','Справа: MR','Right: MR',-.1,-2,2,.05),S('lowMachCutoff','AUSM+up: опорное M','AUSM+up: reference M',.1,[.01,.1,1].map(n=>O(n,String(n))))],
  presets:[P('Оба потока вправо','Both streams move right',{machL:.6,machR:.2}),P('Встречные потоки','Opposing streams',{machL:.5,machR:-.5}),P('Малые числа Маха','Small Mach numbers',{variant:'ausm-up',machL:.05,machR:-.05,lowMachCutoff:.01}),P('Односторонний предел','One-sided limit',{machL:1.5,machR:1.2})],
  question:['Измените знак суммарного M на грани. Какие величины начинают браться с другой стороны? Почему давление нельзя выбирать только по этому знаку?','Reverse the combined interface Mach number. Which quantities now come from the other side? Why can pressure not be selected using this sign alone?'],
  explanation:['AUSM переносит массу, скорость и полную энтальпию с выбранной стороны, а давление собирает отдельным расщеплением. AUSM+up меняет полиномы и добавляет поправку давления в поток массы и поправку скорости в давление на грани.','AUSM advects mass, velocity and total enthalpy from the selected side, while pressure uses a separate splitting. AUSM+up changes the polynomials and adds a pressure correction to mass flux and a velocity correction to interface pressure.'],
  caveat:['В исходном AUSM числа Маха определяются по aL и aR; в AUSM+up — по общей af. В обозначениях M_p=0 для исходного AUSM. Эта локальная диаграмма показывает устройство расщепления; эволюцию сравнивайте в трубе и на контакте.','Original AUSM defines Mach numbers using aL and aR; AUSM+up uses a shared af. Here Mp=0 for original AUSM. This local diagram explains the splitting; compare actual evolution in the tube and contact tests.'],
  sources:['ausm','ausmTM','ausmup','su2'],dynamic:false
},
{
  id:'low-mach',group:4,title:['Малое M: сколько диссипации в импульсе?','Low Mach: how much momentum dissipation?'],
  short:['Уменьшаем скорость и измеряем локальную поправку к потоку.','Reduce velocity and measure the local flux correction.'],
  equation:{tex:String.raw`D_u=\left|F_{\rho u}-\tfrac12(f_{\rho u,L}+f_{\rho u,R})\right|,\quad y=\log_{10}(D_u/M^2)`},
  controls:[S('methodA','Метод A','Method A','roe',methods),S('methodB','Метод B','Method B','ausm-up',methods),R('logMach','log₁₀ M','log₁₀ M',-2,-4,0,.25),R('gradient','Относительный скачок скорости','Relative velocity jump',.1,.02,.4,.02),S('cutoffMode','Опорное M для AUSM+up','AUSM+up reference Mach','matched',[O('matched','Менять вместе с M','Match the tested M'),O('fixed','Держать постоянным','Hold fixed')]),S('lowMachCutoff','Фиксированное опорное M','Fixed reference Mach',.01,[.001,.01,.1,1].map(n=>O(n,String(n))))],
  presets:[P('Roe и all-speed поправка','Roe and the all-speed correction',{methodA:'roe',methodB:'ausm-up',cutoffMode:'matched',logMach:-2}),P('Завысить опорное M','Use a high reference Mach',{methodB:'ausm-up',cutoffMode:'fixed',lowMachCutoff:1,logMach:-3}),P('Два FVS','Two FVS methods',{methodA:'vanleer',methodB:'steger-warming'}),P('Промежуточный режим','Intermediate regime',{logMach:-.5})],
  question:['На графике показано D/M². Что означает наклон −1 на логарифмических осях? Повторите опыт с постоянным опорным M для AUSM+up.','The plot shows D/M². What does a slope of −1 on logarithmic axes mean? Repeat with a fixed AUSM+up reference Mach number.'],
  explanation:['Поправка к потоку импульса нормирована на инерционный масштаб M²: горизонтальная кривая означает D∼M², наклон −1 — D∼M. При малом M избыточная акустическая диссипация может подавлять медленное движение. В AUSM+up коэффициент fa=M0(2−M0) регулирует эту часть потока; нижний порог M0 влияет на масштабирование.','The momentum-flux correction is divided by the inertial scale M²: a horizontal curve means D∼M², while slope −1 means D∼M. At low M, excess acoustic dissipation can overwhelm slow motion. AUSM+up uses fa=M0(2−M0) to regulate this contribution; the lower bound on M0 affects its scaling.'],
  caveat:['Это локальный тест потока на специально заданной паре состояний, не расчёт вихря и не доказательство точности всей схемы. Он не ранжирует методы для акустики. Явное интегрирование всё ещё ограничено акустическим CFL.','This is a local flux test on a specified pair of states, not a vortex simulation or proof of full-scheme accuracy. It does not rank acoustic propagation. Explicit time integration still obeys an acoustic CFL restriction.'],
  sources:['ausmup','su2','roe'],dynamic:false
},
{
  id:'shu-osher',group:4,title:['Шу — Ошер: сохранить волны за ударом','Shu–Osher: retain the waves behind a shock'],
  short:['Ударная волна встречает неоднородную плотность.','A shock meets a nonuniform density field.'],
  equation:{tex:String.raw`\rho_R(x)=1+0.2\sin(5x),\qquad u_R=0,\quad p_R=1,\quad M_s=3`},
  controls:pairControls('hllc','hlle'),
  presets:[P('HLLC и HLLE','HLLC and HLLE',{methodA:'hllc',methodB:'hlle',variable:'rho',mode:'pair'}),P('Roe и van Leer','Roe and van Leer',{methodA:'roe',methodB:'vanleer',variable:'rho',mode:'pair'}),P('Удвоить разрешение','Double the resolution',{N:400}),P('Все девять','All nine',{mode:'all',variable:'rho'})],
  question:['Смотрите за ударной волной. Какие пики сглаживаются сильнее? После удвоения N различие между потоками уменьшается или сохраняется?','Inspect the region behind the shock. Which peaks are most strongly smoothed? Does doubling N remove or retain the difference between fluxes?'],
  explanation:['Плотность впереди удара периодически меняется при постоянных давлении и скорости: это энтропийная неоднородность. Ударная волна сжимает её и создаёт мелкие структуры позади себя. Тест одновременно проверяет захват удара и сохранение слабых волн.','Ahead of the shock, density varies periodically at constant pressure and velocity: an entropy perturbation. The shock compresses it and creates fine structure behind itself. The test probes both shock capture and preservation of weak waves.'],
  caveat:['Первый порядок делает диффузию заметной. Аналитический эталон не показан: сопоставляйте сетки N и 2N, не считая более мелкую сетку точным решением. '+strictCaveat[0],'First order makes diffusion visible. No analytic reference is shown: compare grids N and 2N without treating the finer grid as an exact solution. '+strictCaveat[1]],
  sources:['shuosher','roe','hllc'],dynamic:true,action:['Провести удар через волны','Send shock through waves'],thumbSteps:8
},
{
  id:'strong-shock',group:4,title:['Сильный перепад давления','A strong pressure jump'],
  short:['Резкий фронт — только одна часть испытания.','A sharp front is only part of the test.'],
  equation:{tex:String.raw`(\rho,u,p)_L=(1,0,1000),\qquad(\rho,u,p)_R=(1,0,0.01),\qquad T=0.012`},
  // Density is uniform at t=0, so open on pressure, which carries the jump.
  controls:pairControls('roe-entropy','hlle').map(c=>c.key==='variable'?{...c,value:'p'}:c),presets:pairPresets,
  question:['Сравните положение фронта, максимальную плотность и поведение давления за ударом. Достаточно ли одного резкого скачка, чтобы признать решение хорошим?','Compare shock position, peak density and pressure behind the shock. Is one sharp jump enough to call the solution accurate?'],
  explanation:['Большой перепад давления создаёт сильную ударную волну, контакт и разрежение. Их масштабы заметно различаются. Переключайте величины и разрешение: ширина фронта, высота узкого пика и положительность оценивают разные свойства потока.','A large pressure jump generates a strong shock, a contact and a rarefaction with very different scales. Switch variables and resolution: front thickness, a narrow peak’s height and positivity assess different flux properties.'],
  caveat:['Одномерная устойчивость сильного удара не проверяет карбункул: для него нужен поперечный механизм. '+strictCaveat[0],'One-dimensional strong-shock robustness does not test carbuncle instability, which involves transverse dynamics. '+strictCaveat[1]],
  sources:['positivity','euler','ausmup'],dynamic:true,action:['Запустить сильный удар','Run strong shock'],thumbSteps:8
},
{
  id:'carbuncle',group:4,title:['Карбункул: поперечная неустойчивость удара','Carbuncle: transverse shock instability'],
  short:['Настоящий 2D-расчёт: растёт ли начальная рябь?','A real 2D computation: does the seeded ripple grow?'],
  equation:{tex:String.raw`\partial_tU+\partial_xF+\partial_yG=0,\qquad [F]=0,\qquad v(x,y,0)=\varepsilon u_1\,\eta(x,y)`},
  controls:[S('methodA','Метод A','Method A','roe',methods),S('methodB','Метод B','Method B','hlle',methods),R('nx','Число ячеек по x','Cells in x',96,48,128,16),R('mach','Число Маха перед ударом','Upstream Mach number',6,2,20,1),R('perturbation','Амплитуда начального v/u₁','Initial v/u₁ amplitude',.001,0,.01,.001),R('cfl','Число CFL','CFL number',.3,.05,.5,.05),S('field','Поле','Field','density',[O('density','Плотность','Density'),O('transverse','Поперечная скорость v','Transverse velocity v')]),R('entropyFix','Roe: ε в δ = εã','Roe: ε in δ = εã',.1,0,.5,.01),S('lowMachCutoff','AUSM+up: опорное M','AUSM+up: reference M',1,[1,.1,.01].map(n=>O(n,String(n))))],
  presets:[P('Roe и HLLE: малое возмущение','Roe and HLLE: mild perturbation',{methodA:'roe',methodB:'hlle',nx:96,mach:6,perturbation:.001,field:'density'}),P('Посмотреть поперечную скорость','Inspect transverse velocity',{field:'transverse'}),P('Без заданного возмущения','No prescribed perturbation',{perturbation:0}),P('Увеличить возмущение','Stronger perturbation',{perturbation:.005}),P('Усилить удар','Increase shock Mach number',{mach:20,perturbation:.001}),P('HLLC и HLLE','HLLC and HLLE',{methodA:'hllc',methodB:'hlle',mach:6,perturbation:.001})],
  question:['Сравните одну и ту же начальную рябь у двух потоков. Растёт ли поперечная скорость вместе с деформацией фронта? Повторите с нулевым возмущением.','Compare the same initial ripple with two fluxes. Does transverse velocity grow together with front distortion? Repeat with zero perturbation.'],
  explanation:['Начальные состояния удовлетворяют условиям Ранкина — Гюгонио для неподвижного плоского удара. Малое поперечное возмущение задаётся один раз возле фронта. Затем все изменения рассчитывают двумерные уравнения Эйлера: рост не подрисовывается и не навязывается.','Initial states satisfy the Rankine–Hugoniot conditions for a stationary planar shock. A small transverse perturbation is seeded once near the front. All later changes come from the two-dimensional Euler calculation; growth is neither drawn in nor forced.'],
  caveat:['Учебный тест плоского удара из семейства карбункульных неустойчивостей; это не обтекание цилиндра и не точная сетка опыта Квирка. Периодичность по y, заданный сверхзвуковой вход и давление на выходе. Первый порядок; нарушение положительности останавливает расчёт. Исход зависит от сетки, времени и возмущения.','An educational planar-shock test in the carbuncle family, not cylinder flow or Quirk’s exact grid. Periodic y boundaries, prescribed supersonic inflow and outlet pressure. First order; loss of positivity stops the run. Results depend on grid, time and perturbation.'],
  sources:['quirk','thinshock','roe','hllc','einfeldt'],dynamic:true,action:['Наблюдать удар','Evolve the shock'],thumbSteps:3
},
{
  id:'comparison',group:5,title:['Один опыт — девять методов','One experiment, nine methods'],
  short:['Сопоставить точность, диффузию и отказ на общих данных.','Compare accuracy, diffusion and failure on shared data.'],
  equation:fvEquation,
  controls:[S('caseId','Проверочная задача','Test case','sod',cases),...pairControls('roe','hllc','all')],
  presets:[P('Сод: все потоки','Sod: all fluxes',{caseId:'sod',mode:'all',variable:'rho',cfl:.35,lowMachCutoff:1}),P('Контакт: цена диффузии','Contact: cost of diffusion',{caseId:'contact',mode:'all',variable:'rho',cfl:.35,lowMachCutoff:1}),P('Разрежение: физические состояния','Rarefaction: physical states',{caseId:'double-rarefaction',mode:'all',variable:'p',cfl:.35,lowMachCutoff:1}),P('Шу — Ошер: малые масштабы','Shu–Osher: fine scales',{caseId:'shu-osher',mode:'all',variable:'rho',cfl:.35,lowMachCutoff:1}),P('Медленный перенос: M∞ = 0.01','Slow advection: M∞ = 0.01',{caseId:'low-mach',mode:'pair',methodA:'roe',methodB:'ausm-up',variable:'rho',cfl:.05,lowMachCutoff:.01}),P('Проверить выбранную пару','Inspect a selected pair',{mode:'pair'})],
  question:['Выберите лучший поток для контакта, а затем проверьте тот же выбор на разрежении и сильном ударе. Сохраняется ли преимущество?','Pick a flux for contact resolution, then test the same choice on rarefaction and a strong shock. Does its advantage survive?'],
  explanation:['Меняется только численный поток: девять методов получают общие данные и одну дискретизацию. Читайте профиль вместе с метриками и статусом расчёта. Резкость контакта, физическая допустимость и поведение сильного удара не сводятся к одной универсальной оценке.','Only the numerical flux changes: all nine methods receive common data and one discretization. Read the profile together with metrics and run status. Contact sharpness, physical admissibility and strong-shock behaviour cannot be reduced to one universal score.'],
  caveat:['Сравниваются конкретные реализации: Roe и акустическая поправка Хартена, HLL–Davis, HLLE–Einfeldt, HLLC, исходные FVS, AUSM и AUSM+up. Пресет медленного переноса задаёт M∞ = 0.01 и CFL = 0.05; он проверяет перенос энтропии, а не вихревую динамику. '+strictCaveat[0],'The comparison uses specific implementations: Roe and its acoustic Harten fix, HLL–Davis, HLLE–Einfeldt, HLLC, original FVS, AUSM and AUSM+up. The slow-advection preset sets M∞ = 0.01 and CFL = 0.05; it tests entropy advection, not vortex dynamics. '+strictCaveat[1]],
  sources:['roe','hll','einfeldt','hllc','vanleer','steger','ausm','ausmup'],dynamic:true,action:['Сравнить эволюцию','Compare evolution'],thumbSteps:8
}
];

function defaults(d) { return Object.fromEntries(d.controls.map(c=>[c.key,c.value])); }
function translate(value,lang='ru') { return Array.isArray(value)?value[lang==='en'?1:0]:value; }
return {groups,sources,demos,defaults,translate};
})();
export default moduleValue;
