import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setFieldErrors(null);
    try {
      await register(name, email, password, passwordConfirmation);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors ?? null);
        setError(err.errors ? null : err.message);
      } else {
        setError('Ocorreu um erro inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Criar conta</h1>
      {error && <p role="alert">{error}</p>}
      {fieldErrors &&
        Object.values(fieldErrors)
          .flat()
          .map((message) => (
            <p role="alert" key={message}>
              {message}
            </p>
          ))}
      <label htmlFor="name">Nome</label>
      <input id="name" value={name} onChange={(event) => setName(event.target.value)} />
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label htmlFor="password">Palavra-passe</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label htmlFor="password_confirmation">Confirmar palavra-passe</label>
      <input
        id="password_confirmation"
        type="password"
        value={passwordConfirmation}
        onChange={(event) => setPasswordConfirmation(event.target.value)}
      />
      <button type="submit" disabled={isSubmitting}>
        Criar conta
      </button>
    </form>
  );
}
