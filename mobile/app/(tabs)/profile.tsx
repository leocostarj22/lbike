import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View>
      <Text>{user?.name}</Text>
      <Text>{user?.email}</Text>
      <Pressable onPress={() => logout()}>
        <Text>Sair</Text>
      </Pressable>
    </View>
  );
}
