/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // your source imports as "./x.js" per NodeNext, but the real file is "./x.ts" —
    // this strips the .js so Jest resolves to the actual TS file
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  testMatch: ["**/test/**/*.test.ts"],
  clearMocks: true,
};
