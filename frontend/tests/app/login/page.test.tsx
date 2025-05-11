import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { signInWithEmailAndPassword } from 'firebase/auth'; // Mocked
import { useRouter } from 'next/navigation'; // Mocked

// Explicitly type the mock implementations
const mockSignInWithEmailAndPassword = signInWithEmailAndPassword as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('LoginPage', () => {
  let mockRouterPush: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    mockSignInWithEmailAndPassword.mockClear();
    
    mockRouterPush = jest.fn();
    mockUseRouter.mockReturnValue({
      push: mockRouterPush,
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      route: '/',
      pathname: '',
      query: {},
      asPath: '',
    });
  });

  it('renders the login form correctly', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('allows user to type in email and password fields', () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    act(() => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
    });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('shows an error message if email or password is not provided', async () => {
    render(<LoginPage />);
    const loginButton = screen.getByRole('button', { name: /login/i });

    await act(async () => {
      fireEvent.click(loginButton);
    });

    expect(await screen.findByText('Please enter both email and password.')).toBeInTheDocument();
    expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('calls signInWithEmailAndPassword and redirects on successful login', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: 'test-uid', email: 'test@example.com' },
    });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(loginButton);
    });
    
    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledTimes(1);
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 
        'test@example.com',
        'password123'
      );
    });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });

    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  it('shows an error message on failed login (invalid credentials)', async () => {
    const error = { code: 'auth/invalid-credential', message: 'Invalid credentials.' };
    mockSignInWithEmailAndPassword.mockRejectedValueOnce(error);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(loginButton);
    });
    
    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledTimes(1);
    });
    
    expect(await screen.findByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('shows an error message for invalid email format', async () => {
    const error = { code: 'auth/invalid-email', message: 'Invalid email format.' };
    mockSignInWithEmailAndPassword.mockRejectedValueOnce(error);
  
    render(<LoginPage />);
  
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });
  
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'invalidemail' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(loginButton);
    });
      
    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledTimes(1);
    });
  
    expect(await screen.findByText('Invalid email format.')).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('shows a generic error message for other Firebase errors', async () => {
    const error = { code: 'auth/internal-error', message: 'Internal server error.' };
    mockSignInWithEmailAndPassword.mockRejectedValueOnce(error);

    render(<LoginPage />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
    });

    await waitFor(() => expect(mockSignInWithEmailAndPassword).toHaveBeenCalled());
    expect(await screen.findByText('Login failed. Please try again later.')).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('disables login button and shows loading text during login attempt', async () => {
    mockSignInWithEmailAndPassword.mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve({ user: {} }), 100));
    });

    render(<LoginPage />);
    const loginButton = screen.getByRole('button', { name: /login/i });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
      fireEvent.click(loginButton);
    });
    
    expect(loginButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /logging in.../i })).toBeInTheDocument();

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard'), { timeout: 500 });
    
    // After redirect, the button might not be in the document.
    // If it is, it should no longer show "Logging in..."
    expect(screen.queryByRole('button', { name: /logging in.../i })).not.toBeInTheDocument();
  });
});