import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
  sessionStorage.clear();
});

test('signed-out visitors land on the sign in page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
});
