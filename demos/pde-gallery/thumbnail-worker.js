// Computes catalogue pictures off the page thread; the page only paints the returned commands.
import { labFactory, thumbnailCommands } from './thumbnails.js';

globalThis.addEventListener('message', async ({ data: { catalogUrl, labsUrl, lang } }) => {
  const catalog = (await import(catalogUrl)).default;
  const createLab = labFactory(await import(labsUrl));
  for (const demo of catalog.demos) {
    try {
      globalThis.postMessage({ id: demo.id, cmd: thumbnailCommands(catalog, createLab, demo, lang) });
    } catch (error) {
      globalThis.postMessage({ id: demo.id, error: String(error?.stack ?? error) });
    }
  }
});
