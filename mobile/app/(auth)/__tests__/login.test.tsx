import { fireEvent, render } from '@testing-library/react-native';
import { ApiError } from '../../../src/api/client';
import { useAuth } from '../../../src/auth/AuthContext';
import LoginScreen from '../login';

jest.mock('../../../src/auth/AuthContext');

const flushUpdates = () => new Promise((resolve) => setTimeout(resolve, 1500));

test('submitting the form calls login with the entered credentials', async () => {
  const login = jest.fn().mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ login, isLoading: false, user: null });

  const { getByPlaceholderText, getByText } = await render(<LoginScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email'), 'lucas@example.com');
  await fireEvent.changeText(getByPlaceholderText('Palavra-passe'), 'password123');
  await fireEvent.press(getByText('Entrar'));
  await flushUpdates();

  expect(login).toHaveBeenCalledWith('lucas@example.com', 'password123');
}, 20000);

test('a failed login shows an error message instead of crashing', async () => {
  const login = jest.fn().mockRejectedValue(new ApiError('Invalid credentials.', 401));
  (useAuth as jest.Mock).mockReturnValue({ login, isLoading: false, user: null });

  const { getByPlaceholderText, getByText } = await render(<LoginScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email'), 'lucas@example.com');
  await fireEvent.changeText(getByPlaceholderText('Palavra-passe'), 'wrong');
  await fireEvent.press(getByText('Entrar'));
  await flushUpdates();

  expect(getByText('Invalid credentials.')).toBeTruthy();
}, 20000);
