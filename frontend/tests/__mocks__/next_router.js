// frontend/tests/__mocks__/next_router.js
// Mock for next/router
// We need to mock useRouter, as it's used in various components.
// This mock provides a basic implementation that can be spied on or customized in tests.

export const useRouter = jest.fn(() => ({
  route: '/',
  pathname: '',
  query: {},
  asPath: '',
  push: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined), // mock prefetch to return a resolved promise
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  basePath: '',
  isPreview: false,
  // Add any other properties or methods you need to mock
}));

// Mock for next/navigation which is used by App Router
// We'll mock useRouter from next/navigation as well, as components might use it.
// Also, mock useSearchParams and usePathname
export const useSearchParams = jest.fn(() => ({
  get: jest.fn(),
  // Add other methods if your components use them
}));

export const usePathname = jest.fn(() => '/');

// It's also common to mock Link component if you have specific needs,
// but often it's not strictly necessary for unit tests if you're testing component logic
// rather than navigation behavior itself.
// For now, we'll focus on the hooks.

// If you use `next/link`, you might need to mock it too.
// export const Link = jest.fn(({ children, href }) => <a href={href}>{children}</a>);

// Default export for modules that expect a default export
export default {
  useRouter,
  useSearchParams,
  usePathname,
};

// To make this mock effective for `next/router` and `next/navigation`,
// Jest needs to be configured to use it.
// In jest.config.mjs, add or ensure you have:
// moduleNameMapper: {
//   '^next/router$': '<rootDir>/tests/__mocks__/next_router.js',
//   '^next/navigation$': '<rootDir>/tests/__mocks__/next_router.js', // if mocking navigation hooks here
// },
// However, Next.js with `next/jest` often handles some of this automatically.
// For `useRouter` from `next/router` (pages router), `next/jest` provides a mock.
// For `useRouter`, `usePathname`, `useSearchParams` from `next/navigation` (app router),
// we might need to explicitly mock them or provide them via context in tests.

// Let's refine this to be more specific for `next/navigation` as that's what App Router uses.
// We'll create separate mocks if needed, or ensure this one is correctly targeted.
// For now, this structure provides a good starting point.