module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/../tsconfig.jest.json",
      },
    ],
  },
  setupFiles: ["<rootDir>/../test/jest-globals-setup.cjs"],
  testEnvironment: "node",
};
