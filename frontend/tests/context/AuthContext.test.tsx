import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { 
  __resetAuthMocks as resetAuthMocks,
  __simulateAuthStateChanged as simulateAuthStateChanged,
  __simulateAuthStateError as simulateAuthStateError,
  __getMockUser as getMockUser,
  __setNextUserToken as setNextUserToken,
  onAuthStateChanged // To check if it was called
} from 'firebase/auth'; // Mocked
import React from 'react';

// Helper component to consume the context and display its values
const TestConsumerComponent = () => {
  const { user, idToken, loading, error } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (user) return <div>User: {user.email}, Token: {idToken}</div>;
  return <div>No User</div>;
};

describe('AuthContext', () => {
  beforeEach(() => {
    resetAuthMocks();
    // Ensure onAuthStateChanged is called when AuthProvider mounts
    // The mock for onAuthStateChanged is set up to store the callback.
  });

  it('initial state is loading, then no user if Firebase returns null', async () => {
    const { findByText } = render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    // Initially, it should be loading
    expect(await findByText('Loading...')).toBeInTheDocument();

    // Simulate Firebase onAuthStateChanged callback with no user
    act(() => {
      simulateAuthStateChanged(null);
    });

    // Now it should show No User
    expect(await findByText('No User')).toBeInTheDocument();
  });

  it('updates user and idToken when Firebase user logs in', async () => {
    const mockUser = getMockUser('test@example.com', 'login1', 'initial-token');
    setNextUserToken(mockUser, 'user-token-123'); // Set what getIdToken for this user will return

    const { findByText } = render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    expect(await findByText('Loading...')).toBeInTheDocument();

    act(() => {
      simulateAuthStateChanged(mockUser);
    });
    
    await waitFor(() => {
      expect(mockUser.getIdToken).toHaveBeenCalled();
    });

    expect(await findByText('User: test@example.com, Token: user-token-123')).toBeInTheDocument();
  });

  it('clears user and idToken when Firebase user logs out', async () => {
    const mockUser = getMockUser('test@example.com', 'logout1', 'active-token');
    setNextUserToken(mockUser, 'user-token-456');

    const { findByText } = render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    // Initial login
    act(() => {
      simulateAuthStateChanged(mockUser);
    });
    await findByText('User: test@example.com, Token: user-token-456');

    // Simulate logout
    act(() => {
      simulateAuthStateChanged(null);
    });
    expect(await findByText('No User')).toBeInTheDocument();
  });

  it('handles error when getIdToken fails', async () => {
    const mockUser = getMockUser('test@example.com', 'tokenfail', 'bad-token');
    const tokenError = new Error('Failed to retrieve token');
    setNextUserToken(mockUser, tokenError); // Configure getIdToken to reject

    const { findByText } = render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    expect(await findByText('Loading...')).toBeInTheDocument();

    act(() => {
      simulateAuthStateChanged(mockUser);
    });

    await waitFor(() => {
      expect(mockUser.getIdToken).toHaveBeenCalled();
    });
    
    expect(await findByText(`Error: ${tokenError.message}`)).toBeInTheDocument();
  });

  it('handles error from onAuthStateChanged itself', async () => {
    const authStateError = new Error('Firebase auth listener failed');

    const { findByText } = render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    expect(await findByText('Loading...')).toBeInTheDocument();

    act(() => {
      simulateAuthStateError(authStateError);
    });

    expect(await findByText(`Error: ${authStateError.message}`)).toBeInTheDocument();
  });
  
  it('unsubscribes from onAuthStateChanged on unmount', () => {
    const { unmount } = render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    
    // Check that onAuthStateChanged was called (to get the unsubscribe function)
    expect(onAuthStateChanged).toHaveBeenCalled();
    const mockUnsubscribe = onAuthStateChanged.mock.results[0].value; // Get the returned unsubscribe function from the mock
    
    expect(mockUnsubscribe).not.toHaveBeenCalled(); // Not called yet
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1); // Called on unmount
  });
});