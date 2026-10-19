import { fireEvent, render } from '@testing-library/react-native';
import { useAuth } from '../../../src/auth/AuthContext';
import RegisterScreen from '../register';

jest.mock('../../../src/auth/AuthContext');

const flushUpdates = () => new Promise((resolve) => setTimeout(resolve, 1500));

test('submitting the form calls register with the entered fields', async () => {
  const register = jest.fn().mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ register, isLoading: false, user: null });

  const { getByPlaceholderText, getByText } = await render(<RegisterScreen />);
  await fireEvent.changeText(getByPlaceholderText('Nome'), 'Lucas');
  await fireEvent.changeText(getByPlaceholderText('Email'), 'lucas@example.com');
  await fireEvent.changeText(getByPlaceholderText('Palavra-passe'), 'password123');
  await fireEvent.press(getByText('Criar conta'));
  await flushUpdates();

  expect(register).toHaveBeenCalledWith('Lucas', 'lucas@example.com', 'password123');
}, 20000);
