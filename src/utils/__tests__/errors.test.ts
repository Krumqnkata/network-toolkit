import { AppError, toAppError } from '../errors';

describe('toAppError', () => {
  it('passes AppErrors through unchanged', () => {
    const error = new AppError('network', 'offline');
    expect(toAppError(error)).toBe(error);
  });

  it('maps known native rejection codes', () => {
    const native = Object.assign(new Error('nope'), { code: 'E_PERMISSION' });
    const result = toAppError(native);
    expect(result.code).toBe('permission-denied');
    expect(result.message).toBe('nope');
    expect(result.cause).toBe(native);
  });

  it('treats unknown errors and non-Error values as unknown', () => {
    expect(toAppError(new Error('boom')).code).toBe('unknown');
    expect(toAppError(Object.assign(new Error('x'), { code: 'E_OTHER' })).code).toBe('unknown');
    expect(toAppError('plain string')).toMatchObject({ code: 'unknown', message: 'plain string' });
  });
});
