import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  loginRequest,
  logoutRequest,
  meRequest,
  registerRequest,
  type User,
} from '../api/auth';

const TOKEN_KEY = 'lbike_token';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);

      if (storedToken) {
        try {
          const { user: restoredUser } = await meRequest(storedToken);
          setToken(storedToken);
          setUser(restoredUser);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }

      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const { user: loggedInUser, token: newToken } = await loginRequest({ email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(loggedInUser);
  }

  async function register(name: string, email: string, password: string) {
    const { user: newUser, token: newToken } = await registerRequest({
      name,
      email,
      password,
      password_confirmation: password,
    });
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function logout() {
    if (token) {
      try {
        await logoutRequest(token);
      } catch {
        // Revoking a token that's already invalid is not a reason to keep the local session.
      }
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
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
