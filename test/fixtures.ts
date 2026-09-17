import type { Fetch, SystemOneResult, TypeSafeClientConfig } from "@typesafe-ai/sdk";
import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import type { FixtureRequest, FixtureSource } from "../src/index.ts";
import { fixtureFetch } from "../src/index.ts";

export const MODEL = "jev-latest";

export const TicketState = z.object({
  message: z.string(),
  policy: z.string(),
});

export const ticket = {
  message: "Trying to connect Stripe for 3 days, it keeps failing. Losing sales.",
  policy: "Duplicate charges are eligible for a full refund.",
};

export const ask = {
  department: choice("Which team should handle `message`?", {
    billing: "Payment or subscription issues",
    technical: "Bugs or integration problems",
    sales: "Pricing or account questions",
  }),
  frustration: score("How frustrated does the customer appear in `message`?", [
    "Calm, just stating facts",
    "Frustrated but civil",
    "Very angry, strong language",
  ]),
  isUrgent: noul("Does `message` convey urgency or time-sensitivity?"),
};

export const recorded: SystemOneResult<typeof ask> = {
  model: MODEL,
  answers: {
    department: {
      type: "choice",
      choice: "technical",
      probabilities: { billing: 0.159, technical: 0.84, sales: 0.001 },
      confidence: 0.596,
    },
    frustration: {
      type: "score",
      score: 1.035,
      confidence: 0.842,
      legend: {
        0: "Calm, just stating facts",
        1: "Frustrated but civil",
        2: "Very angry, strong language",
      },
      probabilities: { 0: 0.08, 1: 0.82, 2: 0.1 },
    },
    isUrgent: { type: "noul", noul: 0.999 },
  },
  usage: { input_tokens: 312, output_tokens: 48 },
};

export function testClient(fetch: Fetch, config: TypeSafeClientConfig = {}): TypeSafeClient {
  return new TypeSafeClient({ apiKey: "test", defaultModel: MODEL, fetch, ...config });
}

/** Records the bodies the SDK would have sent, then answers from `source`. */
export function recording(source: FixtureSource): {
  requests: FixtureRequest[];
  fetch: Fetch;
} {
  const requests: FixtureRequest[] = [];
  const fetch = fixtureFetch((request) => {
    requests.push(request);
    return typeof source === "function" ? source(request) : source;
  });
  return { requests, fetch };
}
