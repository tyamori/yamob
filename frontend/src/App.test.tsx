import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders updated UI content', () => {
  render(<App />);
  const updatedElement = screen.getByText(/yamob/i); // Updated to match actual UI text
  expect(updatedElement).toBeInTheDocument();
});
