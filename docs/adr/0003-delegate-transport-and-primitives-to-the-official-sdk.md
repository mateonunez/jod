# ADR 0003 — Delegate transport and primitives to the official SDK

**Status**: Accepted
**Date**: 2026-09-17

## Context

The first cut of `jod` shipped its own `choice`, `score`, and `noul` constructors, its own question compiler, a hand-rolled `fetch` transport with a bearer token, its own error classes, and its own `JevTransport` seam.

Inspecting [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript) v0.6.0 showed that all of it already existed there, and better:

| Was rebuilt in `jod` | Already in the SDK |
| --- | --- |
| `choice` / `score` / `noul` | Same names, same `const T` generic signatures |
| `compileQuestion` / `compileQuestions` | `Question`, `Questions`, `SystemOneRequestPayload` — byte-identical payload |
| typed answers from criteria keys | `ResultFor<T>`, `SystemOneResult<Q>` |
| `createFetchTransport` | `TypeSafeClient`: retries, backoff and jitter, `Retry-After`, per-attempt timeout, logger, `defaultHeaders`, browser guard |
| `JodError` with four codes | `TypeSafeError` and a full taxonomy: `APIError`, `AuthenticationError`, `RateLimitError`, `APITimeoutError`, `APIConnectionError`, `APIUserAbortError`, … |
| `DEFAULT_BASE_URL`, `API_KEY_ENV_VAR` | `ENV`, `TYPESAFE_BASE_URL` |
| injected fake responses | `TypeSafeClientConfig.fetch` |

Two primitives with the same name and the same signature is a drift bug waiting to happen: the SDK ships a fix, `jod` users do not get it.

## Decision

The SDK is a **runtime dependency**, and every layer below the schema belongs to it.

- `jod` re-exports the SDK wholesale (`export * from "@typesafe-ai/sdk"`), so `choice`, `score`, `noul`, `TypeSafeClient`, `ENV`, and the error taxonomy all resolve to the SDK's implementation.
- `jod` owns no HTTP. `semantics()` takes a `config` forwarded to `new TypeSafeClient(config)`, or a `client` you built yourself.
- `jod` owns no error taxonomy. Transport errors propagate untouched.
- Fixtures go through `fixtureFetch`, which returns a `Fetch` handed to the SDK client. Tests therefore keep the SDK's parsing and error mapping, and give up only the socket.
- `jod`'s residual surface is exactly four things: **state validation**, the **`semantics()`** binding, **projection** into a Reward, and **fixture** replay.

## Consequences

- `jod` inherits the SDK's retries, timeouts, logging, and model listing for free, and cannot silently diverge from it.
- `jod` no longer defaults the model. The SDK's resolution chain (`model` → `defaultModel` → `TYPESAFE_DEFAULT_MODEL` → `jev-latest`) is left intact.
- The account exposes only aliases (`jev-latest`, `jev-preview`), so an immutable version pin is not expressible through the API today. The E2E suite asserts that whichever id is configured is still offered, which is the strongest guarantee available until a concrete id exists.
- `noul`'s threshold moved from the question to the schema (`thresholds`), because the SDK's `noul` has no such option and it never belonged on the wire anyway.
- Any future gap must be a genuinely missing capability, not a preference about naming.
