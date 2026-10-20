import { useAuth } from '../auth/AuthContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div>
      <h1>Perfil</h1>
      <p>{user.name}</p>
      <p>{user.email}</p>
      <button onClick={() => logout()}>Terminar sessao</button>
    </div>
  );
}
