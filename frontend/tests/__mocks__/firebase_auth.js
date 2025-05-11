// frontend/tests/__mocks__/firebase_auth.js

let mockAuthInstance = {
  currentUser: null,
};

let onAuthStateChangedCallback = null;
let onAuthStateChangedErrorCallback = null;
let mockUnsubscribe = jest.fn();

export const getAuth = jest.fn(() => mockAuthInstance);

const createMockUser = (email, uidSuffix = '', tokenValue = 'test-id-token') => ({
  uid: `test-uid-${uidSuffix || email}`,
  email: email,
  getIdToken: jest.fn(() => Promise.resolve(tokenValue)),
  delete: jest.fn(() => {
    if (mockAuthInstance.currentUser && mockAuthInstance.currentUser.uid === `test-uid-${uidSuffix || email}`) {
      mockAuthInstance.currentUser = null;
    }
    return Promise.resolve();
  }),
});

export const createUserWithEmailAndPassword = jest.fn((auth, email, password) => {
  const newUser = createMockUser(email, 'created');
  mockAuthInstance.currentUser = newUser;
  // Simulate onAuthStateChanged if a callback is registered
  if (onAuthStateChangedCallback) {
    onAuthStateChangedCallback(newUser);
  }
  return Promise.resolve({ user: newUser });
});

export const signInWithEmailAndPassword = jest.fn((auth, email, password) => {
  const signedInUser = createMockUser(email, 'signedIn');
  mockAuthInstance.currentUser = signedInUser;
  // Simulate onAuthStateChanged if a callback is registered
  if (onAuthStateChangedCallback) {
    onAuthStateChangedCallback(signedInUser);
  }
  return Promise.resolve({ user: signedInUser });
});

export const signOut = jest.fn(() => {
  mockAuthInstance.currentUser = null;
  // Simulate onAuthStateChanged if a callback is registered
  if (onAuthStateChangedCallback) {
    onAuthStateChangedCallback(null);
  }
  return Promise.resolve();
});

export const onAuthStateChanged = jest.fn((auth, successCb, errorCb) => {
  onAuthStateChangedCallback = successCb;
  onAuthStateChangedErrorCallback = errorCb;
  // Optionally, immediately call with current state or let tests trigger it
  // For AuthContext, it's better to let the test trigger to simulate async nature.
  // successCb(mockAuthInstance.currentUser); // Initial call if desired
  return mockUnsubscribe;
});

export const getIdToken = jest.fn((user, forceRefresh) => {
  // This global mock for getIdToken might conflict if user objects have their own.
  // Prefer user.getIdToken() from the mock user objects.
  // This is a fallback or if getIdToken is called directly with a user object.
  if (user && typeof user.getIdToken === 'function') {
    return user.getIdToken(forceRefresh);
  }
  return Promise.resolve('fallback-test-id-token');
});


// --- Test utilities for controlling the mock ---
export const __resetAuthMocks = () => {
  mockAuthInstance = { currentUser: null };
  onAuthStateChangedCallback = null;
  onAuthStateChangedErrorCallback = null;
  mockUnsubscribe.mockClear();
  
  getAuth.mockClear();
  createUserWithEmailAndPassword.mockClear();
  signInWithEmailAndPassword.mockClear();
  signOut.mockClear();
  onAuthStateChanged.mockClear();
  getIdToken.mockClear();
};

export const __simulateAuthStateChanged = (user) => {
  if (onAuthStateChangedCallback) {
    mockAuthInstance.currentUser = user; // Keep mockAuthInstance in sync
    onAuthStateChangedCallback(user);
  } else {
    // console.warn('onAuthStateChangedCallback not registered, cannot simulate change.');
  }
};

export const __simulateAuthStateError = (error) => {
  if (onAuthStateChangedErrorCallback) {
    onAuthStateChangedErrorCallback(error);
  } else {
    // console.warn('onAuthStateChangedErrorCallback not registered, cannot simulate error.');
  }
};

export const __getMockUser = (email, uidSuffix = '', tokenValue = 'test-id-token') => {
    return createMockUser(email, uidSuffix, tokenValue);
};

export const __setNextUserToken = (userMock, tokenValueOrError) => {
    if (tokenValueOrError instanceof Error) {
        userMock.getIdToken.mockImplementationOnce(() => Promise.reject(tokenValueOrError));
    } else {
        userMock.getIdToken.mockImplementationOnce(() => Promise.resolve(tokenValueOrError));
    }
};