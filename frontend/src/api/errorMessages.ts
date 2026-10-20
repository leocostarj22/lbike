import { ApiError } from './client';

export function friendlyAuthErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Sem ligação à internet. Tenta novamente.';
    if (err.status === 401) return 'Email ou palavra-passe incorretos.';
    return err.message;
  }
  return 'Ocorreu um erro inesperado.';
}
