// Chalkish reference: a hidden lecture whose experiments each show one group of library
// primitives. Linked from nowhere on the site; see lib/chalkish/docs/BOARD_PLAN.md.

import catalog from './catalog.js';
import { createLab, mountPane } from './labs.js';
import { PANES } from './panes.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: createLab,
  lecture: ['Chalkish', 'Chalkish'],
  subtitle: ['Справочник примитивов', 'Primitive reference'],
  text: {
    'catalogue-title': ['Что умеет доска Chalkish', 'What the Chalkish board can do'],
    'catalogue-description': [
      'Десять опытов, по одному на группу примитивов: формулы, графики, анимация, раскладка, поля, данные. Код каждого — пример для новых демонстраций.',
      'Ten experiments, one per group of primitives: formulas, plots, animation, layout, fields, data. The code of each is an example for new demos.',
    ],
  },
  debugName: 'ChalkishReference',
  // The catalogue pictures are the panes themselves at their default settings.
  preview(host, demo) {
    const params = catalog.defaults(demo);
    return mountPane(host, PANES[demo.id](params, document.documentElement.lang === 'en' ? 'en' : 'ru'), { className: 'board-canvas' });
  },
});
