import { jest } from '@darkobits/ts';

export default jest({
  testRunner: 'jest-jasmine2',
  coveragePathIgnorePatterns: [
    '<rootDir>/src/bin',
    '<rootDir>/src/config',
    '<rootDir>/src/etc',
    '<rootDir>/src/index',
    '<rootDir>/src/lib/log'
  ],
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30
    }
  },
  transformIgnorePatterns: []
});
