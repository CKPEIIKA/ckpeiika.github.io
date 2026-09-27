import catalog from './catalog.js';
import { createLab } from './labs.js';
import { mountPdePreview } from './preview.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: createLab,
  lecture: ['Лекция 2', 'Lecture 2'],
  subtitle: ['Уравнения в частных производных', 'Partial differential equations'],
  text: {
    'catalogue-title': ['Что описывают уравнения в частных производных', 'What partial differential equations describe'],
    'catalogue-description': ['Семнадцать опытов: поля, потоки, волны и характеристики.', 'Seventeen experiments: fields, fluxes, waves and characteristics.'],
  },
  debugName: 'PDE2',
  // The experiments are live Chalkish scenes, so the catalogue shows their chalk sketches.
  preview(host, demo) {
    const canvas = document.createElement('canvas');
    canvas.className = 'board-canvas';
    canvas.width = 480;
    canvas.height = 280;
    host.append(canvas);
    return mountPdePreview(canvas, { id: demo.id });
  },
});
