import { getEnv } from "@/infrastructure/config/env";
import { log } from "@/infrastructure/observability/logger";

/**
 * Minimal OpenAI-compatible chat client.
 *
 * Not a vendor SDK on purpose: the platform should work against OpenAI, Azure
 * OpenAI, or a self-hosted gateway behind one interface. Bounded timeout,
 * exponential backoff with jitter, honours Retry-After, and never retries a
 * request that failed structural validation.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
}

export class LlmError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number | null; retryable?: boolean } = {}) {
    super(message);
    this.name = "LlmError";
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export interface LlmClientOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

export class LlmClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: LlmClientOptions = {}) {
    const env = getEnv();
    this.baseUrl = (options.baseUrl ?? env.LLM_BASE_URL).replace(/\/$/, "");
    this.apiKey = options.apiKey ?? env.LLM_API_KEY;
    this.model = options.model ?? env.LLM_MODEL;
    this.timeoutMs = options.timeoutMs ?? env.LLM_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? env.LLM_MAX_RETRIES;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async extractJson<T>(params: {
    system: string;
    user: string;
    validate: (raw: unknown) => T;
    temperature?: number;
  }): Promise<LlmResponse<T>> {
    const messages: ChatMessage[] = [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ];

    const payload = {
      model: this.model,
      messages,
      temperature: params.temperature ?? 0,
      response_format: { type: "json_object" },
    };

    const raw = await this.#request(payload);
    const content = raw.text.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      throw new LlmError(`Model returned unparseable JSON: ${(error as Error).message}`, {
        status: raw.status,
        retryable: true,
      });
    }

    return {
      data: params.validate(parsed),
      usage: {
        inputTokens: raw.usage.inputTokens,
        outputTokens: raw.usage.outputTokens,
      },
      model: raw.model,
      latencyMs: raw.latencyMs,
    };
  }

  async #request(
    payload: unknown,
    attempt = 1,
  ): Promise<{
    text: string;
    model: string;
    status: number;
    usage: { inputTokens: number; outputTokens: number };
    latencyMs: number;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const retryable = RETRYABLE_STATUS.has(response.status);

        if (retryable && attempt <= this.maxRetries) {
          const delay = this.#backoffMs(attempt, response.headers.get("retry-after"));
          log.warn(`LLM request failed (status ${response.status}), retrying in ${delay}ms`);
          await sleep(delay);
          return this.#request(payload, attempt + 1);
        }

        throw new LlmError(`LLM request failed with status ${response.status}: ${body.slice(0, 300)}`, {
          status: response.status,
          retryable,
        });
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        model: data.model ?? this.model,
        status: response.status,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof LlmError) throw error;

      const isAbort = error instanceof Error && error.name === "AbortError";
      const retryable = isAbort || error instanceof TypeError;

      if (retryable && attempt <= this.maxRetries) {
        const delay = this.#backoffMs(attempt, null);
        log.warn(`LLM transport error, retrying in ${delay}ms`);
        await sleep(delay);
        return this.#request(payload, attempt + 1);
      }

      throw new LlmError(
        isAbort
          ? `LLM request timed out after ${this.timeoutMs}ms`
          : `LLM transport failure: ${(error as Error).message}`,
        { retryable },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  #backoffMs(attempt: number, retryAfterHeader: string | null): number {
    const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? "", 10);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, 30_000);
    }
    const exponential = 500 * 2 ** (attempt - 1);
    return Math.min(exponential + Math.floor(Math.random() * 250), 20_000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/m.exec(text.trim());
  return (fenced?.[1] ?? text).trim();
}