import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input Component', () => {
  describe('Password Toggle Functionality', () => {
    it('should show password toggle button for password inputs', () => {
      render(
        <Input
          type="password"
          showPasswordToggle
          placeholder="Enter password"
        />
      );

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should not show password toggle button when showPasswordToggle is false', () => {
      render(
        <Input
          type="password"
          showPasswordToggle={false}
          placeholder="Enter password"
        />
      );

      const toggleButton = screen.queryByRole('button', { name: /show password/i });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should not show password toggle button for non-password inputs', () => {
      render(
        <Input
          type="text"
          showPasswordToggle
          placeholder="Enter text"
        />
      );

      const toggleButton = screen.queryByRole('button', { name: /show password/i });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should toggle password visibility when button is clicked', () => {
      render(
        <Input
          type="password"
          showPasswordToggle
          placeholder="Enter password"
          defaultValue="secret123"
        />
      );

      const input = screen.getByPlaceholderText('Enter password') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      // Initially should be password type
      expect(input.type).toBe('password');

      // Click to show password
      fireEvent.click(toggleButton);
      expect(input.type).toBe('text');

      // Click to hide password
      fireEvent.click(toggleButton);
      expect(input.type).toBe('password');
    });

    it('should update button aria-label when toggling', () => {
      render(
        <Input
          type="password"
          showPasswordToggle
          placeholder="Enter password"
        />
      );

      const toggleButton = screen.getByRole('button', { name: /show password/i });

      // Click to show password
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

      // Click to hide password
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
    });

    it('should render with proper accessibility attributes', () => {
      render(
        <Input
          type="password"
          showPasswordToggle
          placeholder="Enter password"
          label="Password"
        />
      );

      const input = screen.getByLabelText('Password');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      expect(input).toHaveAttribute('aria-invalid', 'false');
      expect(toggleButton).toHaveAttribute('tabIndex', '-1');
    });

    it('should show error state correctly with password toggle', () => {
      render(
        <Input
          type="password"
          showPasswordToggle
          placeholder="Enter password"
          label="Password"
          error="Password is required"
        />
      );

      const input = screen.getByLabelText('Password');
      const errorMessage = screen.getByText('Password is required');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveClass('border-error');
      expect(errorMessage).toBeInTheDocument();
      expect(toggleButton).toBeInTheDocument();
    });

    it('should work with fullWidth prop', () => {
      render(
        <Input
          type="password"
          showPasswordToggle
          placeholder="Enter password"
          fullWidth
        />
      );

      const container = screen.getByPlaceholderText('Enter password').closest('div');
      expect(container?.parentElement).toHaveClass('w-full');
    });
  });

  describe('General Input Functionality', () => {
    it('should render with label', () => {
      render(
        <Input
          label="Email Address"
          type="email"
          placeholder="Enter email"
        />
      );

      const label = screen.getByText('Email Address');
      const input = screen.getByLabelText('Email Address');

      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });

    it('should render with helper text', () => {
      render(
        <Input
          label="Username"
          helperText="Must be at least 3 characters"
          placeholder="Enter username"
        />
      );

      const helperText = screen.getByText('Must be at least 3 characters');
      expect(helperText).toBeInTheDocument();
    });

    it('should render with left and right icons', () => {
      const LeftIcon = () => <span data-testid="left-icon">@</span>;
      const RightIcon = () => <span data-testid="right-icon">✓</span>;

      render(
        <Input
          placeholder="Enter text"
          leftIcon={<LeftIcon />}
          rightIcon={<RightIcon />}
        />
      );

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });
});