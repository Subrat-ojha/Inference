import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    tracker: {
      name: "Engineering tracker API",
      source: "functions/tracker.ts",
    },
  },
});
