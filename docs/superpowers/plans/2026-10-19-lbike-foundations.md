# LBike Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working, testable skeleton — a Laravel API with email/password authentication, and an Expo (React Native) iOS app with a navigation shell that can register, log in, log out, and view its own profile against that API — so every later plan (GPS recording, route planning, social) has an authenticated app and API to build on.

**Architecture:** Two independent projects in one repo: `backend/` (Laravel API, token auth via Sanctum) and `mobile/` (Expo app with file-based routing via `expo-router`, a thin `fetch`-based API client, and a React Context holding the authenticated session). The mobile app talks to the backend over HTTP on the local network during development; no component of this plan talks to any third-party service.

**Tech Stack:** Laravel (latest stable) + Laravel Sanctum + PHPUnit + SQLite (tests only); Expo SDK (latest stable) + TypeScript + `expo-router` + `expo-secure-store` + Jest (`jest-expo` preset) + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-19-lbike-design.md`

## Global Constraints

- iOS is the only target platform; no Android-specific work.
- No Mac may be required for the normal development loop (app builds and runs via Expo Dev Client / EAS, never local Xcode).
- No paid third-party API may be introduced (spec anti-goal: no infrastructure cost at this stage).
- Authentication is email/password only for the MVP — no social login providers.
- Development database for the Laravel app is MySQL (spec default); automated tests run against SQLite in-memory for speed, which is a test-only substitution and never the dev/prod database.
- The user is not yet enrolled in the Apple Developer Program; Task 7 depends on that enrollment and must say so plainly if reached before enrollment completes.

## Review Focus

- Duplicate email on registration returns a 422 validation error naming the `email` field, never a 500 or a second user row — covered in Task 1.
- Wrong password or unknown email on login both return the same generic 401 message, never revealing whether the email exists — covered in Task 2.
- A missing, malformed, or revoked Bearer token on a protected endpoint (`/me`, `/logout`) returns 401, never a 500 or a stack trace — covered in Task 2.
- The mobile app loses network connectivity mid-request (register/login) and shows a user-facing error instead of crashing or hanging silently — covered in Task 3.
- On app restart, a previously stored session is restored silently (user stays logged in) rather than the app showing a flash of the login screen or losing the session — covered in Task 4.

---

### Task 1: Backend scaffold + registration endpoint

**Files:**
- Create: `backend/` (Laravel project, via Composer)
- Create: `backend/app/Http/Controllers/Api/AuthController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/RegisterTest.php`

**Interfaces:**
- Produces: `POST /api/v1/register` — body `{ name: string, email: string, password: string, password_confirmation: string }` → `201 { user: { id, name, email }, token: string }`; `422` on duplicate email or validation failure.

- [ ] **Step 1: Scaffold the Laravel project and install Sanctum**

Run:
```bash
composer create-project laravel/laravel backend
cd backend
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```
Configure `backend/.env` for local development with `DB_CONNECTION=mysql` and the user's local MySQL credentials. Configure `backend/phpunit.xml` to override `DB_CONNECTION=sqlite` and `DB_DATABASE=:memory:` for the test environment only. Add the `Laravel\Sanctum\HasApiTokens` trait to `app/Models/User.php`.

- [ ] **Step 2: Write the failing test**

```php
public function test_register_creates_user_and_returns_token(): void
{
    $response = $this->postJson('/api/v1/register', [
        'name' => 'Lucas',
        'email' => 'lucas@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertCreated()
        ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);
    $this->assertDatabaseHas('users', ['email' => 'lucas@example.com']);
}

public function test_register_rejects_duplicate_email(): void
{
    User::factory()->create(['email' => 'lucas@example.com']);

    $response = $this->postJson('/api/v1/register', [
        'name' => 'Lucas',
        'email' => 'lucas@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertStatus(422)->assertJsonValidationErrors('email');
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `php artisan test --filter=RegisterTest`
Expected: FAIL (route/controller not defined)

- [ ] **Step 4: Implement `AuthController::register(Request $request)` in `backend/app/Http/Controllers/Api/AuthController.php`, routed as `POST /api/v1/register` in `backend/routes/api.php`**

Validate with Laravel's `Validator` (name required string, email required/email/unique:users, password required/confirmed/min:8). Create the user with a hashed password, issue a token via `$user->createToken('mobile')->plainTextToken`, return the shape from the Interfaces block.

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=RegisterTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(backend): add user registration endpoint"
```

---

### Task 2: Backend — login, me, logout endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/AuthTest.php`

**Interfaces:**
- Consumes: `User` model and Sanctum token issuance from Task 1.
- Produces: `POST /api/v1/login` — body `{ email, password }` → `200 { user, token }`; `401 { message }` on bad credentials. `GET /api/v1/me` (Bearer token, `auth:sanctum` middleware) → `200 { user }`; `401` if missing/invalid token. `POST /api/v1/logout` (Bearer token) → `204`; revokes the presented token.

- [ ] **Step 1: Write the failing tests**

```php
public function test_login_returns_token_for_valid_credentials(): void
{
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    $response = $this->postJson('/api/v1/login', [
        'email' => $user->email,
        'password' => 'password123',
    ]);

    $response->assertOk()->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);
}

public function test_login_rejects_invalid_credentials(): void
{
    $response = $this->postJson('/api/v1/login', [
        'email' => 'nobody@example.com',
        'password' => 'wrong',
    ]);

    $response->assertStatus(401)->assertJson(['message' => 'Invalid credentials.']);
}

public function test_me_returns_authenticated_user(): void
{
    $user = User::factory()->create();
    $token = $user->createToken('mobile')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/v1/me');

    $response->assertOk()->assertJsonPath('user.id', $user->id);
}

public function test_me_rejects_missing_token(): void
{
    $this->getJson('/api/v1/me')->assertStatus(401);
}

public function test_logout_revokes_token(): void
{
    $user = User::factory()->create();
    $token = $user->createToken('mobile')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/v1/logout')
        ->assertStatus(204);
    $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$token}"])->assertStatus(401);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --filter=AuthTest`
Expected: FAIL

- [ ] **Step 3: Implement `login`, `me`, `logout` on `AuthController` and wire the routes**

`login` uses `Auth::attempt` or manual `Hash::check`; on failure return the exact 401 body above (same message regardless of whether the email exists). `me` and `logout` sit behind `->middleware('auth:sanctum')` in `routes/api.php`; `logout` calls `$request->user()->currentAccessToken()->delete()` and returns `response()->noContent()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan test --filter=AuthTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(backend): add login, me, and logout endpoints"
```

---

### Task 3: Mobile scaffold + API client

**Files:**
- Create: `mobile/` (Expo project, TypeScript template)
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/auth.ts`
- Test: `mobile/src/api/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: the three endpoints from Tasks 1–2 (`/api/v1/register`, `/api/v1/login`, `/api/v1/me`, `/api/v1/logout`).
- Produces: `type User = { id: number; name: string; email: string }`; `class ApiError extends Error { status: number; constructor(message: string, status: number) }` (network failures are also surfaced as an `ApiError`, with `status: 0`, so callers only ever catch one error type); `registerRequest(input: { name: string; email: string; password: string; password_confirmation: string }): Promise<{ user: User; token: string }>`; `loginRequest(input: { email: string; password: string }): Promise<{ user: User; token: string }>`; `meRequest(token: string): Promise<{ user: User }>`; `logoutRequest(token: string): Promise<void>`.

- [ ] **Step 1: Scaffold the Expo project and test tooling**

Run:
```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
npx expo install expo-router expo-secure-store react-native-safe-area-context react-native-screens
npm install --save-dev jest-expo @testing-library/react-native
```
Configure `mobile/package.json` jest config with the `jest-expo` preset. Add an `EXPO_PUBLIC_API_URL` env var (e.g. `http://<local-ip>:8000/api/v1`) read in `client.ts`, documented in a new `mobile/.env.example`.

- [ ] **Step 2: Write the failing test**

```typescript
describe('loginRequest', () => {
  it('posts credentials and returns the parsed user and token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 1, name: 'Lucas', email: 'lucas@example.com' }, token: 'abc' }),
    });

    const result = await loginRequest({ email: 'lucas@example.com', password: 'password123' });

    expect(result).toEqual({ user: { id: 1, name: 'Lucas', email: 'lucas@example.com' }, token: 'abc' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/login'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws ApiError with the response status on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials.' }),
    });

    await expect(loginRequest({ email: 'x@example.com', password: 'bad' }))
      .rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' });
  });

  it('throws ApiError with status 0 when the network request itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(loginRequest({ email: 'x@example.com', password: 'bad' }))
      .rejects.toMatchObject({ status: 0 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/api/__tests__/auth.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement `client.ts` and `auth.ts`**

`client.ts` exports a `request(path: string, options?: RequestInit): Promise<unknown>` helper that prefixes `EXPO_PUBLIC_API_URL`, sets `Content-Type: application/json`, and throws `ApiError` (carrying `status` and the response body's `message`) on a non-ok response; it wraps the `fetch` call itself in a try/catch and rethrows any rejection (network failure) as `new ApiError(error.message, 0)`. `auth.ts` implements the four functions from the Interfaces block by calling `request`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/api/__tests__/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mobile
git commit -m "feat(mobile): scaffold Expo app and API client"
```

---

### Task 4: Mobile — AuthContext with persisted session

**Files:**
- Create: `mobile/src/auth/AuthContext.tsx`
- Test: `mobile/src/auth/__tests__/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `User`, `registerRequest`, `loginRequest`, `meRequest`, `logoutRequest` from Task 3.
- Produces: `<AuthProvider>` component; `useAuth(): { user: User | null; token: string | null; isLoading: boolean; login(email: string, password: string): Promise<void>; register(name: string, email: string, password: string): Promise<void>; logout(): Promise<void> }`.

- [ ] **Step 1: Write the failing test**

```tsx
jest.mock('expo-secure-store');
jest.mock('../../api/auth');

function Probe() {
  const auth = useAuth();
  return (
    <>
      <Text testID="user">{auth.user?.name ?? 'none'}</Text>
      <Button title="login" onPress={() => auth.login('lucas@example.com', 'password123')} />
      <Button title="logout" onPress={() => auth.logout()} />
    </>
  );
}

test('login stores the token and exposes the user; logout clears both', async () => {
  (loginRequest as jest.Mock).mockResolvedValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, token: 'abc' });
  (logoutRequest as jest.Mock).mockResolvedValue(undefined);

  const { getByText, getByTestId } = render(<AuthProvider><Probe /></AuthProvider>);
  fireEvent.press(getByText('login'));
  await waitFor(() => expect(getByTestId('user').props.children).toBe('Lucas'));
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('lbike_token', 'abc');

  fireEvent.press(getByText('logout'));
  await waitFor(() => expect(getByTestId('user').props.children).toBe('none'));
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lbike_token');
});

test('on mount, a stored token restores the session via meRequest', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
  (meRequest as jest.Mock).mockResolvedValue({ user: { id: 2, name: 'Ana', email: 'a@e.com' } });

  const { getByTestId } = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(getByTestId('user').props.children).toBe('Ana'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/__tests__/AuthContext.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `AuthContext.tsx`**

Store `token` with key `lbike_token` via `expo-secure-store`. On mount, read the stored token; if present, call `meRequest(token)` to restore `user`, clearing the stored token if that call throws (expired/invalid token), while `isLoading` is `true` until this resolves. `login`/`register` call the matching request function, then persist the token and set `user`. `logout` calls `logoutRequest`, then clears storage and state regardless of whether the call succeeds.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/auth/__tests__/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): add AuthContext with persisted session"
```

---

### Task 5: Mobile — navigation shell + login screen

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/activities.tsx`
- Create: `mobile/app/(tabs)/map.tsx`
- Test: `mobile/app/(auth)/__tests__/login.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 4.
- Produces: route `/(auth)/login`; route group `/(tabs)` with `activities` and `map` as placeholder screens (each rendering only a `<Text>` naming the screen, filled in by later plans).

- [ ] **Step 1: Write the failing test**

```tsx
jest.mock('../../../src/auth/AuthContext');

test('submitting the form calls login with the entered credentials', async () => {
  const login = jest.fn().mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ login, isLoading: false, user: null });

  const { getByPlaceholderText, getByText } = render(<LoginScreen />);
  fireEvent.changeText(getByPlaceholderText('Email'), 'lucas@example.com');
  fireEvent.changeText(getByPlaceholderText('Palavra-passe'), 'password123');
  fireEvent.press(getByText('Entrar'));

  await waitFor(() => expect(login).toHaveBeenCalledWith('lucas@example.com', 'password123'));
});

test('a failed login shows an error message instead of crashing', async () => {
  const login = jest.fn().mockRejectedValue(new ApiError('Invalid credentials.', 401));
  (useAuth as jest.Mock).mockReturnValue({ login, isLoading: false, user: null });

  const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);
  fireEvent.changeText(getByPlaceholderText('Email'), 'lucas@example.com');
  fireEvent.changeText(getByPlaceholderText('Palavra-passe'), 'wrong');
  fireEvent.press(getByText('Entrar'));

  expect(await findByText('Invalid credentials.')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "app/\(auth\)/__tests__/login.test.tsx"`
Expected: FAIL

- [ ] **Step 3: Implement `_layout.tsx` and `(auth)/login.tsx`**

`app/_layout.tsx` wraps the router in `<AuthProvider>`, and — once `isLoading` is `false` — redirects to `/(tabs)/activities` when `user` is set or to `/(auth)/login` otherwise (using `expo-router`'s `<Redirect>`). `login.tsx` is a form (email + password `TextInput`s, submit `Button` labelled "Entrar") that calls `useAuth().login`, catching a thrown `ApiError` and rendering its `message` in a `<Text>`. `(tabs)/_layout.tsx` is a bottom tab navigator with "Atividades" and "Mapa" tabs; each screen file renders a placeholder `<Text>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "app/\(auth\)/__tests__/login.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): add navigation shell and login screen"
```

---

### Task 6: Mobile — register screen + profile screen

**Files:**
- Create: `mobile/app/(auth)/register.tsx`
- Create: `mobile/app/(tabs)/profile.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx` (add the "Perfil" tab, from Task 5)
- Test: `mobile/app/(auth)/__tests__/register.test.tsx`
- Test: `mobile/app/(tabs)/__tests__/profile.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 4.
- Produces: route `/(auth)/register`; route `/(tabs)/profile`, added as a third tab in `(tabs)/_layout.tsx` (modify that file from Task 5).

- [ ] **Step 1: Write the failing tests**

```tsx
// register.test.tsx
test('submitting the form calls register with the entered fields', async () => {
  const register = jest.fn().mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ register, isLoading: false, user: null });

  const { getByPlaceholderText, getByText } = render(<RegisterScreen />);
  fireEvent.changeText(getByPlaceholderText('Nome'), 'Lucas');
  fireEvent.changeText(getByPlaceholderText('Email'), 'lucas@example.com');
  fireEvent.changeText(getByPlaceholderText('Palavra-passe'), 'password123');
  fireEvent.press(getByText('Criar conta'));

  await waitFor(() => expect(register).toHaveBeenCalledWith('Lucas', 'lucas@example.com', 'password123'));
});

// profile.test.tsx
test('shows the authenticated user and logs out on press', () => {
  const logout = jest.fn();
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 1, name: 'Lucas', email: 'lucas@example.com' }, logout, isLoading: false,
  });

  const { getByText } = render(<ProfileScreen />);
  expect(getByText('Lucas')).toBeTruthy();
  fireEvent.press(getByText('Sair'));
  expect(logout).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest register.test.tsx profile.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `register.tsx` and `profile.tsx`, and add the "Perfil" tab**

`register.tsx` mirrors `login.tsx`'s form/error-handling pattern (name, email, password `TextInput`s, "Criar conta" button) calling `useAuth().register`. `profile.tsx` renders `user.name` and `user.email`, with a "Sair" button calling `useAuth().logout`. Add a "Perfil" entry to the tab navigator in `(tabs)/_layout.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest register.test.tsx profile.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): add register and profile screens"
```

---

### Task 7: Development Client configuration (EAS)

**Files:**
- Create: `mobile/eas.json`
- Modify: `mobile/app.json` (iOS bundle identifier, `expo-dev-client` plugin)

**Interfaces:**
- Consumes: nothing from earlier tasks (infrastructure only).
- Produces: an installable iOS Development Client build, the standard way every later plan's GPS/map/social screens get tested on the physical device.

- [ ] **Step 1: Check the Apple Developer Program dependency**

This task needs an active Apple Developer Program enrollment (paid account) to install a build on a physical iPhone. If not yet enrolled, stop here and enroll first (identity verification can take from same-day up to about a week) — do not attempt the remaining steps without it, per the Global Constraints.

- [ ] **Step 2: Install `expo-dev-client` and configure `eas.json`**

Run: `npx expo install expo-dev-client`
Add a `development` build profile to `mobile/eas.json` with `"developmentClient": true` and `"distribution": "internal"` for the `ios` platform. Set a unique `ios.bundleIdentifier` in `mobile/app.json` (e.g. `com.lcsilva.lbike`).

- [ ] **Step 3: Run the development build**

Run: `eas build --profile development --platform ios`
Expected: build completes and EAS prints an install link/QR code for the physical iPhone.

- [ ] **Step 4: Manually verify on the physical device**

Install the build via the link from Step 3, run `npx expo start --dev-client`, open the app on the iPhone, and confirm: the login screen appears, registering a new account against the locally running backend (same Wi-Fi network, `EXPO_PUBLIC_API_URL` pointed at the computer's LAN IP) succeeds, and the Profile tab shows the new user with a working "Sair" button.

- [ ] **Step 5: Commit**

```bash
git add mobile/eas.json mobile/app.json
git commit -m "chore(mobile): configure EAS development client"
```
