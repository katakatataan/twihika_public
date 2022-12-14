import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  verbose: true,
  roots: ["<rootDir>"],
  // setupFiles: ["<rootDir>/test/jest-setup.js"],
  testMatch: ["**/test/integration/**/*.(spec|test).(ts|tsx|js)"],
  testPathIgnorePatterns: ["<rootDir>/.next", "<rootDir>/playwright/"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }],
  },
  transformIgnorePatterns: ["/node_modules/", "^.+\\.module\\.(css|sass|scss)$"],
  testEnvironment: "jsdom",
  // resolver: `<rootDir>/test/jest-resolver.js`,
  // moduleNameMapper: {
    // "^@components(.*)$": "<rootDir>/components$1",
    // "^@lib(.*)$": "<rootDir>/lib$1",
    // "^@server(.*)$": "<rootDir>/server$1",
    // "^@ee(.*)$": "<rootDir>/ee$1",
  // },
};

export default config;
