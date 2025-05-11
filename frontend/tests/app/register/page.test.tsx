import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import RegisterPage from '@/app/register/page';
import { createUserWithEmailAndPassword, getAuth, __resetAuthMocks as resetAuthMocks } from 'firebase/auth'; 
import { useRouter, useSearchParams } from 'next/navigation'; 
import { fetchWithAuth } from '@/lib/apiClient'; 

const mockCreateUserWithEmailAndPassword = createUserWithEmailAndPassword as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUseSearchParams = useSearchParams as jest.Mock;
const mockFetch = global.fetch as jest.Mock; 
const mockGetAuth = getAuth as jest.Mock;

const setEnv = (key: string, value: string | undefined) => {
  const originalValue = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  return () => { 
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  };
};

describe('RegisterPage', () => {
  let mockRouterPush: jest.Mock;
  let mockSearchParamsGetGlobal: jest.Mock; // Renamed for clarity
  let cleanupEnv: () => void;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    resetAuthMocks(); 

    mockRouterPush = jest.fn();
    mockUseRouter.mockReturnValue({ push: mockRouterPush });

    // Setup a global mock for useSearchParams().get that can be overridden per test
    mockSearchParamsGetGlobal = jest.fn().mockReturnValue('test-invitation-token'); // Default to valid token
    mockUseSearchParams.mockReturnValue({ get: mockSearchParamsGetGlobal });

    mockFetch.mockClear();
    
    cleanupEnv = setEnv('NEXT_PUBLIC_BACKEND_URL', 'http://localhost:8000/api');

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
    cleanupEnv();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const fillForm = async (options: { skipEmail?: boolean, skipPassword?: boolean, skipConfirmPassword?: boolean, skipFirstName?: boolean, skipLastName?: boolean } = {}) => {
    // Ensure form elements are available before trying to change them
    // This waitFor also allows initial useEffects in the component to run and settle
    await waitFor(() => expect(screen.getByLabelText(/first name/i)).toBeInTheDocument());
    
    await act(async () => {
      if (!options.skipFirstName) fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Test' } });
      if (!options.skipLastName) fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'User' } });
      if (!options.skipEmail) fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
      if (!options.skipPassword) fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
      if (!options.skipConfirmPassword) fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    });
  };

  it('renders the registration form when token and backend URL are present', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token'); // Explicitly set for this test
    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument());
    expect(screen.queryByText(/Invalid or missing registration token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Backend service URL is not configured/i)).not.toBeInTheDocument();
  });

  it('shows an error and "Go to Login" button if invitation token is missing', async () => {
    mockSearchParamsGetGlobal.mockReturnValue(null); // Explicitly set for this test
    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByText(/Invalid or missing registration token/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /go to login/i})).toBeInTheDocument();
  });

  it('shows an error and "Go to Login" button if backend URL is not configured', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token'); // Valid token
    const cleanup = setEnv('NEXT_PUBLIC_BACKEND_URL', undefined); // Invalid backend URL
    render(<RegisterPage />);
    await waitFor(() => expect(screen.getByText(/Backend service URL is not configured/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /go to login/i})).toBeInTheDocument();
    cleanup();
  });
  
  it('shows error if passwords do not match', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i })); 
    await fillForm({ skipConfirmPassword: true });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'mismatchedpassword' } });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));
    });
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('shows error if any field is empty', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i }));
    // Ensure initial useEffects don't show token/backend errors by waiting for the form to be active
    await waitFor(() => {
        expect(screen.queryByText(/Invalid or missing registration token/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Backend service URL is not configured/i)).not.toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Test' } }); 
      fireEvent.click(screen.getByRole('button', { name: /register/i }));
    });
    
    expect(await screen.findByText('Please fill in all fields.')).toBeInTheDocument();
  });

  it('successfully registers user, calls backend, and redirects', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    const mockUser = { 
      uid: 'test-uid-success', 
      email: 'test@example.com', 
      getIdToken: jest.fn().mockResolvedValue('test-id-token-success') 
    };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    // getAuth().currentUser will be set by the createUserWithEmailAndPassword mock in firebase_auth.js

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'User registered successfully' }),
    });

    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i }));
    await fillForm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /register/i })); });

    await waitFor(() => expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled());
    await waitFor(() => expect(mockUser.getIdToken).toHaveBeenCalled());
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(await screen.findByText('Registration successful! Redirecting to login...')).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(2000); });
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/login'));
  });

  it('handles Firebase createUser error (e.g., email already in use)', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    const firebaseError = { code: 'auth/email-already-in-use', message: 'Email already in use' };
    mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(firebaseError);

    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i }));
    await fillForm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /register/i })); });

    expect(await screen.findByText('Registration failed: This email address is already in use.')).toBeInTheDocument();
  });

  it('handles backend registration failure and attempts to delete Firebase user', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    const createdUserMock = { 
        uid: 'test-uid-backend-fail', 
        email: 'test@example.com', 
        getIdToken: jest.fn().mockResolvedValue('test-id-token-backend-fail'),
        delete: jest.fn().mockResolvedValue(undefined)
    };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: createdUserMock });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Backend validation failed' }),
    });

    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i }));
    await fillForm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /register/i })); });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(await screen.findByText('Registration failed: Backend validation failed')).toBeInTheDocument();
    await waitFor(() => expect(createdUserMock.delete).toHaveBeenCalled());
  });

  it('handles backend registration failure where response is not valid JSON', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    const createdUserMock = { 
        uid: 'test-uid-json-fail', 
        email: 'test@example.com', 
        getIdToken: jest.fn().mockResolvedValue('test-id-token-json-fail'),
        delete: jest.fn().mockResolvedValue(undefined)
    };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: createdUserMock });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("Invalid JSON")), 
      text: () => Promise.resolve("Internal Server Error HTML page") 
    });
  
    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i }));
    await fillForm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /register/i })); });
  
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(await screen.findByText('Registration failed: Server error: 500')).toBeInTheDocument();
    await waitFor(() => expect(createdUserMock.delete).toHaveBeenCalled());
  });

  it('disables button and shows loading text during registration', async () => {
    mockSearchParamsGetGlobal.mockReturnValue('test-invitation-token');
    const mockUser = { 
      uid: 'test-uid-loading', 
      email: 'test@example.com', 
      getIdToken: jest.fn().mockResolvedValue('test-id-token-loading') 
    };
    mockCreateUserWithEmailAndPassword.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => {
        resolve({ user: mockUser });
      }, 10))
    );
    // Ensure getAuth().currentUser is this user when fetchWithAuth is called
    // This is handled by the createUserWithEmailAndPassword mock setting mockAuthInstance.currentUser
    
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({}) }), 10))
    );

    render(<RegisterPage />);
    await waitFor(() => screen.getByRole('button', { name: /register/i }));
    await fillForm();
    const registerButton = screen.getByRole('button', { name: /register/i });
    
    await act(async () => { fireEvent.click(registerButton); });

    expect(registerButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /registering.../i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Registration successful! Redirecting to login...')).toBeInTheDocument(), { timeout: 1000 });
    await act(async () => { jest.advanceTimersByTime(2000); });
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/login'));
  });
});