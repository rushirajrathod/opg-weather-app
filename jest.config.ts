import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Only look for tests inside the /tests directory
  roots: ['<rootDir>/tests'],
  // Map the @/ path alias so tests resolve imports the same way Next.js does
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Use the test-specific tsconfig which sets module/moduleResolution for Node
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tests/tsconfig.json' }],
  },
};

export default config;
