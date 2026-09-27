import catalog from './catalog.js';
import labs from './labs.js';
import notes from './notes.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: labs.createLab,
  // Lets the gallery compute catalogue pictures in a worker, off the page thread.
  modules: { catalog: new URL('./catalog.js', import.meta.url), labs: new URL('./labs.js', import.meta.url) },
  lecture: ['Лекция 5', 'Lecture 5'],
  subtitle: ['Построение разностных схем', 'Constructing difference schemes'],
  text: {
    'catalogue-title': ['Как строить схемы для разрывных решений?', 'How do we construct schemes for discontinuities?'],
    'catalogue-description': ['Четырнадцать опытов: линейный шаг, монотонность, ограничители и ENO/WENO.', 'Fourteen experiments: linear updates, monotonicity, limiters and ENO/WENO.'],
  },
  debugName: 'PDE5',
  notes,
  // A new initial profile discards the hand-drawn values of the total-variation experiment.
  onControlChange(demo, key, params) {
    if (key === 'profile') delete params.values;
  },
});
