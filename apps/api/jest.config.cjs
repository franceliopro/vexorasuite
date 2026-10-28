module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.json" }],
    "^.+\\.js$": "<rootDir>/../test/esm-transform.cjs",
  },
  transformIgnorePatterns: [
    "node_modules/(?!.*(?:htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities)(?:/|\\\\))",
  ],
  testEnvironment: "node",
};
