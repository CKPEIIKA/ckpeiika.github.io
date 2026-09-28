// Catalogue pictures: the experiment's own view at its default (or thumbParams) state.
// Pure: runs in the page and in thumbnail-worker.js.

export function thumbnailCommands(catalog, createLab, demo, lang) {
  const model = createLab(demo.id, { ...catalog.defaults(demo), ...demo.thumbParams }, lang);
  if (demo.dynamic) for (let j = 0; j < (demo.thumbSteps ?? 12); j += 1) model.step();
  // Same mathematical view as the laboratory; only titles and footnotes are left out.
  return model.render().ink.cmd.filter((c) => (c.type !== 'text' && c.type !== 'math') || (c.y > 70 && c.y < 520));
}

export function labFactory(module) {
  return module.createLab ?? module.default?.createLab;
}
