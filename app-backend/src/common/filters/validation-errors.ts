import { BadRequestException, ValidationError } from '@nestjs/common';
import { ErrorBody, FIXED_MESSAGES } from './error-codes';

// Indonesian text per class-validator constraint; the field name is prefixed by the caller.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  isNotEmpty: 'wajib diisi',
  isDefined: 'wajib diisi',
  isString: 'harus berupa teks',
  isEmail: 'format email tidak valid',
  isInt: 'harus berupa bilangan bulat',
  isNumber: 'harus berupa angka',
  isBoolean: 'harus berupa true/false',
  isIn: 'nilai tidak diizinkan',
  isEnum: 'nilai tidak diizinkan',
  isDateString: 'format tanggal tidak valid',
  isDate: 'format tanggal tidak valid',
  isArray: 'harus berupa daftar',
  isUUID: 'format ID tidak valid',
  min: 'nilai terlalu kecil',
  max: 'nilai terlalu besar',
  minLength: 'terlalu pendek',
  maxLength: 'terlalu panjang',
  matches: 'format tidak valid',
  whitelistValidation: 'tidak dikenali',
};

function flatten(errors: ValidationError[], parent: string, out: Record<string, string[]>): void {
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) {
      out[path] = Object.keys(e.constraints).map((k) => CONSTRAINT_MESSAGES[k] ?? 'nilai tidak valid');
    }
    if (e.children?.length) flatten(e.children, path, out);
  }
}

/** ValidationPipe exceptionFactory: one 400 carrying per-field messages. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fields: Record<string, string[]> = {};
  flatten(errors, '', fields);
  const body: ErrorBody = { code: 'VALIDATION_ERROR', message: FIXED_MESSAGES.VALIDATION_ERROR!, fields };
  return new BadRequestException(body);
}
