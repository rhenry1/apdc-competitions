// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Local: use all cores (this dev sandbox is CPU-throttled, so the default
  // half-cores is slow). CI keeps its own default for runner stability.
  workers: process.env.CI ? undefined : 4,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Optional escape hatch for environments with a pre-installed browser
    // at a nonstandard path (e.g. sandboxed dev containers).
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
