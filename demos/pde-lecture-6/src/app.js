import catalog from './catalog.js';
import { createLab } from './labs.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: createLab,
  // Lets the gallery compute catalogue pictures in a worker, off the page thread.
  modules: { catalog: new URL('./catalog.js', import.meta.url), labs: new URL('./labs.js', import.meta.url) },
  lecture: ['Лекция 6', 'Lecture 6'],
  subtitle: ['Потоки и решатели Римана', 'Numerical fluxes and Riemann solvers'],
  text: {
    'catalogue-title': ['Что меняет выбор численного потока?', 'What changes when you choose a different flux?'],
    'catalogue-description': ['Девять потоков, четырнадцать опытов: контакт, энтропия, положительность и ударная неустойчивость.', 'Nine fluxes, fourteen experiments: contact, entropy, positivity, and shock instability.'],
  },
  debugName: 'PDE6',
});


