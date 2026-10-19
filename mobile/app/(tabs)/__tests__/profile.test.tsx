import { fireEvent, render } from '@testing-library/react-native';
import { useAuth } from '../../../src/auth/AuthContext';
import ProfileScreen from '../profile';

jest.mock('../../../src/auth/AuthContext');

const flushUpdates = () => new Promise((resolve) => setTimeout(resolve, 1500));

test('shows the authenticated user and logs out on press', async () => {
  const logout = jest.fn();
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 1, name: 'Lucas', email: 'lucas@example.com' }, logout, isLoading: false,
  });

  const { getByText } = await render(<ProfileScreen />);
  expect(getByText('Lucas')).toBeTruthy();
  await fireEvent.press(getByText('Sair'));
  await flushUpdates();

  expect(logout).toHaveBeenCalled();
}, 20000);
