import { z } from "zod";
import type { SystemOneResult } from "../src/index.ts";
import { choice, fixtureFetch, noul, score, semantics } from "../src/index.ts";

const MODEL = "jev-latest";
const CONFIDENT = 0.75;

const Ticket = z.object({
  message: z.string(),
  policy: z.string(),
});

const ask = {
  department: choice("Which team should handle `message`?", {
    billing: "Charges, invoices, refunds, or subscriptions",
    technical: "Bugs, integrations, or outages",
    account: "Login, profile, permissions, or security",
  }),
  refundRequested: noul("Does `message` explicitly ask for money back or an account credit?"),
  frustration: score("How frustrated does the customer appear in `message`?", [
    "Calm and matter-of-fact",
    "Frustrated but civil",
    "Very angry, or threatening to leave",
  ]),
};

const recorded: SystemOneResult<typeof ask> = {
  model: MODEL,
  answers: {
    department: {
      type: "choice",
      choice: "technical",
      probabilities: { billing: 0.14, technical: 0.84, account: 0.02 },
      confidence: 0.83,
    },
    refundRequested: { type: "noul", noul: 0.04 },
    frustration: {
      type: "score",
      score: 1.7,
      confidence: 0.78,
      legend: {
        0: "Calm and matter-of-fact",
        1: "Frustrated but civil",
        2: "Very angry, or threatening to leave",
      },
      probabilities: { 0: 0.06, 1: 0.28, 2: 0.66 },
    },
  },
  usage: { input_tokens: 418, output_tokens: 51 },
};

const triage = semantics({
  state: Ticket,
  ask,
  model: MODEL,
  thresholds: { refundRequested: 0.2 },
  config: {
    apiKey: "offline",
    fetch: fixtureFetch(recorded),
  },
});

const result = await triage.ask({
  message:
    "I've been trying to connect Stripe for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
  policy: "Duplicate charges are eligible for a full refund.",
});

const route =
  result.$confidence.department < CONFIDENT
    ? "human_review"
    : result.department === "billing" && result.refundRequested
      ? "billing_refund"
      : result.department;

const priority =
  result.frustration >= 1.5 && result.$confidence.frustration >= CONFIDENT ? "high" : "normal";

console.log({
  route,
  priority,
  department: result.department,
  departmentConfidence: result.$confidence.department,
  frustration: result.frustration,
  refundRequested: result.refundRequested,
  refundProbability: result.$probabilities.refundRequested,
  model: result.$model,
  usage: result.$usage,
});
