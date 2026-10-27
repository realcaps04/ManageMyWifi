import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  AGENT_SHARED_SECRET: z.string().min(8).default("dev-agent-shared-secret"),
  SESSION_SECRET: z.string().min(8).optional(),
  /** WiFi portal sign-in — SSID name users must enter */
  WIFI_LOGIN_SSID: z.string().optional(),
  /** WiFi portal sign-in — shared verification password */
  WIFI_LOGIN_PASSWORD: z.string().optional(),
  DEV_NETWORK_ID: z.string().uuid().optional(),
  DEV_AUTH_BYPASS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid API environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const supabaseConfigured = Boolean(
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
);
