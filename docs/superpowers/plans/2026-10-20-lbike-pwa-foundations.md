# LBike PWA Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new PWA frontend (React + Vite) with working auth
against the existing Laravel API, a 5-tab navigation shell, and installable
PWA manifest/icons — replacing the discontinued React Native/Expo client.

**Architecture:** A new `frontend/` Vite + React + TypeScript app, talking to
the already-built `backend/` Laravel API (Sanctum bearer tokens, unchanged)
over `fetch`. Auth state lives in a React Context backed by `localStorage`.
`react-router-dom` provides a public area (login/register) and a protected
area (5-tab shell with placeholder screens for tabs not yet built).
`vite-plugin-pwa` makes the app installable.

**Tech Stack:** React + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`),
react-router-dom, vite-plugin-pwa, Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-19-lbike-design.md`

## Global Constraints

- All user-visible text in European Portuguese (navigation, buttons,
  validation messages, empty/loading states) — per spec "Identidade visual
  e navegação". Code identifiers (variables, functions, routes) stay in
  English.
- Product name displayed in the UI and in the PWA manifest: **LBike**.
- Visual identity (exact values, this plan's call per spec's "builder's
  call" on exact design): background/base `#1A1A1A` (cinza-carvão), accent
  `#A3E635` (verde-lima). Every task that renders UI uses these as the
  Tailwind theme's `background`/`accent` tokens, not ad-hoc hex values.
- Auth is **bearer-token**, not cookie/session — mirrors how the API is
  already built (`createToken()->plainTextToken` from Sanctum, no CSRF
  cookie dance). Token persists in `localStorage` under key `lbike_token`.
- Backend API base path: `/api/v1` (e.g. `/api/v1/register`). Base URL
  comes from `VITE_API_URL` (frontend/.env, gitignored — never commit it,
  mirrors how `mobile/.env` was handled).
- The exact request/response shapes below are the real, already-running
  backend contract (`backend/app/Http/Controllers/Api/AuthController.php`,
  `backend/routes/api.php`) — do not guess alternate field names:
  - `POST /register` body `{name, email, password, password_confirmation}`
    → 201 `{user: {id, name, email}, token}`; 422
    `{message, errors: {field: [messages]}}` on validation failure.
  - `POST /login` body `{email, password}` → 200 `{user, token}`; 401
    `{message: "Invalid credentials."}`.
  - `GET /me` (Bearer token) → 200 `{user: {id, name, email}}`; 401 on
    invalid/expired token.
  - `POST /logout` (Bearer token) → 204 No Content.
- No backend changes are in scope for this plan. Laravel's default CORS
  config (no `config/cors.php` published) already allows all origins on
  `api/*`, so no CORS work is needed for the Vite dev server to reach it.
- Component library: shadcn/ui is the spec's long-term choice, but this
  plan's forms are simple enough for plain Tailwind-styled elements.
  Defer the shadcn/ui CLI/tooling to the plan that first needs its
  variety of components (avoids an interactive-CLI dependency here).

## Review Focus

- **Stale/invalid stored token on app load** (user revoked elsewhere, or
  token expired): must clear it and show the login screen, not loop or
  render a broken authenticated shell. Covered in Task 3.
- **Field-level validation errors from `/register`'s 422 response**: must
  surface next to the relevant field, not just a generic banner. Covered
  in Task 5.
- **Network failure (no connectivity) on login/register**: must show a
  clear, recoverable error state, never a blank screen or silent no-op —
  ties to the spec's anti-objetivo against promising untested behaviour.
  Covered in Tasks 2 and 5.
- **Direct navigation to a protected route while logged out** (e.g. typing
  `/profile` in the address bar): must redirect to `/login`, not render a
  partially-loaded protected screen. Covered in Task 4.
- **Double-submitting a login/register form** (impatient double click):
  must not fire a second overlapping request or leave the button in an
  inconsistent state. Covered in Task 5.

---

### Task 1: Project scaffold, Tailwind, Vitest harness, PWA plumbing

**Files:**
- Create: `frontend/` (via `npm create vite@latest frontend -- --template react-ts`)
- Create: `frontend/src/pwa.config.ts`
- Create: `frontend/vite.config.ts` (modify the generated one)
- Create: `frontend/src/index.css` (Tailwind v4 import)
- Create: `frontend/src/App.tsx` (temporary placeholder root)
- Create: `frontend/vitest.setup.ts`
- Create: `frontend/.env` (gitignored) and `frontend/.env.example` (committed, no real values)
- Test: `frontend/src/__tests__/App.test.tsx`, `frontend/src/__tests__/pwa.config.test.ts`

**Interfaces:**
- Produces: `frontend/src/pwa.config.ts` exports:
  - `export const registerType = 'autoUpdate' as const;`
  - `export const manifest: { name: string; short_name: string; theme_color: string; background_color: string; display: 'standalone'; icons: Array<{ src: string; sizes: string; type: string }> };`
- Later tasks consume: the `frontend/` directory layout (`src/api/`,
  `src/auth/`, `src/pages/`, `src/routes/`, `src/components/` — create
  these as empty-but-present folders is not required; later tasks create
  files directly in them).

- [ ] **Step 1: Scaffold the Vite project**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa \
  vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Write the failing tests**

```ts
// frontend/src/__tests__/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  test('renders the LBike app shell', () => {
    render(<App />);
    expect(screen.getByText('LBike')).toBeInTheDocument();
  });
});
```

```ts
// frontend/src/__tests__/pwa.config.test.ts
import { describe, test, expect } from 'vitest';
import { manifest, registerType } from '../pwa.config';

describe('pwa.config', () => {
  test('declares LBike branding and auto-update registration', () => {
    expect(manifest.name).toBe('LBike');
    expect(manifest.theme_color).toBe('#1A1A1A');
    expect(manifest.background_color).toBe('#1A1A1A');
    expect(manifest.display).toBe('standalone');
    expect(registerType).toBe('autoUpdate');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd frontend && npx vitest run`
Expected: FAIL — `App.tsx` doesn't render "LBike" yet (default Vite
template content), and `../pwa.config` does not exist yet (module not
found).

- [ ] **Step 5: Configure Tailwind v4, Vitest, and `pwa.config.ts`**

`frontend/src/index.css`: replace contents with `@import "tailwindcss";`.

`frontend/vite.config.ts`: add the `tailwindcss()` and `VitePWA()`
plugins (from `@tailwindcss/vite` and `vite-plugin-pwa`), passing
`registerType` and `manifest` imported from `./src/pwa.config`; add a
`test` block: `{ environment: 'jsdom', setupFiles: './vitest.setup.ts', globals: true }`.

`frontend/vitest.setup.ts`: `import '@testing-library/jest-dom';`

`frontend/src/pwa.config.ts`: export the constants per the Interfaces
block above. Use a single placeholder icon entry for now (e.g.
`{ src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' }`) — real
branded icons are Task 7's job.

`frontend/src/App.tsx`: minimal placeholder that renders the text
`LBike` (e.g. in an `<h1>`) — full routing replaces this in Task 4.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run`
Expected: PASS (2/2).

- [ ] **Step 7: Add `.env.example` and gitignore, start the dev server once to confirm it boots**

`frontend/.env.example`: `VITE_API_URL=http://127.0.0.1:8000/api/v1`
Add `.env` (but not `.env.example`) to `frontend/.gitignore` (Vite's
default template already ignores `.env*.local` only — add plain `.env`
explicitly, same gap the mobile project hit).

Run: `cd frontend && npm run dev` (then stop it — this just confirms the
scaffold boots with no build errors).

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold Vite PWA with Tailwind and Vitest"
```

---

### Task 2: API client (register/login/me/logout)

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`, `frontend/src/api/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_URL` (Task 1's `.env`).
- Produces:
  - `export class ApiError extends Error { status: number; errors?: Record<string, string[]>; constructor(message: string, status: number, errors?: Record<string, string[]>) }`
  - `export async function request<T>(path: string, options?: RequestInit): Promise<T>` — joins `VITE_API_URL` + `path`, sets `Content-Type: application/json` and `Accept: application/json`, JSON-stringifies `options.body` if it's a plain object, throws `ApiError` on non-2xx (reading `message`/`errors` from the JSON body when present), returns `undefined as T` for a 204 response without attempting to parse JSON, and throws `ApiError('Network error', 0)` when `fetch` itself rejects.
  - `export interface User { id: number; name: string; email: string; }`
  - `export async function registerRequest(name: string, email: string, password: string, passwordConfirmation: string): Promise<{ user: User; token: string }>` — POSTs `/register` with `{name, email, password, password_confirmation: passwordConfirmation}`.
  - `export async function loginRequest(email: string, password: string): Promise<{ user: User; token: string }>` — POSTs `/login`.
  - `export async function meRequest(token: string): Promise<{ user: User }>` — GETs `/me` with `Authorization: Bearer ${token}`.
  - `export async function logoutRequest(token: string): Promise<void>` — POSTs `/logout` with the bearer header.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/api/__tests__/client.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { request, ApiError } from '../client';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

describe('request', () => {
  test('returns parsed JSON on success', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ hello: 'world' }) });
    await expect(request('/ping')).resolves.toEqual({ hello: 'world' });
  });

  test('returns undefined for a 204 response without parsing JSON', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('should not be called'); } });
    await expect(request('/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  test('throws ApiError with the server message on a non-2xx response', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Invalid credentials.' }) });
    await expect(request('/login')).rejects.toMatchObject({ message: 'Invalid credentials.', status: 401 });
  });

  test('throws a network ApiError when fetch itself rejects', async () => {
    (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/ping')).rejects.toMatchObject({ status: 0 });
  });
});
```

```ts
// frontend/src/api/__tests__/auth.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { registerRequest, loginRequest, meRequest, logoutRequest } from '../auth';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

describe('registerRequest', () => {
  test('posts the confirmed password field the backend expects', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, token: 'abc' }) });
    await registerRequest('Lucas', 'l@e.com', 'password123', 'password123');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ name: 'Lucas', email: 'l@e.com', password: 'password123', password_confirmation: 'password123' });
  });
});

describe('meRequest', () => {
  test('sends the bearer token', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: 1, name: 'Lucas', email: 'l@e.com' } }) });
    await meRequest('abc');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc');
  });
});
```

(`loginRequest`/`logoutRequest` need no separate test here beyond what
`client.test.ts` already proves about `request()` — they're thin wrappers;
don't duplicate coverage per `writing-good-tests.md`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/api`
Expected: FAIL — `../client` and `../auth` don't exist yet.

- [ ] **Step 3: Implement `client.ts` and `auth.ts`** per the Interfaces block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/api`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api
git commit -m "feat(frontend): add API client for auth endpoints"
```

---

### Task 3: AuthContext (session persistence and restore)

**Files:**
- Create: `frontend/src/auth/AuthContext.tsx`
- Test: `frontend/src/auth/__tests__/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `registerRequest`, `loginRequest`, `meRequest`, `logoutRequest`, `User`, `ApiError` from `../api/auth` and `../api/client` (Task 2).
- Produces:
  - `export interface AuthContextValue { user: User | null; isLoading: boolean; register(name: string, email: string, password: string, passwordConfirmation: string): Promise<void>; login(email: string, password: string): Promise<void>; logout(): Promise<void>; }`
  - `export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element`
  - `export function useAuth(): AuthContextValue`
  - `localStorage` key `'lbike_token'` holds the bearer token between reloads.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/auth/__tests__/AuthContext.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authApi from '../../api/auth';

vi.mock('../../api/auth');

function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  if (isLoading) return <div>A carregar...</div>;
  return (
    <div>
      <div>{user ? `Ola, ${user.name}` : 'Sem sessao'}</div>
      <button onClick={() => login('l@e.com', 'secret')}>Entrar</button>
      <button onClick={() => logout()}>Sair</button>
    </div>
  );
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('AuthProvider', () => {
  test('starts with no stored token: not loading, no user', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
  });

  test('restores the session from a valid stored token', async () => {
    localStorage.setItem('lbike_token', 'abc');
    vi.mocked(authApi.meRequest).mockResolvedValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Ola, Lucas')).toBeInTheDocument());
  });

  test('clears an invalid stored token on mount', async () => {
    localStorage.setItem('lbike_token', 'expired');
    const { ApiError } = await import('../../api/client');
    vi.mocked(authApi.meRequest).mockRejectedValue(new ApiError('Unauthenticated.', 401));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBeNull();
  });

  test('login stores the token and user; logout clears both', async () => {
    vi.mocked(authApi.loginRequest).mockResolvedValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, token: 'abc' });
    vi.mocked(authApi.logoutRequest).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());

    await user.click(screen.getByText('Entrar'));
    await waitFor(() => expect(screen.getByText('Ola, Lucas')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBe('abc');

    await user.click(screen.getByText('Sair'));
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/auth`
Expected: FAIL — `../AuthContext` does not exist yet.

- [ ] **Step 3: Implement `AuthContext.tsx`**

On mount: read `lbike_token` from `localStorage`; if absent, set
`isLoading` false immediately with `user: null`. If present, call
`meRequest(token)`; on success set `user`, `isLoading: false`; on
`ApiError` (or any rejection) remove the stored token and set
`user: null`, `isLoading: false`. `login`/`register` call their
respective API functions, then store `token` in `localStorage` and set
`user`. `logout` calls `logoutRequest(token)` (best-effort — proceed with
local cleanup even if it rejects, there is nothing useful to show the
user if the revoke call fails) then clears `localStorage` and `user`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/auth`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth
git commit -m "feat(frontend): add AuthContext with persisted session"
```

---

### Task 4: Routing shell — public/protected split, bottom nav

**Files:**
- Create: `frontend/src/routes/ProtectedRoute.tsx`
- Create: `frontend/src/components/BottomNav.tsx`
- Create: `frontend/src/routes/AppRoutes.tsx`
- Modify: `frontend/src/App.tsx` (wire `AuthProvider` + `BrowserRouter` + `AppRoutes`; drop the Task 1 placeholder)
- Test: `frontend/src/routes/__tests__/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `../auth/AuthContext` (Task 3).
- Produces:
  - `export function ProtectedRoute({ children }: { children: React.ReactNode }): JSX.Element` — renders `children` when `useAuth().user` is set; renders a loading indicator while `isLoading`; otherwise `<Navigate to="/login" replace />`.
  - `export function BottomNav(): JSX.Element` — five links: Início (`/`), Mapa (`/map`), Registar (`/record`), Actividades (`/activities`), Perfil (`/profile`), with the "Registar" link visually distinct (per spec) via the accent colour background (Task 1's `#A3E635`) instead of a plain link style.
  - Route paths later tasks render into: `/login`, `/register` (public); `/`, `/map`, `/record`, `/activities`, `/profile` (wrapped individually in `ProtectedRoute`, sharing a layout that renders `<BottomNav />`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/routes/__tests__/ProtectedRoute.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import { ProtectedRoute } from '../ProtectedRoute';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof useAuthModule>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

describe('ProtectedRoute', () => {
  test('redirects to /login when there is no authenticated user', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/login" element={<div>Pagina de login</div>} />
          <Route path="/profile" element={<ProtectedRoute><div>Perfil</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Pagina de login')).toBeInTheDocument());
  });

  test('renders children when a user is authenticated', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProtectedRoute><div>Perfil</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Perfil')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/routes`
Expected: FAIL — `../ProtectedRoute` does not exist yet.

- [ ] **Step 3: Implement `ProtectedRoute.tsx` and `BottomNav.tsx`**, and wire `AppRoutes.tsx` + `App.tsx`. `AppRoutes` is not unit-tested directly here — Tasks 5 and 6 add the real page components it renders, and their own tests exercise the routing integration end to end.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/routes`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes frontend/src/components frontend/src/App.tsx
git commit -m "feat(frontend): add routing shell with protected routes and bottom nav"
```

---

### Task 5: Login and Register pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx` (register the `/login` and `/register` routes)
- Test: `frontend/src/pages/__tests__/LoginPage.test.tsx`, `frontend/src/pages/__tests__/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 3) for `login`/`register`/`isLoading`... (note: use a **local** `isSubmitting` state per form, not `AuthContext`'s `isLoading` — that flag means "restoring session on app load", a different concern).
- Produces: `export default function LoginPage(): JSX.Element`, `export default function RegisterPage(): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/pages/__tests__/LoginPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('LoginPage', () => {
  test('submits the entered credentials', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('l@e.com', 'secret123'));
  });

  test('shows the server error message when login fails', async () => {
    const { ApiError } = await import('../../api/client');
    const login = vi.fn().mockRejectedValue(new ApiError('Invalid credentials.', 401));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByText('Invalid credentials.')).toBeInTheDocument());
  });

  test('disables the submit button while the request is in flight', async () => {
    let resolveLogin: () => void = () => {};
    const login = vi.fn(() => new Promise<void>((resolve) => { resolveLogin = resolve; }));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    const button = screen.getByRole('button', { name: 'Entrar' });
    await user.click(button);

    expect(button).toBeDisabled();
    await user.click(button); // a second click must not fire a second call
    expect(login).toHaveBeenCalledTimes(1);
    resolveLogin();
  });
});
```

```tsx
// frontend/src/pages/__tests__/RegisterPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('RegisterPage', () => {
  test('shows field-level errors from a 422 response', async () => {
    const { ApiError } = await import('../../api/client');
    const register = vi.fn().mockRejectedValue(
      new ApiError('The email has already been taken.', 422, { email: ['The email has already been taken.'] })
    );
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register, logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Nome'), 'Lucas');
    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.type(screen.getByLabelText('Confirmar palavra-passe'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(screen.getByText('The email has already been taken.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages`
Expected: FAIL — `../LoginPage` / `../RegisterPage` do not exist yet.

- [ ] **Step 3: Implement `LoginPage.tsx` and `RegisterPage.tsx`**

Each: a controlled form, a local `isSubmitting` boolean guarding the
submit handler (return early if already `true`) and disabling the submit
button, and an error banner rendering `error.message` from a caught
`ApiError`. `RegisterPage` reads `error.errors` (per-field messages) when
present and renders them; falls back to `error.message` otherwise. Field
labels exactly as used in the tests above: "Nome", "Email",
"Palavra-passe", "Confirmar palavra-passe". Buttons: "Entrar" / "Criar
conta". On success, navigate to `/` (the authenticated home).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages`
Expected: PASS (4/4).

- [ ] **Step 5: Wire routes and commit**

Register `/login` → `LoginPage`, `/register` → `RegisterPage` in
`AppRoutes.tsx`.

```bash
git add frontend/src/pages frontend/src/routes/AppRoutes.tsx
git commit -m "feat(frontend): add login and register pages"
```

---

### Task 6: Tab shell placeholders and profile screen

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/MapPage.tsx`, `frontend/src/pages/RecordPage.tsx`, `frontend/src/pages/ActivitiesPage.tsx`, `frontend/src/pages/ProfilePage.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx` (register `/`, `/map`, `/record`, `/activities`, `/profile`, each wrapped in `ProtectedRoute` and sharing a layout that renders `<BottomNav />` alongside the active page)
- Test: `frontend/src/pages/__tests__/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 3) for `user` and `logout`; `ProtectedRoute`, `BottomNav` (Task 4).
- Produces: `export default function ProfilePage(): JSX.Element` (and the four sibling placeholder pages, no exported interface other tasks depend on).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/__tests__/ProfilePage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('ProfilePage', () => {
  test('shows the logged-in user and logs out on request', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, login: vi.fn(), register: vi.fn(), logout });
    const user = userEvent.setup();
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);

    expect(screen.getByText('Lucas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Terminar sessao' }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/__tests__/ProfilePage.test.tsx`
Expected: FAIL — `../ProfilePage` does not exist yet.

- [ ] **Step 3: Implement the five pages.** `HomePage`, `MapPage`,
`RecordPage`, `ActivitiesPage` each render a simple "em construção"
placeholder with the Portuguese tab name as a heading — their real
content is later plans' job. `ProfilePage` shows `user.name`/`user.email`
and a "Terminar sessao" button calling `logout()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/__tests__/ProfilePage.test.tsx`
Expected: PASS (1/1).

- [ ] **Step 5: Wire the remaining routes, then run the whole suite and commit**

Run: `cd frontend && npx vitest run`
Expected: PASS (all tests from Tasks 1-6).

```bash
git add frontend/src/pages frontend/src/routes/AppRoutes.tsx
git commit -m "feat(frontend): add tab shell placeholders and profile screen"
```

---

### Task 7: Branded PWA manifest and icons

**Files:**
- Create: `frontend/public/icons/icon-192.png`, `frontend/public/icons/icon-512.png`, `frontend/public/icons/icon-maskable-512.png`
- Modify: `frontend/src/pwa.config.ts` (replace the Task 1 placeholder icon entry with the real set, and fill in `short_name`, `description`, `start_url`)
- Test: `frontend/src/__tests__/pwa.config.test.ts` (extend from Task 1)

**Interfaces:**
- Consumes: `frontend/src/pwa.config.ts`'s existing shape (Task 1).
- Produces: nothing further tasks depend on — this is the MVP objective
  "Instalável no telemóvel (PWA)" closing task.

- [ ] **Step 1: Write the failing test (extend Task 1's)**

```ts
// append to frontend/src/__tests__/pwa.config.test.ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('every manifest icon file exists under public/', () => {
  for (const icon of manifest.icons) {
    const path = resolve(__dirname, '../../public', icon.src.replace(/^\//, ''));
    expect(existsSync(path)).toBe(true);
  }
});

test('manifest has a short name, description, and start url', () => {
  expect(manifest.short_name).toBe('LBike');
  expect(manifest.description).toBe('Regista e partilha as tuas pedaladas, corridas e caminhadas.');
  expect(manifest.start_url).toBe('/');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/pwa.config.test.ts`
Expected: FAIL — icon files referenced don't exist yet; `short_name`/`description`/`start_url` undefined.

- [ ] **Step 3: Generate the icons and update the manifest**

Use this source mark (simple, original — a lime "L" on a charcoal
rounded square, not a Strava lookalike) as an inline SVG, then rasterize
it to the three required sizes with `npx pwa-asset-generator` (or any
equivalent tool already available) into `frontend/public/icons/`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1A1A1A"/>
  <text x="256" y="340" font-family="sans-serif" font-size="280"
        font-weight="700" fill="#A3E635" text-anchor="middle">L</text>
</svg>
```

For the maskable icon, keep the glyph within the inner ~80% safe zone
(standard maskable-icon padding) so it isn't clipped when the OS applies
its own mask shape.

Update `manifest.icons` to the three real files (`192x192`, `512x512`,
and the `512x512` maskable one with `"purpose": "maskable"`), and set
`short_name: 'LBike'`, `description: 'Regista e partilha as tuas
pedaladas, corridas e caminhadas.'`, `start_url: '/'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/pwa.config.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite once more and commit**

Run: `cd frontend && npx vitest run`
Expected: PASS (all tests).

```bash
git add frontend/public/icons frontend/src/pwa.config.ts frontend/src/__tests__/pwa.config.test.ts
git commit -m "feat(frontend): add branded PWA icons and finalize manifest"
```
