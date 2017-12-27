module.exports = {
  setupTestFrameworkScriptFile: "./src/__test__/init.ts",
  mapCoverage: true,
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/lib/', '<rootDir>/example/lib/'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': '<rootDir>/node_modules/ts-jest/preprocessor.js',
  },
}
