import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Node environment, no jsdom: everything under test here is pure — date and
// time maths, HTML rendering, scraper parsing — and none of it touches a DOM.
//
// The "@" alias is needed because the newsletter modules import siblings by
// the app's path alias. Without it a spec that pulls in lib/marketing-email.ts
// fails to resolve @/lib/supabase and the whole file is skipped, which looks
// like a passing suite.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
