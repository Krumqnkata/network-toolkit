export type AppErrorCode =
  | 'native-unavailable'
  | 'invalid-native-data'
  | 'permission-denied'
  | 'network'
  | 'unknown';

/** The single error type surfaced to the UI. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  override readonly cause: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

const NATIVE_CODE_MAP: Record<string, AppErrorCode> = {
  E_PERMISSION: 'permission-denied',
  E_NETWORK: 'network',
};

/** Normalizes anything thrown (including native promise rejections) into an AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    const nativeCode = (error as Error & { code?: unknown }).code;
    const code =
      typeof nativeCode === 'string' ? NATIVE_CODE_MAP[nativeCode] ?? 'unknown' : 'unknown';
    return new AppError(code, error.message, error);
  }
  return new AppError('unknown', String(error), error);
}

/** Development-only diagnostic logging; silent in release builds. */
export function logError(context: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, error);
  }
}
