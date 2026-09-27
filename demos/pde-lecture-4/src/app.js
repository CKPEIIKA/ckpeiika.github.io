import catalog from './catalog.js';
import labs from './labs.js';
import notes from './notes.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: labs.createLab,
  // Lets the gallery compute catalogue pictures in a worker, off the page thread.
  modules: { catalog: new URL('./catalog.js', import.meta.url), labs: new URL('./labs.js', import.meta.url) },
  lecture: ['Лекция 4', 'Lecture 4'],
  subtitle: ['Свойства разностных схем', 'Properties of difference schemes'],
  text: {
    'catalogue-title': ['Почему вычислению можно доверять?', 'Why should we trust a computation?'],
    'catalogue-description': ['Пятнадцать опытов: невязка, усиление ошибок, границы и проверка кода.', 'Fifteen experiments: residuals, error amplification, boundaries and code verification.'],
  },
  debugName: 'PDE4',
  notes,
});
