function validateInput(values, spacing, first, second) {
  if (!values || typeof values.length !== 'number') {
    throw new TypeError('values must be an array-like buffer');
  }
  if (values.length < 4) {
    throw new RangeError('values must contain at least four samples');
  }
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new RangeError('spacing must be a positive finite number');
  }
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      throw new TypeError(`values[${index}] must be finite`);
    }
  }
  for (const [output, name] of [[first, 'first'], [second, 'second']]) {
    if (!output || typeof output.length !== 'number' || output.length < values.length) {
      throw new RangeError(`${name} must provide at least ${values.length} entries`);
    }
  }
  if (first === second || first === values || second === values) {
    throw new TypeError('values, first, and second must be distinct buffers');
  }
}

/**
 * First and second derivatives of uniformly spaced scalar samples.
 *
 * Caller-owned output buffers are filled in place. Interior values use centered
 * differences; the two endpoints use matching one-sided formulas.
 */
export function differentiateUniform1D(values, spacing, first, second) {
  validateInput(values, spacing, first, second);
  const count = values.length;
  const inverseTwoSpacing = 0.5 / spacing;
  const inverseSpacingSquared = 1 / (spacing * spacing);

  first[0] = (-3 * values[0] + 4 * values[1] - values[2]) * inverseTwoSpacing;
  second[0] = (
    2 * values[0] - 5 * values[1] + 4 * values[2] - values[3]
  ) * inverseSpacingSquared;

  for (let index = 1; index < count - 1; index += 1) {
    first[index] = (values[index + 1] - values[index - 1]) * inverseTwoSpacing;
    second[index] = (
      values[index + 1] - 2 * values[index] + values[index - 1]
    ) * inverseSpacingSquared;
  }

  const last = count - 1;
  first[last] = (
    3 * values[last] - 4 * values[last - 1] + values[last - 2]
  ) * inverseTwoSpacing;
  second[last] = (
    2 * values[last] - 5 * values[last - 1]
    + 4 * values[last - 2] - values[last - 3]
  ) * inverseSpacingSquared;
  return { first, second };
}
