/**
 * Shared rendering policy for every bundled board.
 *
 * This is deliberately not a widget setting. Examples should look like one
 * physical chalkboard by default; applications embedding Chalkish may still
 * choose another preset through the public view/controller APIs.
 */

export const BOARD_RENDER_STYLE = 'dusty';

export const BOARD_RENDER_POLICY = Object.freeze({
  styleName: BOARD_RENDER_STYLE,
  exposed: false,
  source: 'global-example-policy',
});
