import { Button, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { loginRequest, logoutRequest, meRequest } from '../../api/auth';
import { AuthProvider, useAuth } from '../AuthContext';

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

// `waitFor` never observes a re-render triggered by a `fireEvent.press`-fired async
// handler in this @testing-library/react-native version (its internal polling doesn't
// prompt React to flush work scheduled outside an act() boundary), so a short real
// delay stands in for it here. The mount-effect test below is unaffected and uses
// `waitFor` normally.
const flushUpdates = () => new Promise((resolve) => setTimeout(resolve, 1000));

test('login stores the token and exposes the user; logout clears both', async () => {
  (loginRequest as jest.Mock).mockResolvedValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, token: 'abc' });
  (logoutRequest as jest.Mock).mockResolvedValue(undefined);

  const { getByText, getByTestId } = await render(<AuthProvider><Probe /></AuthProvider>);

  await fireEvent.press(getByText('login'));
  await flushUpdates();
  expect(getByTestId('user').props.children).toBe('Lucas');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('lbike_token', 'abc');

  await fireEvent.press(getByText('logout'));
  await flushUpdates();
  expect(getByTestId('user').props.children).toBe('none');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lbike_token');
}, 20000);

test('on mount, a stored token restores the session via meRequest', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
  (meRequest as jest.Mock).mockResolvedValue({ user: { id: 2, name: 'Ana', email: 'a@e.com' } });

  const { getByTestId } = await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(getByTestId('user').props.children).toBe('Ana'));
});
