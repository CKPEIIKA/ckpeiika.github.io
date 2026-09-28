const moduleValue = (() => {
/** Course map: the supplied Lecture 3 outline, not guessed slide numbers. */
const R=(key,label,value,min,max,step=1)=>({key,label,type:'range',value,min,max,step});
const S=(key,label,value,options)=>({key,label,type:'select',value,options});
const O=(value,ru,en)=>({value,label:[ru,en]});
const P=(label,values)=>({label,values});
const groups=[['Сетка','Grid'],['Производные','Derivatives'],['Операторы','Operators'],['Компактные схемы','Compact schemes'],['Разностные схемы','Difference schemes'],['Сохранение и стоимость','Conservation and cost']];
const fnOptions=[O('sin','sin x','sin x'),O('exp','exp x','exp x'),O('gaussian','exp(−x²)','exp(−x²)'),O('cubic','x³','x³')];
const diffOptions=[O('forward','Правая · O(h)','Forward · O(h)'),O('backward','Левая · O(h)','Backward · O(h)'),O('central','Центральная · O(h²)','Centered · O(h²)'),O('fourth','Пять узлов · O(h⁴)','Five points · O(h⁴)')];
const schemeOptions=[O('upwind','Против потока','Upwind'),O('lf','Лакс — Фридрихс','Lax–Friedrichs'),O('lw','Лакс — Вендрофф','Lax–Wendroff'),O('ftcs','FTCS: центральная явная','FTCS: forward time, centered space'),O('maccormack','Мак-Кормак','MacCormack')];
const profileOptions=[O('gaussian','Гладкий импульс','Smooth pulse'),O('step','Прямоугольный импульс','Square pulse'),O('sine','Синусоида','Sine wave'),O('triangle','Треугольник','Triangle')];
const compactOptions=[O('central','Явная 2-го порядка','Explicit, order 2'),O('fourth','Явная 4-го порядка','Explicit, order 4'),O('compact4','Компактная 4-го порядка','Compact, order 4'),O('compact6','Компактная 6-го порядка','Compact, order 6')];
const sources={
 site:{label:'Existing Lecture 2 gallery / Chalkish API',url:'https://ckpeiika.github.io/demos/pde-lecture-2/'},
 taylor:{label:'Cameron Taylor (MIT): Finite Difference Coefficients Calculator',url:'https://web.media.mit.edu/~crtaylor/calculator.html'},
 scijs:{label:'scijs/finite-difference-stencil: explicit and implicit stencil construction',url:'https://github.com/scijs/finite-difference-stencil'},
 heathFD:{label:'Michael Heath (UIUC): Finite Difference Approximations [legacy Java]',url:'https://heath.cs.illinois.edu/iem/integration/fda/'},
 heathRound:{label:'Michael Heath (UIUC): Rounding and Truncation Errors [legacy Java]',url:'https://heath.cs.illinois.edu/iem/floating_point/rounding_truncation/'},
 heathAdv:{label:'Michael Heath (UIUC): Discretization of the Advection Equation [legacy Java]',url:'https://heath.cs.illinois.edu/iem/pde/discadvc/'},
 heathHeat:{label:'Michael Heath (UIUC): Discretization of the Heat Equation [legacy Java]',url:'https://heath.cs.illinois.edu/iem/pde/discheat/'},
 heathCFL:{label:'Michael Heath (UIUC): CFL Condition [legacy Java]',url:'https://heath.cs.illinois.edu/iem/pde/wavecfl/'},
 lele:{label:'S. K. Lele (1992): Compact finite difference schemes with spectral-like resolution',url:'https://doi.org/10.1016/0021-9991(92)90324-R'},
 leveque:{label:'R. J. LeVeque: Accuracy, consistency, stability and CFL (lecture notes)',url:'https://faculty.washington.edu/rjl/slides/fvmhp/fvmhp08_fvm2.pdf'}
};
const demos=[
{
 id:'grid',thumbParams:{n:12,k:3,view:'averages'},group:0,title:['Функция становится сеточной','A function becomes a grid function'],short:['Что остаётся между узлами?','What is lost between nodes?'],
 equation:{tex:String.raw`u(x) \to \{u_i = u(x_i)\};\qquad \bar u_i = \frac{1}{h_i}\int_{x_i}^{x_{i+1}} u(x)\,dx`},
 controls:[R('n',['Число интервалов N','Number of intervals N'],16,4,64,2),R('k',['Число волн k','Number of waves k'],3,1,24),R('stretch',['Сгущение сетки β','Grid stretching β'],0,-3,3,.25),S('view',['Сеточное представление','Grid representation'],'nodes',[O('nodes','Узловые значения','Nodal values'),O('averages','Средние по ячейкам','Cell averages')])],
 presets:[P(['Разрешено','Resolved'],{n:32,k:3,stretch:0}),P(['Алиасинг','Aliasing'],{n:8,k:9,stretch:0}),P(['Сгущение','Stretched grid'],{n:20,k:5,stretch:2,view:'averages'})],
 question:['Установите N = 8, k = 9. Почему узлы совпадают с волной k = 1? Затем включите средние по ячейкам.','Set N = 8 and k = 9. Why do the nodes match a wave with k = 1? Then switch to cell averages.'],
 explanation:['Узловое значение и среднее по ячейке — разные неизвестные. На равномерной сетке частоты, различающиеся на целое кратное N, дают одинаковые отсчёты комплексной волны. На сгущённой сетке единого шага h нет.','A nodal value and a cell average are different unknowns. On a uniform grid, frequencies differing by an integer multiple of N produce identical complex-wave samples. A stretched grid has no single spacing h.'],
 caveat:['Непрерывная линия известна только потому, что здесь задана тестовая функция. Обычный расчёт не располагает этой скрытой информацией.','The continuous line is available only because this is a prescribed test function. A numerical solution does not normally contain that hidden information.'],sources:['heathFD']
},
{
 id:'differences',group:1,title:['Секущая и производная','Secant and derivative'],short:['Геометрия и фактическая ошибка','Geometry and measured error'],
 equation:{tex:String.raw`D_h f(x) = \frac{1}{h}\sum_j w_j\, f(x+s_j h)`},
 controls:[S('fn',['Функция','Function'],'sin',fnOptions),S('method',['Формула','Formula'],'central',diffOptions),R('x',['Точка x','Evaluation point x'],.6,-1.3,1.3,.05),R('h',['Шаг h','Spacing h'],.45,.025,.8,.025)],
 presets:[P(['Несимметрия','Asymmetry'],{method:'forward',fn:'exp',x:0,h:.7}),P(['Симметрия','Symmetry'],{method:'central',fn:'sin',x:.5,h:.7}),P(['Высокий порядок','Higher order'],{method:'fourth',fn:'exp',x:0,h:.4})],
 question:['Сначала предскажите знак ошибки. Уменьшите h вдвое, затем сопоставьте наклоны и отношение ошибок.','Predict the error sign. Halve h, then inspect the slopes and the error ratio.'],
 explanation:['Правая и левая разности используют несимметричные данные и имеют первый порядок. В центральной разности вклады чётных степеней взаимно сокращаются. Пятипозиционная формула дополнительно сокращает вклад кубического члена.','Forward and backward differences use asymmetric data and have first-order error. In a centered difference, the even-power terms cancel pairwise. A five-point formula also cancels the cubic term.'],
 caveat:['Порядок — асимптотическое свойство при h → 0 для достаточно гладкой функции. В особой точке ведущий коэффициент ошибки может обратиться в ноль.','Order is an asymptotic property as h → 0 for a sufficiently smooth function. The leading error coefficient can vanish at a particular point.'],sources:['taylor','heathFD']
},
{
 id:'stencil',group:1,title:['Соберите разностный шаблон','Build a finite-difference stencil'],short:['Выберите узлы и подберите веса','Choose nodes and determine the weights'],
 equation:{tex:String.raw`\sum_j w_j \frac{s_j^k}{k!} = \delta_{km};\qquad f^{(m)} \approx h^{-m}\sum_j w_j\, f(x+s_j h)`},
 controls:[S('m',['Порядок производной m','Derivative order m'],1,[O(1,'Первая производная','First derivative'),O(2,'Вторая производная','Second derivative')]),R('degree',['Степень полинома n','Polynomial degree n'],7,1,8,1)],
 presets:[P(['Три узла','Three nodes'],{nodes:[-1,0,1],m:1}),P(['Пять узлов','Five nodes'],{nodes:[-2,-1,0,1,2],m:1}),P(['У границы','At a boundary'],{nodes:[0,1,2,3],m:1}),P(['Лапласиан','Second derivative'],{nodes:[-1,0,1],m:2})],
 question:['Можно ли удалить центральный узел из симметричной формулы первой производной без потери порядка? А из формулы второй производной?','Can you remove the center point from the symmetric first-derivative stencil without losing order? What about the second derivative?'],
 explanation:['Коэффициенты вычисляются здесь решением системы условий на моменты. Строка k = m должна дать единицу; остальные младшие строки — ноль. Первый ненулевой старший момент показывает ведущую погрешность.','Weights are calculated here by solving the moment conditions. Row k = m must equal one; all other lower rows must vanish. The first nonzero higher moment determines the leading truncation error.'],
 caveat:['Используются целые смещения −3, −2, ..., 3. Для определения m-й производной нужны как минимум m + 1 различных узлов.','The offsets are the integers −3, −2, ..., 3. An m-th derivative requires at least m + 1 distinct points.'],sources:['taylor','scijs']
},
{
 id:'roundoff',group:1,title:['Маленький шаг не всегда лучше','A smaller step is not always better'],short:['Аппроксимация против округления','Truncation versus round-off'],
 equation:{tex:String.raw`E(h) = |D_h\exp(1) - \exp(1)|;\qquad E(h) \lesssim C_1 h^p + C_2\,\varepsilon/h`},
 controls:[S('precision',['Арифметика','Arithmetic'],'f64',[O('f64','IEEE binary64 · JavaScript','IEEE binary64 · JavaScript'),O('f32','binary32 · Math.fround','binary32 · Math.fround')]),S('method',['Разность','Difference'],'central',[O('central','Центральная · p = 2','Centered · p = 2'),O('forward','Правая · p = 1','Forward · p = 1')]),R('logh',['log₁₀ h','log₁₀ h'],-4,-16,-.25,.05)],
 presets:[P(['Область аппроксимации','Truncation region'],{precision:'f64',logh:-1}),P(['Провал вычитания','Cancellation'],{precision:'f64',logh:-16}),P(['Одинарная точность','Single precision'],{precision:'f32',logh:-4})],
 question:['Почему график ошибки перестаёт падать? Сравните binary32 и binary64, не меняя саму формулу.','Why does the error stop decreasing? Compare binary32 and binary64 without changing the formula.'],
 explanation:['Каждая точка графика — результат вычитания близких чисел. В режиме binary32 округляются аргументы, значения функции и промежуточные операции. При малых h округление начинает преобладать, поэтому кривая становится неровной.','Every point is the result of subtracting nearby numbers. In binary32 mode, arguments, function values and intermediate operations are rounded. At small h, round-off dominates and the curve becomes jagged.'],
 caveat:['Math.exp вычисляется встроенной функцией JavaScript; режим binary32 округляет её результат и не моделирует конкретную библиотеку expf. Нулевые ошибки на графике помечаются отдельно.','Math.exp is the JavaScript implementation; binary32 mode rounds its result rather than emulating a specific expf library. Exactly zero errors are marked separately on the plot.'],sources:['heathRound']
},
{
 id:'shift',group:2,title:['Алгебра операторов сдвига','The algebra of shift operators'],short:['E перемещает данные; полином строит шаблон','E shifts data; a polynomial builds a stencil'],
 equation:{tex:String.raw`E u_i = u_{i+1};\qquad \Delta = E - I;\qquad \nabla = I - E^{-1};\qquad \Delta\nabla = E - 2I + E^{-1}`},
 controls:[S('op',['Оператор','Operator'],'laplace',[O('shift','E: сдвиг','E: shift'),O('forward','Δ = E − I','Δ = E − I'),O('central','δ = (E − E⁻¹)/2','δ = (E − E⁻¹)/2'),O('laplace','Δ∇: вторая разность','Δ∇: second difference'),O('compose','Δ²: композиция двух Δ','Δ²: compose two Δ')]),R('node',['Выбранный индекс i','Selected index i'],7,0,15),R('phase',['Фаза исходной волны','Input-wave phase'],0,0,6.28,.05)],
 presets:[P(['Один сдвиг','One shift'],{op:'shift'}),P(['Симметричная разность','Symmetric difference'],{op:'laplace'}),P(['Композиция','Composition'],{op:'compose'})],
 question:['Сравните Δ² и Δ∇. Коэффициенты похожи; почему они относятся к разным точкам?','Compare Δ² and Δ∇. The weights look similar; why are the stencils centered at different locations?'],
 explanation:['Операторы действуют на периодический массив из 16 значений. Композиция соответствует перемножению полиномов по E. Показаны именно безразмерные разности, до деления на h или h².','These operators act on a periodic array of 16 values. Composition is polynomial multiplication in E. The displayed results are dimensionless differences, before division by h or h².'],
 caveat:['Запись E = exp(hD), D = d/dx, используется формально через ряд Тейлора при достаточной гладкости. Она не означает, что матрицу экспоненты необходимо вычислять в программе.','The relation E = exp(hD), D = d/dx, is a formal Taylor-series identity for sufficiently smooth functions. It does not require a matrix exponential in the implementation.'],sources:['scijs','taylor']
},
{
 id:'compact',group:3,title:['Компактный шаблон, связанная задача','A compact stencil, a coupled solve'],short:['Неизвестные производные тоже входят в уравнение','Neighboring derivatives are unknowns too'],
 equation:{tex:String.raw`\alpha d_{i-1} + d_i + \alpha d_{i+1} = a\frac{u_{i+1} - u_{i-1}}{2h} + b\frac{u_{i+2} - u_{i-2}}{4h}`},
 controls:[S('kind',['Формула производной','Derivative formula'],'compact4',compactOptions),R('n',['Периодических узлов N','Periodic nodes N'],24,12,80,4),R('k',['Число волн k','Number of waves k'],5,1,10),R('node',['Строка системы (доля N)','System row (fraction of N)'],.4,0,.95,.05)],
 presets:[P(['Явная и локальная','Explicit and local'],{kind:'fourth',n:24,k:5}),P(['Три неизвестные d','Three unknown d values'],{kind:'compact4',n:24,k:5}),P(['Шестой порядок','Sixth order'],{kind:'compact6',n:24,k:5})],
 question:['В явной формуле одна производная находится сразу. Что мешает сделать то же самое при α ≠ 0?','An explicit formula gives one derivative immediately. What prevents that when α ≠ 0?'],
 explanation:['d — полный вектор искомых производных. Для периодической задачи решается циклическая трёхдиагональная система A d = B u. Для 4-го порядка α = 1/4, a = 3/2, b = 0; для 6-го порядка α = 1/3, a = 14/9, b = 1/9.','d is the vector of unknown derivatives. The periodic problem requires a cyclic tridiagonal solve A d = B u. Order 4: α = 1/4, a = 3/2, b = 0. Order 6: α = 1/3, a = 14/9, b = 1/9.'],
 caveat:['Все формулы здесь периодические. У физических границ нужны отдельные замыкания; внутренний порядок сам по себе не определяет порядок всего решения.','All formulas here are periodic. Physical boundaries require separate closures; interior order alone does not determine the order of the complete solution.'],sources:['lele','scijs']
},
{
 id:'dispersion',group:3,title:['Какие волны различает сетка?','Which waves can the grid resolve?'],short:['Модифицированное волновое число','Modified wavenumber'],
 equation:{tex:String.raw`D_h e^{ikx} = i k^* e^{ikx};\qquad \xi = kh;\qquad \xi^* = k^* h`},
 controls:[S('kind',['Формула','Formula'],'compact6',compactOptions),R('xi',['Волновое число ξ/π','Wavenumber ξ/π'],.6,.03,1,.01)],
 presets:[P(['Длинная волна','Long wave'],{xi:.1}),P(['Всего 4 узла на волну','Only 4 points per wave'],{xi:.5}),P(['Шахматная мода','Checkerboard mode'],{xi:1})],
 question:['Доведите ξ до π. Почему центральная разность даёт нулевую производную у самой короткой представимой волны?','Move ξ to π. Why does a centered difference return zero for the shortest representable wave?'],
 explanation:['Ось ξ измеряет частоту относительно шага. Идеальная производная даёт прямую ξ* = ξ. Отклонение означает ошибку амплитуды производной, а при полудискретном переносе — ошибку фазовой скорости.','ξ is a wavenumber measured relative to grid spacing. The exact derivative lies on ξ* = ξ. Deviation means derivative-amplitude error and, for semidiscrete advection, a phase-speed error.'],
 caveat:['Это анализ пространственного оператора. Ошибка интегрирования по времени здесь не примешивается; компактная формула не делает произвольную временную схему устойчивой.','This isolates the spatial operator. Time-integration error is not included; a compact derivative does not make an arbitrary time scheme stable.'],sources:['lele']
},
{
 id:'spacetime',group:4,title:['Связи схемы в пространстве и времени','A stencil in space and time'],short:['Характеристика и связи схемы','Characteristic and scheme links'],
 equation:{tex:String.raw`u_i^{n+1} = w_- u_{i-1}^n + w_0 u_i^n + w_+ u_{i+1}^n;\qquad C = a\,\Delta t/h`},
 controls:[S('scheme',['Схема','Scheme'],'upwind',schemeOptions.filter(o=>o.value!=='maccormack')),R('C',['Число Куранта C','Courant number C'],.7,-1.5,1.5,.05),R('steps',['Число слоёв','Number of time levels'],4,1,6)],
 presets:[P(['CFL выполнено','CFL satisfied'],{scheme:'upwind',C:.8}),P(['CFL нарушено','CFL violated'],{scheme:'upwind',C:1.3}),P(['CFL выполнено, схема неустойчива','CFL satisfied, scheme unstable'],{scheme:'ftcs',C:.5})],
 question:['FTCS использует оба соседних узла и охватывает характеристику при |C| < 1. Почему этого всё же недостаточно для устойчивости?','FTCS uses both neighbors and contains the characteristic for |C| < 1. Why is that still insufficient for stability?'],
 explanation:['Жёлтая линия — характеристика уравнения переноса. Узлы отмечают фактические зависимости схемы. На правой панели показаны веса и максимум |G(ξ)| по модам: рост выше единицы означает усиление некоторых возмущений.','The yellow line is a characteristic of the advection equation. Nodes show the scheme’s actual dependencies. The right panel gives the weights and the maximum |G(ξ)| over modes; values above one amplify some perturbations.'],
 caveat:['CFL проверяет сходимость в этой постановке. Устойчивость оценивается отдельно. Отрицательный вес может встречаться и в устойчивой схеме.','CFL addresses convergence in this setting. Stability requires a separate analysis. A negative weight can also occur in a stable scheme.'],sources:['heathCFL','leveque']
},
{
 id:'advection',thumbParams:{profile:'step'},thumbSteps:24,group:4,title:['Сравнение схем при одном переносе','Comparing schemes for one advection problem'],short:['Размазывание, колебания, неустойчивость','Smearing, oscillations, instability'],dynamic:true,
 equation:{tex:[String.raw`u_t + u_x = 0,\quad x \in [0,1),\ \text{периодичность};\qquad u(x,t) = u_0(x-t)`,String.raw`u_t + u_x = 0,\quad x \in [0,1),\ \text{periodic};\qquad u(x,t) = u_0(x-t)`]},
 controls:[S('A',['Схема A','Scheme A'],'upwind',schemeOptions),S('B',['Схема B','Scheme B'],'lw',schemeOptions),S('profile',['Начальные данные','Initial profile'],'gaussian',profileOptions),R('n',['Узлов N','Nodes N'],80,24,256,8),R('C',['Число Куранта C','Courant number C'],.8,.1,1.3,.05)],
 presets:[P(['Размывание / колебания','Smearing / ringing'],{A:'upwind',B:'lw',profile:'step',C:.8}),P(['Неустойчивость FTCS','FTCS instability'],{A:'upwind',B:'ftcs',profile:'gaussian',C:.5}),P(['Сдвиг ровно на узел','Exact one-cell shift'],{A:'upwind',B:'lw',profile:'step',C:1})],
 question:['При C = 1 некоторые схемы переносят узловые данные точно. Сохраняется ли это при C = 0.8?','At C = 1, some schemes shift the grid values exactly. Does this survive at C = 0.8?'],
 explanation:['Обе схемы выполняют реальные шаги с одинаковыми N, Δt и начальными значениями. Белая линия — точный перенос. Диагностика показывает ошибку в узлах, экстремумы и среднее.','Both methods take actual time steps with identical N, Δt and initial values. The white curve is exact translation. Diagnostics report nodal error, extrema and the mean.'],
 caveat:['При |u| > 20 расчёт останавливается: дальнейшее продолжение скрыло бы неустойчивость. После изменения параметра расчёт начинается заново.','When |u| > 20, the calculation stops; continuing would hide the instability. Changing a parameter starts a new run.'],sources:['heathAdv','leveque']
},
{
 id:'heat',thumbParams:{mode:'mix',theta:.5,r:1},thumbSteps:1,group:4,title:['Точное и численное затухание','Exact and numerical decay'],short:['Устойчивость не гарантирует точность','Stability does not guarantee accuracy'],dynamic:true,
 equation:{tex:String.raw`\frac{u^{n+1}-u^n}{\Delta t} = \theta D_{xx}u^{n+1} + (1-\theta)D_{xx}u^n;\qquad r = \Delta t/h^2`},
 controls:[S('theta',['Вес θ','Weight θ'],0,[O(0,'0 · явный Эйлер','0 · forward Euler'),O(.5,'1/2 · Кранк — Николсон','1/2 · Crank–Nicolson'),O(1,'1 · неявный Эйлер','1 · backward Euler')]),R('n',['Интервалов N','Intervals N'],32,16,96,8),R('r',['Число r = Δt/h²','Number r = Δt/h²'],.4,.05,8,.05),S('mode',['Начальная мода','Initial mode'],'low',[O('low','sin(πx)','sin(πx)'),O('high','Высокочастотная мода','High-frequency mode'),O('mix','Низкая + высокая','Low + high frequency')])],
 presets:[P(['Явная: устойчиво','Explicit: stable'],{theta:0,r:.4,mode:'mix'}),P(['Явная: неустойчиво','Explicit: unstable'],{theta:0,r:.8,mode:'mix'}),P(['CN: смена знака','CN: sign alternation'],{theta:.5,r:4,mode:'high'}),P(['Неявное затухание','Implicit damping'],{theta:1,r:4,mode:'high'})],
 question:['Сравните θ = 1/2 и θ = 1 при большом r на короткой волне. Почему устойчивое решение может менять знак?','Compare θ = 1/2 and θ = 1 for a large r and a short wave. Why can a stable solution alternate in sign?'],
 explanation:['Граничные значения u(0,t) = u(1,t) = 0. Неявные шаги решают трёхдиагональную систему. Точное решение для каждой выбранной синусоидальной моды известно: exp(−k²π²t) sin(kπx).','Boundary values are u(0,t) = u(1,t) = 0. Implicit steps solve a tridiagonal system. Each selected sine mode has the exact solution exp(−k²π²t) sin(kπx).'],
 caveat:['При θ ≥ 1/2 линейная задача остаётся устойчивой при любом Δt в данном анализе. Точность и монотонность всё равно требуют ограничений.','For θ ≥ 1/2, this linear problem remains stable for any Δt in the present analysis. Accuracy and monotonicity still impose restrictions.'],sources:['heathHeat']
},
{
 id:'balance',thumbSteps:24,group:5,title:['Поток переносит запас по сетке','Flux transports content across the grid'],short:['Динамика потока и сохранение суммы','Flux dynamics and conserved total'],dynamic:true,
 equation:{tex:String.raw`F_{i+½} = a\,u_i;\qquad u_i^{n+1} = u_i^n + \frac{\Delta t}{h}\left(F_{i-½} - F_{i+½}\right)`},
 controls:[R('dt',['Шаг времени Δt','Time step Δt'],.04,.01,.08,.01),R('speed',['Скорость переноса a','Transport speed a'],1,.2,1.8,.1),S('profile',['Начальный профиль','Initial profile'],'pulse',[O('pulse','Импульс','Pulse'),O('wave','Волна','Wave'),O('step','Ступенька','Step')])],
 presets:[P(['Импульс','Pulse'],{profile:'pulse',speed:1,dt:.04}),P(['Гладкая волна','Smooth wave'],{profile:'wave',speed:1,dt:.04}),P(['Ступенька','Step'],{profile:'step',speed:.8,dt:.04})],
 question:['Запустите перенос. Как профиль проходит через периодическую границу и почему сумма запаса не меняется?','Run the transport. How does the profile cross the periodic boundary, and why does the total content stay constant?'],
 explanation:['Поток на каждой грани пересчитывается из соседнего значения u. Один и тот же Fᵢ₊½ выходит из одной ячейки и входит в следующую, поэтому внутренние вклады сокращаются.','The flux on every face is recomputed from the neighboring value of u. The same Fᵢ₊½ leaves one cell and enters the next, so interior contributions cancel.'],
 caveat:['Это линейный перенос с положительной скоростью и периодической границей. Схема первого порядка постепенно размывает профиль, хотя сохраняет его сумму.','This is linear advection with positive speed and a periodic boundary. The first-order scheme gradually smears the profile while preserving its total.'],sources:['leveque']
},
{
 id:'shock',thumbSteps:50,group:5,title:['Скорость разрыва из закона сохранения','Shock speed from conservation'],short:['Консервативная и неконсервативная формы','Conservative and nonconservative forms'],dynamic:true,
 equation:{tex:String.raw`u_t + (u^2/2)_x = 0;\qquad s = \frac{[f]}{[u]} = \frac{u_L+u_R}{2}`},
 controls:[R('left',['Левое состояние uL','Left state uL'],1,.8,1.6,.1),R('right',['Правое состояние uR','Right state uR'],.2,.1,.6,.05),R('n',['Ячеек N','Cells N'],160,40,320,40)],
 presets:[P(['Базовый скачок','Reference shock'],{left:1,right:.2,n:160}),P(['Сгущение сетки','Refine the grid'],{left:1,right:.2,n:320}),P(['Другие состояния','Different states'],{left:1.6,right:.1,n:160})],
 question:['Сравните положения скачка при сгущении сетки. Почему формально эквивалентная для гладкого u запись u·uₓ становится опасной на разрыве?','Compare shock positions under refinement. Why does u·uₓ, equivalent for smooth u, become problematic at a discontinuity?'],
 explanation:['Сравниваются консервативная схема с потоком Русанова и неконсервативная форма uᵢ(uᵢ−uᵢ₋₁)/h. Точная скорость следует из интегрального закона сохранения. Положение численного скачка оценивается по массе, а не по максимальному градиенту.','A conservative Rusanov flux is compared with the nonconservative form uᵢ(uᵢ−uᵢ₋₁)/h. The exact speed follows from integral conservation. The numerical shock position is measured from mass rather than from the steepest gradient.'],
 caveat:['Здесь uL > uR > 0, границы заданы постоянными состояниями, C = 0.4. Расчёт останавливается до выхода скачка из области.','Here uL > uR > 0, boundary states are fixed, and C = 0.4. The run stops before the shock reaches the boundary.'],sources:['leveque']
},
{
 id:'poisson',group:4,title:['Разностный шаблон как строка матрицы','A finite-difference stencil as a matrix row'],short:['Посмотрите, как граница меняет правую часть','See how the boundary changes the right-hand side'],
 equation:{tex:String.raw`-\Delta u = 0;\qquad 4u_{i,j} - u_{i-1,j} - u_{i+1,j} - u_{i,j-1} - u_{i,j+1} = 0;\qquad A u = b`},
 controls:[R('n',['Внутренних узлов по оси n','Interior nodes per axis n'],6,3,8),R('left',['Значение на левой границе','Left boundary value'],1,0,2,.1),R('right',['Значение на правой границе','Right boundary value'],0,0,2,.1)],
 presets:[P(['Маленькая система','Small system'],{n:4,left:1,right:0}),P(['Две горячие стороны','Two warm boundaries'],{n:7,left:1,right:1})],
 question:['Выберите угловой внутренний узел. Куда делись два внедиагональных элемента и как они попали в правую часть?','Select an interior node next to a corner. Where did two off-diagonal entries go, and how did the boundary values reach the right-hand side?'],
 explanation:['Индексация k = jn + i превращает поле в вектор. Каждая строка матрицы — один локальный шаблон. Известные граничные значения переносятся в b. Верхняя и нижняя границы равны нулю.','The index k = jn + i turns a field into a vector. Each matrix row is one local stencil. Known boundary values move into b. The upper and lower boundaries are zero.'],
 caveat:['Для этой малой учебной системы используется прямое плотное решение с выбором главного элемента. Разреженность описывает структуру оператора. Быстрый разреженный решатель здесь не реализован.','This small teaching system uses a dense direct solve with pivoting. Sparsity describes the operator structure. No fast sparse solver is implemented here.'],sources:['heathHeat']
},
{
 id:'cost',group:5,title:['Цена одного уточнения сетки','The cost of one grid refinement'],short:['Неизвестные × шаги × работа','Unknowns × time steps × work'],
 equation:{tex:String.raw`W \approx N_{\mathrm{dof}} N_{\mathrm{steps}} N_{\mathrm{iter}} C_{\mathrm{op}};\qquad N_{\mathrm{dof}} = q\,n^d`},
 controls:[R('n',['Узлов по координате n','Nodes per coordinate n'],64,16,256,16),S('dim',['Размерность d','Dimension d'],2,[O(1,'1D','1D'),O(2,'2D','2D'),O(3,'3D','3D')]),S('mode',['Ограничение шага','Time-step scaling'],'advection',[O('advection','Перенос: Δt ∼ h','Advection: Δt ∼ h'),O('diffusion','Явная диффузия: Δt ∼ h²','Explicit diffusion: Δt ∼ h²')]),R('variables',['Неизвестных в узле q','Unknowns per node q'],5,1,20),R('iterations',['Итераций на шаг','Iterations per step'],1,1,30)],
 presets:[P(['2D перенос','2D advection'],{dim:2,mode:'advection',n:64}),P(['3D перенос','3D advection'],{dim:3,mode:'advection',n:64}),P(['3D явная диффузия','3D explicit diffusion'],{dim:3,mode:'diffusion',n:64})],
 question:['Уменьшите h вдвое. Почему память выросла в 8 раз, а работа в трёхмерной явной диффузии — в 32 раза?','Halve h. Why does memory grow by 8 while work for three-dimensional explicit diffusion grows by 32?'],
 explanation:['Сравнивается расчёт до фиксированного времени T = 1 в единичной области. Для переноса взято Δt = h/2; для явной диффузии Δt = h²/(2d). Память: три массива binary64 по q неизвестных в узле.','The comparison reaches a fixed T = 1 on a unit domain. Advection uses Δt = h/2; explicit diffusion uses Δt = h²/(2d). Memory counts three binary64 arrays of q unknowns per node.'],
 caveat:['Это прозрачная модель числа операций, не измерение времени на компьютере. C_op = 12 условных операций на неизвестную и итерацию. Коммуникации, геометрия и ввод-вывод не учтены.','This is a transparent operation-count model, not a hardware timing measurement. C_op = 12 illustrative operations per unknown per iteration. Communication, geometry and I/O are excluded.'],sources:['leveque']
}
];
demos.sort((a,b)=>a.group-b.group);
const defaults=demo=>Object.fromEntries(demo.controls.map(c=>[c.key,c.value]));
function translate(value,lang='ru'){return Array.isArray(value)?value[lang==='en'?1:0]:String(value??'');}

return { groups, sources, demos, defaults, translate };
})();
export default moduleValue;
