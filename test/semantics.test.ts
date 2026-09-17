import assert from "node:assert/strict";
import { test } from "node:test";
import { APIError, TypeSafeError } from "@typesafe-ai/sdk";
import { choice, JodResponseError, JodStateError, noul, semantics } from "../src/index.ts";
import { ask, MODEL, recorded, recording, TicketState, testClient, ticket } from "./fixtures.ts";

test("projects each answer to its typed value, plus sidecars", async () => {
  const { fetch } = recording(recorded);
  const triage = semantics({ state: TicketState, client: testClient(fetch), ask });

  const reward = await triage.ask(ticket);

  assert.equal(reward.department, "technical");
  assert.equal(reward.frustration, 1.035);
  assert.equal(reward.isUrgent, true);

  assert.deepEqual(reward.$confidence, { department: 0.596, frustration: 0.842 });
  assert.deepEqual(reward.$probabilities.department, {
    billing: 0.159,
    technical: 0.84,
    sales: 0.001,
  });
  assert.equal(reward.$probabilities.isUrgent, 0.999);
  assert.equal(reward.$raw.isUrgent.noul, 0.999);
  assert.equal(reward.$model, MODEL);
  assert.deepEqual(reward.$usage, { input_tokens: 312, output_tokens: 48 });
});

test("every question travels in one request, with the model on it", async () => {
  const { requests, fetch } = recording(recorded);
  const triage = semantics({ state: TicketState, client: testClient(fetch), ask, model: MODEL });

  await triage.ask(ticket);

  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.deepEqual(request?.state, ticket);
  assert.equal(request?.model, MODEL);
  assert.deepEqual(Object.keys(request?.questions as object), [
    "department",
    "frustration",
    "isUrgent",
  ]);
});

test("noul projects to false below the default threshold", async () => {
  const { fetch } = recording({
    model: MODEL,
    answers: { isUrgent: { type: "noul", noul: 0.2 } },
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  const triage = semantics({
    client: testClient(fetch),
    ask: { isUrgent: noul("Is it urgent?") },
  });

  const reward = await triage.ask("hello");

  assert.equal(reward.isUrgent, false);
  assert.equal(reward.$probabilities.isUrgent, 0.2);
});

test("a per-question threshold overrides the default", async () => {
  const { fetch } = recording({
    model: MODEL,
    answers: { isUrgent: { type: "noul", noul: 0.7 } },
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  const triage = semantics({
    client: testClient(fetch),
    ask: { isUrgent: noul("Is it urgent?") },
    thresholds: { isUrgent: 0.9 },
  });

  assert.equal((await triage.ask("hello")).isUrgent, false);
});

test("state is validated locally, so an invalid one costs no request", async () => {
  const { requests, fetch } = recording(recorded);
  const triage = semantics({ state: TicketState, client: testClient(fetch), ask });

  await assert.rejects(
    triage.ask({ message: 42, policy: "x" } as unknown as typeof ticket),
    (error: unknown) => {
      assert.ok(error instanceof JodStateError);
      assert.equal(error.code, "invalid_state");
      assert.ok(error.issues.length > 0);
      return true;
    },
  );
  assert.equal(requests.length, 0);
});

test("a missing answer is a typed response error naming the question", async () => {
  const { fetch } = recording({
    model: MODEL,
    answers: {},
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  const triage = semantics({ client: testClient(fetch), ask: { isUrgent: noul("q") } });

  await assert.rejects(triage.ask("hello"), (error: unknown) => {
    assert.ok(error instanceof JodResponseError);
    assert.equal(error.questionId, "isUrgent");
    return true;
  });
});

test("an answer of the wrong type is a typed response error", async () => {
  const { fetch } = recording({
    model: MODEL,
    answers: { trust: { type: "noul", noul: 1 } },
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  const triage = semantics({ client: testClient(fetch), ask: { trust: choice("q", { a: null }) } });

  await assert.rejects(triage.ask("hello"), (error: unknown) => {
    assert.ok(error instanceof JodResponseError);
    assert.match(error.message, /Expected a Choice answer/);
    return true;
  });
});

test("client and config are mutually exclusive", () => {
  assert.throws(
    () =>
      semantics({
        ask: { isUrgent: noul("q") },
        client: testClient(async () => new Response()),
        config: { apiKey: "test" },
      }),
    TypeError,
  );
});

test("thresholds outside 0..1 are rejected at wiring time", () => {
  assert.throws(
    () => semantics({ ask: { isUrgent: noul("q") }, config: {}, thresholds: { isUrgent: 1.4 } }),
    RangeError,
  );
});

test("the SDK's own errors come through untouched", async () => {
  const fetch = async (): Promise<Response> => new Response("boom", { status: 500 });
  const triage = semantics({
    ask: { isUrgent: noul("q") },
    client: testClient(fetch, { retry: { maxRetries: 0 } }),
  });

  await assert.rejects(triage.ask("hello"), (error: unknown) => {
    assert.ok(error instanceof APIError);
    assert.ok(error instanceof TypeSafeError);
    assert.equal(error.status, 500);
    return true;
  });
});

test(".client hands back the instance you injected", () => {
  const injected = testClient(async () => new Response());
  const triage = semantics({ client: injected, ask: { isUrgent: noul("q") } });

  assert.equal(triage.client, injected);
  assert.equal(triage.questions.isUrgent.type, "noul");
});
