/**
 * Jest test setup - runs before all tests
 */

// Increase timeout for asset operations
jest.setTimeout(30000);

// Mock console.log in tests to reduce noise
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidHash(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidHash(received) {
    const isValid = typeof received === 'string' && 
                   received.length === 64 && 
                   /^[a-f0-9]{64}$/.test(received);
    
    return {
      message: () => `expected ${received} to be a valid SHA-256 hash`,
      pass: isValid
    };
  }
});

export {};