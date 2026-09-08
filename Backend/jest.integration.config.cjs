module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/integration"],
  setupFiles: ["<rootDir>/tests/integration/setup.ts"],
  testMatch: ["**/*.integration.test.ts"],
  testTimeout: 30000,
  maxWorkers: 1
};
