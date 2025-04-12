import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders updated UI content', () => {
  render(<App />);
  const updatedElement = screen.getByText(/new ui content/i); // Replace with actual updated text
  expect(updatedElement).toBeInTheDocument();
});
