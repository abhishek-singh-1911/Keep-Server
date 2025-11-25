module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  rootDir: './',
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  setupFiles: ['dotenv/config'], // This loads your .env file before tests run
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};