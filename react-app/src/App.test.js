import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the shell and the PM dashboard', () => {
  render(<App />);
  expect(screen.getByText('My open jobs')).toBeInTheDocument();
});
