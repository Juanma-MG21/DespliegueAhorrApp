const { createRequire } = require('node:module');
const path = require('node:path');

const frontend = path.resolve(__dirname, '../Frontend');
const requireFrontend = createRequire(path.join(frontend, 'package.json'));

module.exports = {
  rootDir: '..',
  roots: ['<rootDir>/.test'],
  modulePaths: [path.join(frontend, 'node_modules')],
  testMatch: ['**/.test/**/*.test.jsx'],
  testEnvironment: requireFrontend.resolve('jest-environment-jsdom'),
  setupFiles: ['<rootDir>/.test/setup.cjs'],
  setupFilesAfterEnv: [requireFrontend.resolve('@testing-library/jest-dom')],
  transform: {
    '^.+\\.jsx?$': [requireFrontend.resolve('babel-jest'), {
      presets: [
        [requireFrontend.resolve('@babel/preset-env'), { targets: { node: 'current' } }],
        [requireFrontend.resolve('@babel/preset-react'), { runtime: 'automatic' }],
      ],
    }],
  },
  moduleNameMapper: { '\\.css$': '<rootDir>/.test/estilos.cjs' },
  clearMocks: true,
  restoreMocks: true,
};
