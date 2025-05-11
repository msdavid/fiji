// jest.setup.ts
import '@testing-library/jest-dom'

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}), // Default mock response
    ok: true,
    status: 200,
  } as Response) // Type assertion for Response
);