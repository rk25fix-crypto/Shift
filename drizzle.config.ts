import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./drizzle/schema.ts", "./drizzle/auth-schema.ts"],
  out: "./drizzle/migrations",
});
