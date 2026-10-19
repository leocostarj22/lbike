import { Redirect, Slot } from 'expo-router';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

function RootNavigation() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Redirect href={user ? '/(tabs)/activities' : '/(auth)/login'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
