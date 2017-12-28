module.exports = {
  setupTestFrameworkScriptFile: "<rootDir>/__test__/init.ts",
  mapCoverage: true,
  coverageDirectory: '<rootDir>/../coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__test__'],
  moduleFileExtensions: ['ts', 'js'],
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': '<rootDir>/../node_modules/ts-jest/preprocessor.js',
  },
  globals: {
    'ts-jest': {
      skipBabel: true
    }
  }
}
