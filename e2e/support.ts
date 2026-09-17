import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Fetch, TypeSafeClientConfig } from "@typesafe-ai/sdk";
import { TypeSafeClient } from "@typesafe-ai/sdk";

/**
 * This account exposes only aliases (`jev-latest`, `jev-preview`) — there is no
 * addressable immutable id, so a version pin is not expressible on the way in.
 * The API reports the concrete version it resolved on the way out, which is the
 * only drift signal available. `the model we send is one the account offers`
 * guards the alias; `the alias resolves to a concrete version` guards its shape.
 */
export const MODEL = "jev-latest";
export const RESOLVED_MODEL = /^jev-\d+\.\d+\.\d+/;
export const LIVE_TIMEOUT = 30_000;

const ENV_FILE = resolve(import.meta.dirname, "..", ".env");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export const hasApiKey = Boolean(process.env.TYPESAFE_API_KEY?.trim());

/** Live tests skip rather than fail without a key, so forks and CI stay green. */
export function liveTest(timeout = LIVE_TIMEOUT): { skip: string | false; timeout: number } {
  return { skip: hasApiKey ? false : "TYPESAFE_API_KEY is not set", timeout };
}

/**
 * The key is read here and never exported, so it cannot end up in a test name,
 * an assertion message, or a `console.log` of a config object.
 */
export function liveClient(overrides: TypeSafeClientConfig = {}): TypeSafeClient {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set. Copy .env.example to .env.");

  return new TypeSafeClient({
    apiKey,
    defaultModel: MODEL,
    timeout: 20_000,
    retry: { maxRetries: 1 },
    ...overrides,
  });
}

/** Real network, counted. Used to prove a short-circuit actually short-circuited. */
export function countingFetch(): { readonly stats: { calls: number }; readonly fetch: Fetch } {
  const stats = { calls: 0 };
  const fetch: Fetch = (input, init) => {
    stats.calls += 1;
    return globalThis.fetch(input, init);
  };
  return { stats, fetch };
}
