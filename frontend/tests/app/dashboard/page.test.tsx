import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { useAuth } from '@/context/AuthContext'; // We will mock this
import { signOut } from 'firebase/auth'; // Mocked (already configured in jest.setup.js or via firebase_auth.js mock)
import { useRouter } from 'next/navigation'; // Mocked

// Mock the useAuth hook
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock Firebase signOut
// The actual mock implementation is in tests/__mocks__/firebase_auth.js
// but we need to ensure it's typed correctly here if we re-declare it.
const mockSignOut = signOut as jest.Mock;

// Mock Next.js router
const mockUseRouter = useRouter as jest.Mock;


describe('DashboardPage', () => {
  let mockRouterPush: jest.Mock;
  const mockUseAuth = useAuth as jest.Mock; // Typed access to the mocked hook

  beforeEach(() => {
    mockRouterPush = jest.fn();
    mockUseRouter.mockReturnValue({
      push: mockRouterPush,
      // Add other router methods if needed by the component
    });
    mockSignOut.mockClear();
    mockUseAuth.mockClear(); // Clear mock usage data
  });

  it('displays loading message when auth state is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, error: null, idToken: null });
    render(<DashboardPage />);
    expect(screen.getByText(/loading dashboard.../i)).toBeInTheDocument();
  });

  it('redirects to /login if user is not authenticated and not loading', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: null, idToken: null });
    render(<DashboardPage />);
    // The component itself shows "Redirecting to login..." briefly before useEffect kicks in.
    // Let's check for that text first, then the redirect.
    expect(screen.getByText(/redirecting to login.../i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });
  });

  it('displays auth error message if auth context provides an error', () => {
    const authError = new Error("Failed to refresh token");
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: authError, idToken: null });
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: /authentication error/i})).toBeInTheDocument();
    expect(screen.getByText(authError.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to login/i})).toBeInTheDocument();
  });
  
  it('displays dashboard content when user is authenticated', () => {
    const mockUser = { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User' };
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, error: null, idToken: 'test-token' });
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: /welcome to your dashboard, test user!/i })).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText(`UID: ${mockUser.uid}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('displays user email as fallback if displayName is not available', () => {
    const mockUser = { uid: 'test-uid', email: 'test@example.com', displayName: null };
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, error: null, idToken: 'test-token' });
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: `Welcome to your Dashboard, ${mockUser.email}!` })).toBeInTheDocument();
  });

  it('calls signOut and redirects to /login on logout button click', async () => {
    const mockUser = { uid: 'test-uid', email: 'test@example.com' };
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, error: null, idToken: 'test-token' });
    mockSignOut.mockResolvedValueOnce(undefined); // Firebase signOut is successful

    render(<DashboardPage />);
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });
  });

  it('handles error during logout', async () => {
    const mockUser = { uid: 'test-uid', email: 'test@example.com' };
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, error: null, idToken: 'test-token' });
    const logoutError = new Error('Logout failed');
    mockSignOut.mockRejectedValueOnce(logoutError);
    
    // Mock console.error to verify it's called
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<DashboardPage />);
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    
    // Check if error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Logout Error:', logoutError);
    
    // User should ideally remain on the dashboard or see an error message.
    // The current implementation doesn't show a UI error for logout failure, just logs it.
    // The redirect to /login might still happen if not guarded by successful signOut.
    // Based on current code: router.push('/login') is called regardless of signOut success in the catch block.
    // This might be desired or not. For this test, we confirm the current behavior.
    // However, the code *only* calls router.push('/login') in the try block after await signOut.
    // So, if signOut fails, it goes to catch, logs, and *doesn't* push.
    // This means the user would stay on the dashboard.
    expect(mockRouterPush).not.toHaveBeenCalledWith('/login'); 
    expect(screen.getByRole('heading', { name: /welcome to your dashboard/i })).toBeInTheDocument(); // Still on dashboard

    consoleErrorSpy.mockRestore();
  });
});