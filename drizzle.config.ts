import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is required for database migrations.");
}
const databaseUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
databaseUrl.searchParams.set("sslmode", "verify-full");

export default defineConfig({
  schema: "./functions/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl.toString(),
  },
});
