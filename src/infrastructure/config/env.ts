import { z } from "zod";

/**
 * Environment configuration. Loaded once, validated once.
 *
 * Every variable is optional and has a working default: the heuristic triage
 * engine needs no secrets, so the project boots, seeds and runs out of the box.
 */

const int = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? defaultValue : Number.parseInt(value, 10),
    )
    .pipe(z.number().int());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Postgres connection string. When set, the store persists to the database. */
  DATABASE_URL: z.string().optional(),

  SUPPORT_ORG: z.string().default("Triagely"),
  SUPPORT_SIGNATURE: z.string().default("The {org} Support Team"),

  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  LLM_TIMEOUT_MS: int(30_000).pipe(z.number().min(1000).max(300_000)),
  LLM_MAX_RETRIES: int(2).pipe(z.number().min(0).max(10)),
  LLM_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}