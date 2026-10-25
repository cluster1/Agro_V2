import { BadRequestException } from '@nestjs/common';

/** Parses an optional integer query param, enforcing [min, max]; missing/empty -> fallback. */
export function parseBoundedInt(name: string, value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BadRequestException(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}
