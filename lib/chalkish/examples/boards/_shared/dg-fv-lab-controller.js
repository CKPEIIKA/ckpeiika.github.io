import { BOARD_RENDER_STYLE } from '../../board-settings.js';
import {
  DG_FV_CASES,
  DG_FV_DISPLAY_FIELDS,
  DG_FV_INITIAL_CONDITIONS,
  DgFvLabModel,
  createDgFvLabModel,
} from '../dg-fv-lab/dg-fv-lab-model.js';
import { bindDgFvLabView } from '../dg-fv-lab/dg-fv-lab-view.js';
import { createProfileDemoController } from '../../cfd-demos/_shared/profile-demo-controller.js';

export {
  DG_FV_CASES,
  DG_FV_DISPLAY_FIELDS,
  DG_FV_INITIAL_CONDITIONS,
  DgFvLabModel,
  createDgFvLabModel,
  bindDgFvLabView,
};

export function createDgFvLabController({
  model: modelOptions = {},
  styleName = BOARD_RENDER_STYLE,
} = {}) {
  const model = createDgFvLabModel(modelOptions);
  const view = bindDgFvLabView(model, { styleName });
  return createProfileDemoController({
    id: 'dg-fv-lab',
    model,
    view,
  });
}
