export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

/** Uniform error body returned by every failing request. */
export interface ErrorBody {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string[]>;
}

// Fixed Indonesian text for statuses whose original message could leak detail or is framework English.
export const FIXED_MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.',
  FORBIDDEN: 'Anda tidak memiliki akses untuk tindakan ini.',
  NOT_FOUND: 'Data tidak ditemukan.',
  TOO_MANY_REQUESTS: 'Terlalu banyak permintaan. Coba lagi beberapa saat.',
  INTERNAL_ERROR: 'Terjadi kesalahan pada server. Silakan coba lagi.',
  VALIDATION_ERROR: 'Data yang dikirim tidak valid.',
};

export function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'BUSINESS_RULE';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BUSINESS_RULE';
  }
}
