import assert from "node:assert/strict";
import { test } from "node:test";
import { choice, noul, score, semantics } from "../src/index.ts";
import { recorded, recording, testClient } from "./fixtures.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const { fetch } = recording(recorded);

const schema = semantics({
  client: testClient(fetch),
  ask: {
    department: choice("q", { billing: "a", technical: "b", sales: "c" }),
    frustration: score("q", ["a", "b", "c"]),
    isUrgent: noul("q"),
  },
});

type Reward = Awaited<ReturnType<typeof schema.ask>>;

export type DepartmentIsLiteralUnion = Expect<
  Equal<Reward["department"], "billing" | "technical" | "sales">
>;
export type FrustrationIsNumber = Expect<Equal<Reward["frustration"], number>>;
export type UrgencyIsBoolean = Expect<Equal<Reward["isUrgent"], boolean>>;
export type ConfidenceExcludesNoul = Expect<
  Equal<keyof Reward["$confidence"], "department" | "frustration">
>;
export type ChoiceProbabilityKeys = Expect<
  Equal<keyof Reward["$probabilities"]["department"], "billing" | "technical" | "sales">
>;
export type NoulProbabilityIsNumber = Expect<Equal<Reward["$probabilities"]["isUrgent"], number>>;
export type ModelIsString = Expect<Equal<Reward["$model"], string>>;

test("the inferred reward matches the runtime shape", async () => {
  const reward = await schema.ask("hello");

  assert.equal(typeof reward.department, "string");
  assert.equal(typeof reward.frustration, "number");
  assert.equal(typeof reward.isUrgent, "boolean");
  assert.equal(typeof reward.$confidence.department, "number");
  assert.equal(typeof reward.$probabilities.isUrgent, "number");
});
