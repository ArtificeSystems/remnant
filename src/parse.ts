import type { Remnant } from './remnant.js';
import { remnantShape, validateRemnant } from './schema.js';
import { RemnantValidationError } from './create.js';

export function parseRemnant(json: string | unknown): Remnant {
  const value = typeof json === 'string' ? JSON.parse(json) : json;
  const result = validateRemnant(value);
  if (!result.ok) {
    throw new RemnantValidationError(result.errors);
  }
  return remnantShape.parse(value) as Remnant;
}
