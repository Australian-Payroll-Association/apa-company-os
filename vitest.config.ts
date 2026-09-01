import { defineConfig } from "vitest/config";

// Minimal harness scoped to the pure SLA math module (E8). No jsdom, no path
// aliases needed — lib/admin/sla.ts only imports a sibling constants module.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
