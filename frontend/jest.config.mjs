// jest.config.mjs
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // jest.setup.ts will be in the frontend root
  testEnvironment: 'jest-environment-jsdom',
  // if using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
  moduleDirectories: ['node_modules', '<rootDir>/'],
  preset: 'ts-jest',
  roots: ['<rootDir>/tests'], // Look for tests in the tests directory
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured by next/jest)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock Next.js navigation and router
    '^next/navigation$': '<rootDir>/tests/__mocks__/next_router.js',
    '^next/router$': '<rootDir>/tests/__mocks__/next_router.js',
    // Mock Next.js link
    '^next/link$': '<rootDir>/tests/__mocks__/next_link.js',
    // Mock Firebase Auth
    '^firebase/auth$': '<rootDir>/tests/__mocks__/firebase_auth.js',
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)