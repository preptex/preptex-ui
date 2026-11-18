module.exports = {
  roots: ['<rootDir>/src'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['<rootDir>/src/**/*.{spec,test}.{ts,tsx}'],
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': 'babel-jest',
    '^.+\\.css$': '<rootDir>/scripts/css-stub.cjs',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@preptex/core|@marijn/find-cluster-break)/)',
  ],
  resetMocks: true,
};
