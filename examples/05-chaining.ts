import { z } from "zod";
import type { FixtureRequest } from "../src/index.ts";
import { choice, fixtureFetch, noul, semantics } from "../src/index.ts";

const MODEL = "jev-latest";

const Notice = z.object({ text: z.string() });
const Review = z.object({ notice: z.string(), policy: z.string() });

const POLICIES = {
  invoice: "Invoices must state an amount, a due date, and the issuing entity.",
  contract: "Contracts must name both parties and a termination clause.",
  receipt: "Receipts must state the amount paid and the date of payment.",
} as const;

const fetch = fixtureFetch((request: FixtureRequest) => {
  const asked = Object.keys((request.questions ?? {}) as Record<string, unknown>);

  if (asked.includes("kind")) {
    return {
      model: MODEL,
      answers: {
        kind: {
          type: "choice" as const,
          choice: "invoice",
          probabilities: { invoice: 0.91, contract: 0.04, receipt: 0.05 },
          confidence: 0.91,
        },
      },
      usage: { input_tokens: 84, output_tokens: 4 },
    };
  }

  return {
    model: MODEL,
    answers: { complies: { type: "noul" as const, noul: 0.28 } },
    usage: { input_tokens: 132, output_tokens: 3 },
  };
});

const classify = semantics({
  state: Notice,
  ask: {
    kind: choice("What kind of document is `text`?", {
      invoice: "A request for payment",
      contract: "An agreement between two parties",
      receipt: "A record that a payment was made",
    }),
  },
  config: { apiKey: "offline", fetch },
});

const review = semantics({
  state: Review,
  ask: {
    complies: noul("Does `notice` satisfy every requirement stated in `policy`?"),
  },
  config: { apiKey: "offline", fetch },
});

const text = "INVOICE — Acme Ltd. Amount due: 480.00 EUR. Please transfer within 30 days.";

// Answers from one request are never context for another, so a follow-up that
// needs the first answer is a second ask() against a state you build from it.
const { kind } = await classify.ask({ text });
const policy = POLICIES[kind];
const { complies, $model } = await review.ask({ notice: text, policy });

console.log({ kind, policy, complies, model: $model });
