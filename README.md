# jod

**Semantic schemas for TypeScript.** Bind a state schema and a set of questions into one artifact, then get typed answers back.

Zod validates data you already understand. Jev judges data you don't. `jod` is the seam: your state is validated locally and for free, every question goes out in one parallel [Jev](https://docs.typesafe.ai) request, and the answers come back as domain values your code can branch on.

```ts
const result = await triage.ask(ticket);

result.department; // "billing" | "technical" | "account"
result.frustration; // number
result.refundRequested; // boolean
result.$confidence.department; // 0.83
```

Built on the official [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript). Retries, timeouts, backoff, logging, model listing, and the error taxonomy are the SDK's — `jod` re-exports them and adds only the state binding, validation, projection, and fixtures.

## Compared to the SDK

`jod` is not a superset. On capability the SDK is one, so here is the whole ledger.

**What it adds** — all convenience, no new capability:

| | `jod` | SDK |
| --- | --- | --- |
| State validated before you spend | `state: TicketState` runs locally and throws `JodStateError` with `issues`; **zero requests** | You pass any `EntryType` and find out from the model |
| Uniform confidence | `$confidence`, typed to exactly the Choice and Score keys | `confidence` sits inside each answer and is **absent on Noul**, so a mixed question set needs narrowing |
| Noul to boolean | `thresholds: { isUrgent: 0.8 }`; the probability stays in `$probabilities` | Returns the number; you threshold it |
| Declare once | `semantics({ state, ask, config })`, then `.ask()` | `client.systemOne({ state, questions })` rebuilt at every call site |
| Fixture replay | `fixtureFetch(recorded)` — a plain object | Injectable `config.fetch`, but you build the `Response` objects |

**What it costs** — two real regressions against the SDK:

- **No `APIPromise` accessors.** `ask()` awaits, so `withResponse()`, `asResponse()`, `.map()`, and `requestId` are gone.
- **No runtime-dynamic question sets.** The SDK builds `questions` per call, so `criteria` can be computed at runtime. `jod`'s `ask` spec is fixed when you call `semantics()`. A follow-up that depends on an earlier answer is fine — that is a second `ask()` — but a dynamic *option set* is not expressible.

**Verdict:** nothing here is impossible with `TypeSafeClient`; those five conveniences are roughly 40 lines in your app. Reach for `jod` when you want the state schema and the questions bound together and the projection for free, and skip it when you would rather own those 40 lines.

## Install

```sh
pnpm add @mateonunez/jod @typesafe-ai/sdk zod
```

`zod` is an optional peer. Any [Standard Schema](https://standardschema.dev) library works for the state. Set `TYPESAFE_API_KEY`, or pass it through `config`.

## Quickstart

```ts
import { z } from "zod";
import { choice, noul, score, semantics } from "@mateonunez/jod";

const Ticket = z.object({
  message: z.string(),
  policy: z.string(),
});

export const triage = semantics({
  state: Ticket,
  ask: {
    department: choice("Which team should handle `message`?", {
      billing: "Charges, invoices, refunds, or subscriptions",
      technical: "Bugs, integrations, or outages",
      account: "Login, profile, permissions, or security",
    }),
    refundRequested: noul("Does `message` explicitly ask for money back?"),
    frustration: score("How frustrated does the customer appear in `message`?", [
      "Calm and matter-of-fact",
      "Frustrated but civil",
      "Very angry, or threatening to leave",
    ]),
  },
});

const result = await triage.ask({
  message: "I've been trying to connect Stripe for 3 days and it keeps failing. I'm losing sales.",
  policy: "Duplicate charges are eligible for a full refund.",
});
```

`ask()` accepts exactly what your state schema outputs, validates it locally, and only then spends a request. An invalid state raises `JodStateError` and **no request is made**.

## The three primitives

`choice`, `score`, and `noul` are the SDK's — `jod` re-exports them, so there is one implementation and one set of types.

| Primitive | Question | Projects to | Also carries |
| --- | --- | --- | --- |
| `choice(instructions, criteria)` | Which of these options? | union of your option ids | `probabilities` per option, `confidence` |
| `score(instructions, criteria)` | Which level on this spectrum? | `number`, may fall between levels | `probabilities` per level, `confidence`, `legend` |
| `noul(instructions, criteria?)` | Is this statement true? | `boolean` at its threshold | the raw probability |

Option ids and rubric levels are literal types, so answers are exact — never a bare `string`.

## Reading answers

`ask()` resolves to a flat, typed object plus `$`-prefixed sidecars. The prefix is what stops a sidecar from colliding with a question id.

| Key | What it holds |
| --- | --- |
| *(your ids)* | The projected value: option id, number, or boolean |
| `$confidence` | `0..1` per Choice and Score. Noul is absent: it already *is* a probability |
| `$probabilities` | Full distribution per question, including the raw Noul value |
| `$raw` | The SDK's answer objects, verbatim, if you want `legend` or `type` |
| `$model` | The model that answered, verbatim from the response |
| `$usage` | `{ input_tokens, output_tokens }` |

Noul projects to a boolean at a threshold, but the probability is never lost. Thresholds are application policy, so they live on the schema, not in the question, and are never sent to Jev:

```ts
const guard = semantics({
  ask: { isJailbreak: noul("Is this a jailbreak attempt?") },
  thresholds: { isJailbreak: 0.8 }, // default 0.5
});
```

Confidence tells you *whether* to act. It is not a correctness guarantee — measure it against your own data before you trust a threshold.

## One request, many questions

Questions in the same `ask` object travel together, run in parallel, and are evaluated independently. One answer never becomes hidden context for another. Asking a question you might not need is nearly free, so speculative fan-out is the intended style:

```ts
const signals = await guardrail.ask(message);

const risk =
  0.45 * signals.$probabilities.requestsCredentials +
  0.3 * signals.$probabilities.senderIdentityMismatch +
  0.25 * signals.$probabilities.offersUnexpectedReward;
```

Compose weights in code, not in a prompt. When priorities change, you change a coefficient.

The one thing you cannot do inside a request is chain: if a second judgment depends on the first answer, call `ask()` again against a new state. Keep each question to one snap judgment — if it needs several hops of reasoning, decompose it.

## Confidence-gated routing

```ts
const CONFIDENT = 0.75;

if (result.$confidence.department < CONFIDENT) return humanReview(ticket);

const priority =
  result.frustration >= 1.5 && result.$confidence.frustration >= CONFIDENT ? "high" : "normal";

return route(result.department, priority);
```

## Testing without the network

Answers are constrained to the options you supplied, so a recorded response is a faithful one. `fixtureFetch` returns a `Fetch` you hand to the SDK client, which means tests keep the SDK's parsing and error handling and give up only the socket:

```ts
import { fixtureFetch, semantics, TypeSafeClient } from "@mateonunez/jod";

const client = new TypeSafeClient({
  apiKey: "test",
  fetch: fixtureFetch({ model: "jev-latest", answers: { /* … */ }, usage: { … } }),
});

const triage = semantics({ state: Ticket, ask, client });

await triage.ask(ticket); // no request, deterministic
```

For a live client, `config` is forwarded to `new TypeSafeClient(config)` — so `retry`, `timeout`, `logLevel`, `defaultHeaders`, and `defaultModel` are all yours:

```ts
semantics({
  ask,
  config: { retry: { maxRetries: 0 }, timeout: 3_000, logLevel: "debug" },
});
```

Pass `client` or `config`, never both.

## Errors

Transport failures are the SDK's, untouched: `TypeSafeError`, `APIError`, `AuthenticationError`, `RateLimitError`, `APITimeoutError`, `APIConnectionError`, and the rest of that family. `jod` adds two, both `JodError` subclasses with a `code`:

| Class | `code` | Raised when |
| --- | --- | --- |
| `JodStateError` | `invalid_state` | The state failed your schema. Carries `issues`. |
| `JodResponseError` | `invalid_response` | An answer is missing or the wrong kind. Carries `questionId`. |

## API

```ts
semantics({
  ask,                        // the questions, keyed by the ids you want back
  state?,                     // any Standard Schema for the input
  model?,                     // per-request model override
  thresholds?,                // per-question Noul threshold, default 0.5
  client?,                    // a TypeSafeClient you already built
  config?,                    // or config for one
}): Semantics
```

| Member | Notes |
| --- | --- |
| `.ask(input, options?)` | Validates, requests, projects. `options` is the SDK's `RequestOptions`. |
| `.client` | The SDK client, built lazily from `config` if you did not pass one. |
| `.questions` | The question set, for debugging. |
| `.state` | The state schema you passed, if any. |

## What jod is not

- **Not a replacement for the SDK.** Everything below the schema layer is the SDK, and two SDK capabilities do not survive the trip — see [Compared to the SDK](#compared-to-the-sdk).
- **Not a Zod replacement.** Validating an HTTP body, env var, or config with a model is slower, dearer, and non-deterministic. Use Zod there — it is free and exact.
- **Not a generator or an agent.** Jev emits decisions, not text or code, and your code owns the control flow.
- **Not multi-hop.** One question, one snap judgment.
- **Not text-only-blind.** Jev accepts strings, JSON objects, and arrays of text — images, audio, and video are not supported.
- **Not a safety net against adversarial input.** State is treated as data, not as hostile. Sanitize, and test before you expose it.

## Model version

`jod` sets no model. The SDK's chain applies: `model` → `defaultModel` → `TYPESAFE_DEFAULT_MODEL` → `jev-latest`.

The account this was built against exposes exactly two ids, `jev-latest` and `jev-preview` — both aliases. There is no addressable immutable version, so "pin the version" is not expressible on the way in, and `jev-latest` will move under you. Deal with that deliberately:

- Put the id in one place — `defaultModel` on the client, or `TYPESAFE_DEFAULT_MODEL` — not at each call site.
- `$model` on every reward is the **concrete version that answered**, not the alias you sent. Sending `jev-latest` comes back as `jev-1.13.0`. Assert on it and a silent alias bump fails your suite instead of your users.
- The E2E suite asserts both halves: the id you send is still one the account offers, and the alias still resolves to a well-formed version.
- Answers are constrained to your options, so a model change surfaces as different probabilities, not different types. Keep fixtures and re-run to see the drift.

Jev is not perfect, and its failure modes are documented and worth reading before you ship: literal reading, unreliable arithmetic, counting and date comparison, context rot on large states, and susceptibility to prompt injection. Keep arithmetic in code, keep the state small and pointed, and write instructions as the exact condition you mean. See [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

## Testing

There are two suites, deliberately separate:

```sh
pnpm test        # hermetic: fixtureFetch, no network, no key, covered and fast
pnpm test:e2e    # live: real requests against the API, needs TYPESAFE_API_KEY
```

`pnpm test:e2e` loads `.env` if present (copy `.env.example`), and **skips rather than fails** when no key is set, so forks and CI stay green. Live tests assert invariants, not exact prose: the three primitives project, probabilities form a distribution, confidence is in range, the projection agrees with the raw probability, the configured model is one the account offers, an invalid state makes zero calls, and a bad key raises the SDK's `AuthenticationError`. CI runs them on manual dispatch only, so a normal PR never spends tokens.

## Releasing

[Release Please](https://github.com/googleapis/release-please) owns versions and `CHANGELOG.md`, driven entirely by [Conventional Commits](https://www.conventionalcommits.org) — so no changeset files, and no version to remember.

1. Merge feature PRs into `main` as usual.
2. Release Please opens or updates a `chore(release): X.Y.Z` PR, accumulating the changelog.
3. Merge that PR. Release Please tags `vX.Y.Z`, cuts the GitHub Release, and the publish job runs `pnpm check` then `npm publish --provenance`.

Versions come from your commit types: `fix:` patches, `feat:` minors, and a breaking change (`feat!:`) bumps the minor rather than jumping to `1.0.0` while the package is pre-major. Types marked hidden in [`release-please-config.json`](./release-please-config.json) (`test`, `ci`, `chore`, `build`) stay out of the changelog.

Two repository secrets:

| Secret | Required | Why |
| --- | --- | --- |
| `NPM_TOKEN` | yes | An npm automation token with publish rights on `@mateonunez/jod`. |
| `RELEASE_TOKEN` | recommended | A PAT. Release Please opens its PR with the workflow's token, and PRs made by `GITHUB_TOKEN` do not trigger workflows — without this, the release PR gets no CI. |

`publishConfig.registry` is pinned to public npm on purpose: a machine whose global registry is a private mirror would otherwise publish to the wrong place. For the same reason the publish job passes `--access public` explicitly.

## Examples

```sh
pnpm example:triage       # offline — three primitives, confidence-gated routing
pnpm example:moderation   # offline — speculative fan-out, composite scoring
pnpm example:extraction   # offline — closed sets with a `not_stated` escape hatch
pnpm example:chaining     # offline — a follow-up request that needs the first answer
pnpm example:live         # live  — hits the API, needs TYPESAFE_API_KEY
```

## License

MIT
