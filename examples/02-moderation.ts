import { z } from "zod";
import type { SystemOneResult } from "../src/index.ts";
import { fixtureFetch, noul, semantics } from "../src/index.ts";

const MODEL = "jev-latest";

const Message = z.object({
  sender: z.string(),
  subject: z.string(),
  body: z.string(),
});

const ask = {
  requestsCredentials: noul(
    "Does `body` ask the recipient to hand over a password, security code, or API key?",
  ),
  offersUnexpectedReward: noul("Does `body` announce an unrequested prize, payment, or reward?"),
  createsTimePressure: noul("Do `subject` or `body` push the recipient to act immediately?"),
  senderIdentityMismatch: noul(
    "Does the organization named in `sender` disagree with the email domain in `sender`?",
  ),
};

const recorded: SystemOneResult<typeof ask> = {
  model: MODEL,
  answers: {
    requestsCredentials: { type: "noul", noul: 0.97 },
    offersUnexpectedReward: { type: "noul", noul: 0.93 },
    createsTimePressure: { type: "noul", noul: 0.81 },
    senderIdentityMismatch: { type: "noul", noul: 0.88 },
  },
  usage: { input_tokens: 96, output_tokens: 7 },
};

const guardrail = semantics({
  state: Message,
  ask,
  model: MODEL,
  config: { apiKey: "offline", fetch: fixtureFetch(recorded) },
});

const signals = await guardrail.ask({
  sender: "Acme Payroll <rewards@claim-bonus.example>",
  subject: "Urgent: claim your employee bonus",
  body: "You have been selected for a $1,000 bonus. Confirm your payroll password today to receive it.",
});

const weights = {
  requestsCredentials: 0.45,
  senderIdentityMismatch: 0.3,
  offersUnexpectedReward: 0.25,
};

const risk =
  weights.requestsCredentials * signals.$probabilities.requestsCredentials +
  weights.senderIdentityMismatch * signals.$probabilities.senderIdentityMismatch +
  weights.offersUnexpectedReward * signals.$probabilities.offersUnexpectedReward;

const action = risk >= 0.6 ? "quarantine" : risk > 0.4 ? "human_review" : "deliver";

console.log({
  action,
  risk: Number(risk.toFixed(3)),
  requestsCredentials: signals.requestsCredentials,
  timePressure: signals.createsTimePressure,
  timePressureProbability: signals.$probabilities.createsTimePressure,
});
