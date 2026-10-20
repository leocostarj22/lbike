import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  registerRequest,
  loginRequest,
  meRequest,
  logoutRequest,
  type User,
} from '../api/auth';
import { ApiError } from '../api/client';

const TOKEN_KEY = 'lbike_token';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  token: string | null;
  register(
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      return;
    }

    meRequest(storedToken)
      .then(({ user }) => {
        setUser(user);
      })
      .catch((err) => {
        // Only a confirmed-invalid token is cleared. A network failure or
        // server error leaves the token in place so a later retry (e.g.
        // reopening the app once back online) can restore the session
        // without forcing the user to log in again.
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  function storeSession(user: User, token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    setToken(token);
    setUser(user);
  }

  async function register(
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ) {
    const { user, token } = await registerRequest(name, email, password, passwordConfirmation);
    storeSession(user, token);
  }

  async function login(email: string, password: string) {
    const { user, token } = await loginRequest(email, password);
    storeSession(user, token);
  }

  async function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await logoutRequest(token);
      } catch {
        // best-effort revoke; nothing useful to show the user if this fails
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, token, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
