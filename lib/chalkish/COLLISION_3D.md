# Additive collision-3d entry point

This module is independent of the existing Chalkish 2D implementation. It does not re-export from or modify its `index.js`. Repository source was inaccessible during preparation; compatibility with an unknown upstream HEAD is not asserted.

## Import

```js
import {
  Vec3, Camera3D, Scene3D, ChalkRenderer3D, OrbitControls3D,
  circlePoints, basisFor
} from './lib/chalkish/src/collision-3d.js';

const canvas = document.querySelector('canvas');
const camera = new Camera3D({yaw: -.4, pitch: .25});
const scene = new Scene3D();
scene.cylinder([-2, 0, 0], [2, 0, 0], 1, {color: '#8ec8c1'});
scene.arrow([-3, 0, 0], [3, 0, 0], {color: '#e5e6da'});
scene.label([0, 1, 0], 'd');
const renderer = new ChalkRenderer3D(canvas, {camera});
const render = () => renderer.draw(scene);
const controls = new OrbitControls3D(canvas, camera, render);
render();
// On teardown:
// controls.dispose(); renderer.dispose();
```

Give the canvas an explicit CSS width and height. The renderer owns its backing-store pixel size and updates it with ResizeObserver. Redraw after resize through the `onLayout` callback; the laboratory uses an invalidation flag for this purpose.

## Coordinates and units

Geometry uses ordinary world-space `[x,y,z]` coordinates. Distances are world units. Canvas dimensions, point-marker radii, line widths, arrowhead sizes and label sizes are CSS pixels. Sphere radii are world units. Device pixel ratio is capped at two.

`Camera3D` supports `orthographic` and `perspective`. The camera uses yaw, pitch, distance, zoom, target, near and fov. Call `update()` after changing them. Pitch is clamped away from its singular poles; zoom is bounded. `project(point,width,height)` returns `{x,y,depth,scale}` or null behind the near plane. `clipSegment(a,b)` clips a line against that plane. `ray` and `pickPlane` support interactive picking of disks and planes.

## Scene API

All append methods return `this`: `line`, `polyline`, `polygon`, `sphere`, `point`, `label`, `circle`, `arrow`, `arc`, `cylinder`, `cone`, `sphericalBand`, `annulus`. `clear()` empties the retained list. `items` contains unprojected geometry and style.

Common style fields: `color`, `fill`, `alpha`, `width`, `dash`. Polygon `stroke:false` disables outline. Sphere `ghost:true` gives a translucent outline. Labels accept `size`, `dx`, `dy`, `italic`, `family`; only system fonts are used by default.

`circlePoints(center,normal,radius,segments,start,end)` and `basisFor(normal)` generate planar geometry embedded in 3D. `Vec3` exports add, sub, mul, dot, cross, length, unit and lerp.

## Existing-renderer integration boundary

`Scene3D.project(camera,width,height)` returns copies of retained items with `screen`, the projected points belonging to each item. It is a small inspection/projection adapter, **not** a complete old-Chalkish display list: downstream code must implement clipping, primitive conversion and sorting. Alternatively consume `scene.items` directly.

An actual adapter must be implemented against the real upstream API, after reading that implementation. Keep molecule dynamics, sampling and the lesson narrative outside the generic library. They are in `demos/binary-collision/physics.js`, `chapters.js` and `app.js`.

## Renderer limits

Canvas2D with depth-sorted transparent surfaces, not a WebGL mesh engine. Depth is sorted at primitive/segment-group level. It does not guarantee exact visibility for mutually intersecting translucent surfaces. Lines crossing the near plane are clipped; partially clipped polygons are omitted. Projected sphere markers use a screen-space circular gradient, not ray-traced sphere intersections. The intended scenes are transparent teaching diagrams, not arbitrary opaque CAD meshes.

Labels avoid other labels locally, not every line or external HTML overlay. No lighting, general mesh loader, texture pipeline, WebGL requirement or third-party font assets.

Dispose the controls and renderer on teardown. The module has no import-time DOM side effects; vector math, geometry and cameras are independently testable in Node.
