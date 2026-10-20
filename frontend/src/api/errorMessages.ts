import { ApiError } from './client';

export function friendlyErrorMessage(err: unknown, statusOverrides: Partial<Record<number, string>> = {}): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Sem ligação à internet. Tenta novamente.';
    if (statusOverrides[err.status]) return statusOverrides[err.status]!;
    return err.message;
  }
  return 'Ocorreu um erro inesperado.';
}

export function friendlyAuthErrorMessage(err: unknown): string {
  return friendlyErrorMessage(err, { 401: 'Email ou palavra-passe incorretos.' });
}
