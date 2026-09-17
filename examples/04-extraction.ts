import { z } from "zod";
import type { SystemOneResult } from "../src/index.ts";
import { choice, fixtureFetch, noul, semantics } from "../src/index.ts";

const MODEL = "jev-latest";

const Email = z.object({ text: z.string() });

const ask = {
  intent: choice("What does the sender of `text` want?", {
    cancel: "They want the order cancelled",
    reschedule: "They want delivery moved to another time",
    whereabouts: "They want to know where the order is",
    not_stated: "None of the above, or there is no clear request",
  }),
  timeframe: choice("When do they want it, if they say at all?", {
    today: "Today",
    this_week: "Within the current week",
    next_week: "The following week",
    not_stated: "They do not say, or say something else",
  }),
  hasOrderReference: noul("Does `text` include an order id or a tracking number?"),
};

const recorded: SystemOneResult<typeof ask> = {
  model: MODEL,
  answers: {
    intent: {
      type: "choice",
      choice: "whereabouts",
      probabilities: { cancel: 0.02, reschedule: 0.03, whereabouts: 0.93, not_stated: 0.02 },
      confidence: 0.94,
    },
    timeframe: {
      type: "choice",
      choice: "not_stated",
      probabilities: { today: 0.01, this_week: 0.06, next_week: 0.02, not_stated: 0.91 },
      confidence: 0.89,
    },
    hasOrderReference: { type: "noul", noul: 0.97 },
  },
  usage: { input_tokens: 148, output_tokens: 12 },
};

const route = semantics({
  state: Email,
  ask,
  config: { apiKey: "offline", fetch: fixtureFetch(recorded) },
});

const result = await route.ask({
  text: "Hi, my parcel was meant to arrive Tuesday but the tracking has not moved since. Order A-104. Where is it?",
});

const SLOTS = { today: "today", this_week: "this week", next_week: "next week" } as const;

const timeframe = result.timeframe === "not_stated" ? undefined : SLOTS[result.timeframe];

const plan = !result.hasOrderReference
  ? "ask_for_order_reference"
  : result.intent === "whereabouts"
    ? "check_carrier"
    : `queue_${result.intent}`;

console.log({
  plan,
  intent: result.intent,
  intentConfidence: result.$confidence.intent,
  timeframe,
  timeframeConfidence: result.$confidence.timeframe,
  intentDistribution: result.$probabilities.intent,
  model: result.$model,
});
