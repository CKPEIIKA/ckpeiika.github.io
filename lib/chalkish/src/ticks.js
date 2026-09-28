// Readable axis ticks: steps of 1, 2, 2.5 or 5 × 10^k and labels with only the digits the
// step needs. No imports, so plain Canvas 2D code can use it without loading the renderer.

const MANTISSAS = [[1.5, 1], [2.25, 2], [3.5, 2.5], [7, 5]];

export function niceStep(span, count = 5) {
  if (!(Number.isFinite(span) && span > 0)) throw new RangeError('span must be positive and finite');
  if (!(Number.isInteger(count) && count >= 1)) throw new RangeError('count must be a positive integer');
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const mantissa = MANTISSAS.find(([limit]) => fraction < limit)?.[1] ?? 10;
  return mantissa * power;
}

// Digits after the leading one that the step needs: 0 for 1, 2, 5 × 10^k and 1 for 2.5 × 10^k.
function stepDigits(step) {
  const mantissa = step / 10 ** Math.floor(Math.log10(step) + 1e-9);
  return Math.abs(mantissa - Math.round(mantissa)) > 1e-6 ? 1 : 0;
}

function stepDecimals(step) {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + stepDigits(step));
}

// Tick values inside [min, max], about `count` intervals apart and at least two of them.
export function niceTicks(min, max, count = 5) {
  if (!(Number.isFinite(min) && Number.isFinite(max))) throw new RangeError('tick range must be finite');
  if (min > max) throw new RangeError('tick range min must not exceed max');
  if (min === max) return { step: 0, values: [min] };
  let step = niceStep(max - min, count);
  // Rounding the step up can leave fewer than two ticks inside the range: take the next
  // smaller nice step until two fit.
  while (Math.floor(max / step + 1e-9) - Math.ceil(min / step - 1e-9) < 1) {
    const power = 10 ** Math.floor(Math.log10(step) + 1e-9);
    const mantissa = step / power;
    step = (mantissa > 4.9 ? 2.5 : mantissa > 2.4 ? 2 : mantissa > 1.9 ? 1 : 0.5) * power;
  }
  const decimals = Math.min(20, stepDecimals(step));
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  const values = [];
  for (let index = first; index <= last; index += 1) {
    // Round away binary noise such as 0.30000000000000004; `+ 0` turns -0 into 0.
    values.push(Number((index * step).toFixed(decimals)) + 0);
  }
  return { step, values };
}

// Label for a tick value, without trailing zeros; very small or very large scales use exponent notation.
export function formatTick(value, step) {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const scale = Math.max(Math.abs(value), step > 0 ? step : 0);
  if (step > 0 && step < 1e-3 || scale >= 1e5) {
    const digits = step > 0
      ? Math.max(0, Math.floor(Math.log10(Math.abs(value))) - Math.floor(Math.log10(step) + 1e-9) + stepDigits(step))
      : 2;
    const [mantissa, exponent] = value.toExponential(Math.min(20, digits)).split('e');
    return `${Number(mantissa)}e${Number(exponent)}`;
  }
  return String(Number(value.toFixed(step > 0 ? Math.min(20, stepDecimals(step)) : 2)) + 0);
}

// [min, max] widened outward to round tick values, so axes stay put while data moves inside
// them. A zero-width range is opened around its value.
export function niceBounds(min, max, count = 4) {
  if (!(Number.isFinite(min) && Number.isFinite(max))) throw new RangeError('bounds must be finite');
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, count);
  const decimals = Math.min(20, stepDecimals(step));
  return [
    Number((Math.floor(min / step + 1e-9) * step).toFixed(decimals)) + 0,
    Number((Math.ceil(max / step - 1e-9) * step).toFixed(decimals)) + 0,
  ];
}
