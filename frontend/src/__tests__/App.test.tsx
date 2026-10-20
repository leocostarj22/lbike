import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  test('renders the LBike app shell', () => {
    render(<App />);
    expect(screen.getByText('LBike')).toBeInTheDocument();
  });
});
