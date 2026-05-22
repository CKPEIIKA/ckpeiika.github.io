---
layout: default
title: Полезные ссылки
nav_label: "🔗 Полезные ссылки"
---

Коллекция полезных ссылок по CFD, OpenFOAM и ML.

---

## OpenFOAM

- [OpenFOAM Foundation (.org)](https://openfoam.org/) — официальный сайт ветки Foundation.
- [About OpenFOAM (CFD Direct)](https://cfd.direct/openfoam/about/) — кто разрабатывает и распространяет OpenFOAM Foundation.
- [OpenCFD / OpenFOAM.com](https://www.openfoam.com/) — официальный сайт ветки OpenCFD.
- [OpenCFD History](https://www.openfoam.com/news/history) — официальная хронология со стороны OpenCFD.
- [OpenFOAM Documentation Overview](https://www.openfoam.com/documentation/overview) — официальная документация и архитектура OpenFOAM.
- [OpenFOAM Development Wiki](https://develop.openfoam.com/Development/openfoam/-/wikis/home) — разработка, внутреннее устройство, best practices.
- [OpenFOAM Community Wiki](https://wiki.openfoam.com/)  
  Сообщественная база знаний: туториалы, кейсы, расширения, статьи.
- [CFD Direct Technical Articles](https://www.openfoam.com/documentation/guides/latest/doc/technical-guides.html)  
  Продвинутые материалы от разработчиков OpenFOAM.
- [Basics of C++ for OpenFOAM (Håkan Nilsson)](https://wiki.openfoam.com/Basics_of_C%2B%2B_by_Hakan_Nilsson) — база для написания собственных солверов.
- [“3 weeks” OpenFOAM series](https://wiki.openfoam.com/%223_weeks%22_series) — интенсив по OpenFOAM.
- [Curiosity Fluids](https://curiosityfluids.com/) — практические кейсы и обучающие материалы.
- [Wolf Dynamics Tutorials](http://www.wolfdynamics.com/index.php) — пошаговые уроки по OpenFOAM.
- [OpenFOAM Jozsef Nagy (YouTube)](https://www.youtube.com/@OpenFOAMJozsefNagy) — видеоразборы физики и численных методов.

> 📝 Примечание о форках OpenFOAM  
> Сейчас фактически существуют две официально поддерживаемые ветки экосистемы:  
> **OpenFOAM Foundation / CFD Direct**: [openfoam.org](https://openfoam.org/), [cfd.direct/openfoam/about](https://cfd.direct/openfoam/about/)  
> **OpenCFD / OpenFOAM Ltd**: [openfoam.com](https://www.openfoam.com/), [openfoam.com/news/history](https://www.openfoam.com/news/history)  
> Если нужна историческая справка, лучше ссылаться на эти официальные страницы, а не на форумные обсуждения.
>
> Но форумный тред все равно жалко выбрасывать: [легендарная ветка на CFD Online](https://www.cfd-online.com/Forums/openfoam/197150-openfoam-com-versus-openfoam-org-version-use.html). Как источник это слабее, как культурный артефакт сообщества вполне годится.


---

## CFD

- [CFD Online](https://www.cfd-online.com/) — форумы, статьи, обсуждения.
- [CFD Training Articles](https://cfd-training.com/articles-2/) — короткие обучающие статьи.
- [Holzmann CFD](https://holzmann-cfd.com/) — теория и практика CFD.
- [OS CFD Courses (Chalmers)](https://www.tfd.chalmers.se/~hani/kurser/OS_CFD/) — университетские курсы.
- [Milovan Perić CFD (YouTube)](https://www.youtube.com/@MilovanPericCFD/videos) — численные методы и физическая интерпретация.
- [CFD-ZJW Blog](http://cfd-zjw.blogspot.com/) — практические CFD-примеры.
- [A Complete Learning Path for CFD](https://jahid-hasan.com/writings/a-complete-learning-path-for-cfd/) — карта дисциплины.
- [Method of Characteristics](https://kyleniemeyer.github.io/gas-dynamics-notes/compressible-flows/method-characteristics.html) — газовая динамика, метод характеристик.
- [Pipe Flow Verification (Barba Group)](https://github.com/barbagroup/pipe_verification/tree/main) — верификация численных схем.
- [Capella CFD Archive](http://web.archive.org/web/20060208175919/http://capella.colorado.edu/~laney/otherbooks.htm) — архив классических CFD-книг авторства  в т.ч.Laney.

## ML + CFD 

- [Machine Learning Applied to CFD — Literature](https://github.com/AndreWeiner/machine-learning-applied-to-cfd/blob/master/literature.md) — отличный литобзор.
- [TensorFlowFoam](https://github.com/argonne-lcf/TensorFlowFoam) — Пример ML-интеграция с OpenFOAM.
- [PythonFOAM](https://github.com/argonne-lcf/PythonFOAM) — Python ↔ OpenFOAM.
- [DEGANN](https://github.com/Krekep/degann) — ML + дифференциальные уравнения.
- [Numerical Tours (Peyré)](https://nbviewer.org/github/gpeyre/numerical-tours/tree/master/python/) — численные методы и ML.
- [CS231n: Optimization](https://cs231n.github.io/optimization-2/) — градиентные методы.
- [Understanding Deep Learning (UDL Book)](https://udlbook.github.io/udlbook/)
- [RLHF Book](https://rlhfbook.com/)
- [ODEs & SDEs for Machine Learning](https://rbcborealis.com/research-blogs/odes-and-sdes-for-machine-learning/)
- [Awesome AI for CFD](https://github.com/WillDreamer/Awesome-AI4CFD)  
  Еще один список статей, кодов и датасетов по ML+CFD.
- [NVIDIA PhysicsNeMo (ex-Modulus)](https://developer.nvidia.com/physicsnemo)  
  Physics-informed ML, PINNs, neural operators, ускорение CFD на GPU.
- [DeepXDE](https://github.com/lululxvi/deepxde)  
  PINN-фреймворк для решения PDE и задач CFD.
- [PhiFlow](https://github.com/tum-pbs/PhiFlow)  
  Дифференцируемый фреймворк для симуляции уравнений в частных производных.

## Высокоскоростные потоки

- [hy2Foam](https://hystrath.github.io/solvers/fleming/hy2foam/)  
  Гиперзвуковой солвер на базе OpenFOAM: 2T-модели, химия, MHD.
- [Eilmer (University of Queensland)](https://github.com/gdtk-uq/gdtk)  
  Реальный газ, гиперзвуковые течения, ударные трубы, CHT.
- [SU2](https://su2code.github.io/)  
  Продвинутый Стэнфордский решатель, тоже с 2Т и химией.
- [SU2 Documentation](https://su2code.github.io/docs/)  
  Подробная официальная документация и туториалы.
- [COOLFluiD](https://andrealani.github.io/COOLFluiD/)  
  Объектно-ориентированная HPC-платформа для CFD и мультифизики.
- [COREFL-CPC](https://github.com/Liangerty/COREFL-CPC) -- решатель на GPU (CUDA).
- [Clawpack Riemann Book](http://www.clawpack.org/riemann_book/) -- книга по решению задачи Римана с примерами на Python.

## Математика и механика

- [Structure and Interpretation of Classical Mechanics (SICM)](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/9579/sicm_edition_2.zip/toc.html)  
  Лагранжева и гамильтонова механика, ОДУ, вариационные принципы.  
- [Classics of Probability & Statistics (UChicago)](http://www.stat.uchicago.edu/~lekheng/courses/302/classics/index.html)  
  Классические тексты по вероятности и статистике.
- [Практикум МГУ](https://gidropraktikum.narod.ru/equations-of-hydrodynamics.htm)

## Прочее

- [Structure and Interpretation of Computer Programs (SICP)](https://sarabander.github.io/sicp/html/index.xhtml)  
 Новый завет для computer science.
- [SciPy Examples](https://scipython.com/book2/chapter-8-scipy/examples/)  
  Примеры по SciPy.
- [Russian PhD LaTeX Dissertation Template](https://github.com/AndreyAkinshin/Russian-Phd-LaTeX-Dissertation-Template)  
  Шаблон для научных текстов.
- [LaTeX G7-32](https://github.com/latex-g7-32/latex-g7-32)  
  ГОСТ-ориентированная верстка.
