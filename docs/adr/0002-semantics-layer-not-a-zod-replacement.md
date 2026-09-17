# ADR 0002 — A semantics layer, not a Zod replacement

**Status**: Accepted
**Date**: 2026-09-17

## Context

The original brief was "Zod capabilities, but using Jev". Taken literally, that means a schema library whose `parse` asks a model instead of checking a shape. That is a bad idea, for reasons that are structural rather than incidental:

- Zod's `parse` is pure, synchronous, free, and deterministic. Jev is async, networked, paid, rate-limited, and probabilistic. Hiding a network call behind `.parse()` breaks the contract users rely on and can silently bill them in loops and hot paths.
- Zod composes arbitrarily deep — recursion, `.and()`, `.or()`, `.refine()`, `.transform()`, `.catch()`. Jev has three question kinds and evaluates questions in a request independently, so arbitrary schemas have no faithful translation.
- Zod returns a boolean and path errors. Jev returns probabilities and confidence. "Valid" would have to mean "probability above a threshold", which is application policy, not schema semantics.
- Validating an HTTP body, an env var, or a config file with a model is strictly worse than the deterministic alternative: slower, dearer, and non-deterministic.

At the same time, there is a real gap. Jev answers are constrained to the options you supply, but the SDK hands them back nested (`answers.department.choice`), as bare probabilities, and disconnected from the shape of the input they judge.

## Decision

`jod` is a **semantics layer** that sits beside Zod, not a replacement for it.

- Zod (or any Standard Schema) stays the deterministic gatekeeper of the **state**. `jod` validates the input locally, for free, before spending a request.
- Question leaves project to **domain values**: a Choice to the option id, a Score to a number, a Noul to a boolean. A flat object plus `$confidence` / `$probabilities` / `$raw` sidecars, so answers land in the type system and compose with ordinary code.
- The model call is always **explicit**. `ask()` is async and named `ask()`; nothing that looks pure ever touches the network.
- `jod` does not validate structured data. That is Zod's job, and it does it better.

## Consequences

- `z.infer` interoperability comes from the state schema, not from a bespoke type system.
- Thresholds are schema-level configuration, deliberately outside the question, because they are policy and must never reach the wire.
- Users who only need one-off questions should use `TypeSafeClient` directly. `jod` earns its place only when a state and a question set are reused together.
- The package is small by design. Anything that is not validation, projection, or fixtures belongs to the SDK (see [ADR 0003](./0003-delegate-transport-and-primitives-to-the-official-sdk.md)).
