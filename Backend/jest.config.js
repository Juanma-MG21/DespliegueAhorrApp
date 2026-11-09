module.exports = {
  testEnvironment: "node",
  // Los tests viven fuera de Backend/, en <raíz>/test/backend
  roots: ["<rootDir>/../test/backend"],
  testMatch: ["**/*.test.js"],
  // Permite que los tests (fuera de Backend/) encuentren supertest, jsonwebtoken, etc.
  modulePaths: ["<rootDir>/node_modules"],
  setupFiles: ["<rootDir>/../test/backend/setupEnv.js"],
  clearMocks: true,
};