import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { friendlyAuthErrorMessage } from '../api/errorMessages';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await register(name, email, password, passwordConfirmation);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setFieldErrors(err.errors);
      } else {
        setError(friendlyAuthErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function fieldError(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <Field
          id="name"
          label="Nome"
          value={name}
          onChange={setName}
          error={fieldError('name')}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldError('email')}
        />
        <Field
          id="password"
          label="Palavra-passe"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldError('password')}
        />
        <Field
          id="password_confirmation"
          label="Confirmar palavra-passe"
          type="password"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          error={fieldError('password_confirmation')}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-accent px-4 py-2 font-semibold text-background disabled:opacity-50"
        >
          Criar conta
        </button>
        <p className="text-sm">
          Já tens conta?{' '}
          <Link to="/login" className="text-accent">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded border border-white/20 bg-transparent px-3 py-2"
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
