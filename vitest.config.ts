import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Characterization-test harness for the app's pure logic cores.
// - vite-tsconfig-paths makes the tsconfig `@/*` and `@app/*` aliases resolve.
// - jsdom gives us window.localStorage + document for the localStorage- and
//   locale-reading cores.
// - test/setup.ts resets localStorage between tests so each case is hermetic.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
});
