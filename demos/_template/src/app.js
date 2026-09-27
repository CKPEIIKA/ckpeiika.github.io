// Lecture configuration. Everything else (catalogue, controls, playback, language, theme,
// phone layout) comes from the shared gallery in ../../pde-gallery/.

import catalog from './catalog.js';
import { createLab } from './labs.js';
import { startGallery } from '../../pde-gallery/gallery.js';

startGallery({
  catalog,
  createModel: createLab,
  // Lets the gallery compute catalogue pictures in a worker, off the page thread.
  modules: { catalog: new URL('./catalog.js', import.meta.url), labs: new URL('./labs.js', import.meta.url) },
  lecture: ['Лекция {{N}}', 'Lecture {{N}}'],
  subtitle: ['{{TITLE_RU}}', '{{TITLE_EN}}'],
  text: {
    'catalogue-title': ['{{QUESTION_RU}}', '{{QUESTION_EN}}'],
    'catalogue-description': ['{{SUMMARY_RU}}', '{{SUMMARY_EN}}'],
  },
  debugName: 'PDE{{N}}',
  // Optional: plain-text notes. Export them from src/notes.js, import them here and pass `notes`.
  // A source whose url is './SOURCES.md' then opens that text in a dialog.
});
