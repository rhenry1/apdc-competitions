// @ts-check
const { defineConfig, devices } = require('@playwright/test');

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
  },
  // W3.7 — the audience (parents checking a dance schedule) is almost
  // certainly iPhone-heavy, and PWA install/offline behavior is known to
  // differ on WebKit. `webkit` approximates desktop Safari's rendering/JS
  // engine; it's not a substitute for testing on a real iOS device (no
  // automation tool can drive the real "Add to Home Screen" flow or iOS's
  // actual storage-eviction policy), but it catches real engine-level bugs
  // Chromium-only testing never would.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional escape hatch for environments with a pre-installed
        // browser at a nonstandard path (e.g. sandboxed dev containers).
        launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : {},
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
