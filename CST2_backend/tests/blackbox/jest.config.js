module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.test.js"],
  testTimeout: 30000,
  reporters: [
    "default",
    [
      "jest-html-reporter",
      {
        pageTitle: "SolarTrust Black Box Test Report",
        outputPath: "tests/blackbox/reports/blackbox-report.html",
        includeFailureMsg: true,
        includeConsoleLog: true,
      },
    ],
  ],
};
