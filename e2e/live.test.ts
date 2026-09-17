import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  AuthenticationError,
  choice,
  JodStateError,
  noul,
  score,
  semantics,
  TypeSafeClient,
} from "../src/index.ts";
import { countingFetch, liveClient, liveTest, MODEL, RESOLVED_MODEL } from "./support.ts";

test("the account can list models", liveTest(), async () => {
  const models = await liveClient().models.list();

  assert.ok(models.length > 0, "expected at least one model");
  for (const card of models) {
    assert.equal(typeof card.name, "string");
    assert.equal(typeof card.description, "string");
  }
});

test("the model we send is one the account offers", liveTest(), async () => {
  const models = await liveClient().models.list();
  const names = models.map((card) => card.name);

  assert.ok(names.includes(MODEL), `account offers ${names.join(", ")}, not ${MODEL}`);
});

test("answers a real state with all three primitives, projected", liveTest(), async () => {
  const Ticket = z.object({ message: z.string() });

  const triage = semantics({
    state: Ticket,
    client: liveClient(),
    ask: {
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
    },
  });

  const result = await triage.ask({
    message: "I was charged twice for order A-104. Please refund the duplicate charge.",
  });

  assert.equal(result.department, "billing");
  assert.equal(result.refundRequested, true);
  assert.ok(result.frustration >= 0 && result.frustration <= 2);

  assert.match(result.$model, RESOLVED_MODEL);
  assert.ok(result.$usage.input_tokens > 0);
  assert.ok(result.$usage.output_tokens > 0);

  const distribution = Object.values(result.$probabilities.department);
  for (const probability of distribution) {
    assert.ok(probability >= 0 && probability <= 1, `probability out of range: ${probability}`);
  }
  const total = distribution.reduce((sum, probability) => sum + probability, 0);
  assert.ok(Math.abs(total - 1) < 0.05, `choice probabilities sum to ${total}`);

  for (const value of Object.values(result.$confidence)) {
    assert.ok(value >= 0 && value <= 1, `confidence out of range: ${value}`);
  }

  assert.equal(result.$raw.department.choice, result.department);
  assert.equal(result.$raw.frustration.score, result.frustration);
  assert.equal(result.refundRequested, result.$probabilities.refundRequested >= 0.5);
});

test(
  "a model override is accepted, and the answer reports the resolved version",
  liveTest(),
  async () => {
    const mentionsRefund = semantics({
      client: liveClient(),
      model: MODEL,
      ask: { mentionsRefund: noul("Does `text` mention a refund?") },
    });

    const result = await mentionsRefund.ask({ text: "I would like a refund for order A-104." });

    // Only aliases are addressable on the way in; the concrete version comes back.
    assert.match(result.$model, RESOLVED_MODEL);
    assert.equal(result.mentionsRefund, true);
    assert.equal(result.$raw.mentionsRefund.type, "noul");
    assert.ok(result.$probabilities.mentionsRefund > 0.5);
  },
);

test("an invalid state never reaches the network", liveTest(), async () => {
  const { stats, fetch } = countingFetch();

  const schema = semantics({
    state: z.object({ message: z.string() }),
    client: liveClient({ fetch }),
    ask: { mentionsRefund: noul("Does `message` mention a refund?") },
  });

  await assert.rejects(
    schema.ask({ message: 42 } as unknown as { message: string }),
    JodStateError,
  );
  assert.equal(stats.calls, 0);
});

test("a bad key surfaces as the SDK's AuthenticationError", liveTest(), async () => {
  const schema = semantics({
    client: new TypeSafeClient({
      apiKey: "definitely-not-a-real-key",
      retry: { maxRetries: 0 },
      timeout: 15_000,
    }),
    ask: { mentionsRefund: noul("Does `text` mention a refund?") },
  });

  await assert.rejects(schema.ask({ text: "refund please" }), (error: unknown) => {
    assert.ok(
      error instanceof AuthenticationError,
      `expected AuthenticationError, got ${String(error)}`,
    );
    return true;
  });
});
