import { BOARD_RENDER_STYLE } from '../../board-settings.js';
import {
  DSMC_LAB_CASES,
  DsmcLabModel,
  createDsmcLabModel,
  getDsmcLabPreset,
} from '../dsmc-lab/dsmc-lab-model.js';
import { bindDsmcLabView } from '../dsmc-lab/dsmc-lab-view.js';

export {
  DSMC_LAB_CASES,
  DsmcLabModel,
  createDsmcLabModel,
  getDsmcLabPreset,
  bindDsmcLabView,
};

export function createDsmcLabController({
  model: modelOptions = {},
  styleName = BOARD_RENDER_STYLE,
} = {}) {
  const model = createDsmcLabModel(modelOptions);
  const view = bindDsmcLabView(model, { styleName });
  let disposed = false;

  function assertActive() {
    if (disposed) throw new Error('dsmc-lab controller is disposed');
  }

  function update() {
    assertActive();
    model.step(model.parameters.timeStep);
    view.updateView(model.snapshot(), model.diagnostics());
    return controller;
  }

  function reset(parameters = {}) {
    assertActive();
    model.reset(parameters);
    view.updateView(model.snapshot(), model.diagnostics());
    return controller;
  }

  function setStyle(name) {
    assertActive();
    view.setStyle(name);
    return controller;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    view.dispose();
    model.dispose();
  }

  const controller = Object.freeze({
    metadata: model.metadata,
    model,
    view,
    scene: view.scene,
    camera: view.camera,
    update,
    reset,
    setStyle,
    snapshot: (options) => model.snapshot(options),
    diagnostics: () => model.diagnostics(),
    dispose,
  });
  return controller;
}
