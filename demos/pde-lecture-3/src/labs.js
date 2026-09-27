// The lecture's model factory, like every gallery lecture's src/labs.js.
import staticLabs from './labs-static.js';
import evolvingLabs from './labs-evolve.js';

export function createLab(id, params, lang = 'ru') {
  const model = staticLabs.createStatic(id, params, lang) || evolvingLabs.createEvolving(id, params, lang);
  if (!model) throw new Error(`Unknown experiment: ${id}`);
  return model;
}

export default { createLab };
