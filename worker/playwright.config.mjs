import { defineConfig } from "@playwright/test";

const chromeBin =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const docsPort = Number(process.env.PLAYWRIGHT_DOCS_PORT || "4173");

export default defineConfig({
  testDir: "./test/browser",
  timeout: 30_000,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${docsPort}`,
    headless: true,
    launchOptions: {
      executablePath: chromeBin,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: `python3 -m http.server ${docsPort} --bind 127.0.0.1 --directory ../docs`,
    port: docsPort,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
