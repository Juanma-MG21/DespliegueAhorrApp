const path = require('node:path');

module.exports = {
  rootDir: '..',
  roots: ['<rootDir>/.test'],
  modulePaths: [path.resolve(__dirname, '../Backend/node_modules')],
  testMatch: ['**/.test/**/*.test.cjs'],
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
};
