import { useAuth } from '../auth/AuthContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Perfil</h1>
      <p>{user.name}</p>
      <p className="text-white/70">{user.email}</p>
      <button
        onClick={() => logout()}
        className="rounded-full border border-white/20 px-4 py-2 font-semibold"
      >
        Terminar sessao
      </button>
    </div>
  );
}
