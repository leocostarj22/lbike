import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    try {
      await register(name, email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    }
  }

  return (
    <View>
      <TextInput placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput
        placeholder="Palavra-passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable onPress={handleSubmit}>
        <Text>Criar conta</Text>
      </Pressable>
      {error && <Text>{error}</Text>}
    </View>
  );
}
