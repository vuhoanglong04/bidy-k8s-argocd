import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordForm from '../ui/ForgotPasswordForm';

// Mock the user service hook
const mockMutate = jest.fn();
jest.mock('@/services/user', () => ({
  useForgotPassword: () => ({
    mutate: mockMutate,
  }),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  const Link = ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
  Link.displayName = 'Link';
  return Link;
});

describe('ForgotPasswordForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial render', () => {
    it('renders the form correctly', () => {
      render(<ForgotPasswordForm />);

      expect(screen.getByRole('heading', { name: /quên mật khẩu/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i })).toBeInTheDocument();
    });

    it('has submit button disabled initially', () => {
      render(<ForgotPasswordForm />);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });
      expect(submitButton).toBeDisabled();
    });

    it('displays back to sign in link', () => {
      render(<ForgotPasswordForm />);
      expect(screen.getByRole('link', { name: /quay lại đăng nhập/i })).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('shows validation error for invalid email', async () => {
      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);

      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur to show validation

      expect(screen.getByText(/email không hợp lệ/i)).toBeInTheDocument();
    });

    it('enables submit button with valid email', async () => {
      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });

      await user.type(emailInput, 'test@example.com');

      expect(submitButton).toBeEnabled();
    });

    it('applies error styling to input with validation errors', async () => {
      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);

      await user.type(emailInput, 'invalid');
      await user.tab();

      expect(emailInput).toHaveClass('border-red-500');
    });
  });

  describe('Form submission', () => {
    it('calls forgot password mutation on valid submission', async () => {
      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      expect(mockMutate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
          onSettled: expect.any(Function),
        })
      );
    });

    it('shows loading state during submission', async () => {
      // Mock pending mutation
      mockMutate.mockImplementation(() => {
        // Don't call callbacks immediately to simulate loading
      });

      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      expect(screen.getByText(/đang gửi/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('shows success state after successful submission', async () => {
      mockMutate.mockImplementation((_, { onSuccess }) => {
        onSuccess();
      });

      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email đã được gửi/i)).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('shows error message on submission failure', async () => {
      mockMutate.mockImplementation((_, { onError }) => {
        onError();
      });

      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/không thể gửi email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Success state', () => {
    beforeEach(async () => {
      mockMutate.mockImplementation((_, { onSuccess }) => {
        onSuccess();
      });

      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);
      const submitButton = screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email đã được gửi/i)).toBeInTheDocument();
      });
    });

    it('displays success message and instructions', () => {
      expect(screen.getByText(/email đã được gửi/i)).toBeInTheDocument();
      expect(screen.getByText(/chúng tôi đã gửi hướng dẫn/i)).toBeInTheDocument();
      expect(screen.getByText(/kiểm tra cả thư mục spam/i)).toBeInTheDocument();
    });

    it('shows resend email button', () => {
      expect(screen.getByRole('button', { name: /gửi lại email/i })).toBeInTheDocument();
    });

    it('allows going back to form with resend button', async () => {
      const resendButton = screen.getByRole('button', { name: /gửi lại email/i });
      await user.click(resendButton);

      // Should show the form again
      expect(screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i)).toBeInTheDocument();
    });
  });

  describe('Callback props', () => {
    it('calls onBackToSignIn when provided', async () => {
      const mockCallback = jest.fn();
      render(<ForgotPasswordForm onBackToSignIn={mockCallback} />);

      const backButton = screen.getByRole('button', { name: /quay lại đăng nhập/i });
      await user.click(backButton);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('uses Link when onBackToSignIn is not provided', () => {
      render(<ForgotPasswordForm />);
      const backLink = screen.getByRole('link', { name: /quay lại đăng nhập/i });
      expect(backLink).toHaveAttribute('href', '/signin');
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<ForgotPasswordForm />);
      expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument();
    });

    it('associates error messages with input', async () => {
      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);

      await user.type(emailInput, 'invalid');
      await user.tab();

      const errorMessage = screen.getByText(/email không hợp lệ/i);
      expect(errorMessage).toBeInTheDocument();
    });

    it('disables input during loading', async () => {
      mockMutate.mockImplementation(() => {
        // Don't resolve to simulate loading
      });

      render(<ForgotPasswordForm />);
      const emailInput = screen.getByPlaceholderText(/nhập địa chỉ email của bạn/i);

      await user.type(emailInput, 'test@example.com');
      await user.click(screen.getByRole('button', { name: /gửi email đặt lại mật khẩu/i }));

      expect(emailInput).toBeDisabled();
    });
  });
});