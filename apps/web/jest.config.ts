export default {
  displayName: 'web',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': '<rootDir>/jest.transformer.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  moduleNameMapper: {
    // Resolve Vite-style tilde alias to the source root
    '^~/(.*)$': '<rootDir>/src/$1',
    // Resolve shared lib path alias used across the monorepo
    '^@nx-temp/data$': '<rootDir>/../../libs/data/src/index.ts',
    // Stub CSS imports (Mantine ships styles separately, but be safe)
    '\\.css$': '<rootDir>/src/__mocks__/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: '../../coverage/apps/web',
};
