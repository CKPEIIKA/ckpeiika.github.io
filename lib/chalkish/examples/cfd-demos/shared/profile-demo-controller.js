export function createProfileDemoController({
  id,
  model,
  view,
}) {
  let disposed = false;

  function assertActive() {
    if (disposed) throw new Error(`${id} controller is disposed`);
  }

  function update(dt) {
    assertActive();
    model.step(dt);
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
