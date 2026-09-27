import catalog from './catalog.js';
import { createLab } from './labs.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: createLab,
  // Lets the gallery compute catalogue pictures in a worker, off the page thread.
  modules: { catalog: new URL('./catalog.js', import.meta.url), labs: new URL('./labs.js', import.meta.url) },
  lecture: ['Лекция 3', 'Lecture 3'],
  subtitle: ['Сеточные методы и разностные схемы', 'Grid methods and finite differences'],
  text: {
    'catalogue-title': ['Что делает разностная схема с данными', 'What a finite-difference scheme does to data'],
    'catalogue-description': ['Смотрим на сеточные данные, работу операторов и сохранение величин.', 'See grid data, operator actions, and conserved quantities.'],
  },
  debugName: 'PDE3',
});
