# ADR 0001 — Conventions

**Status**: Accepted
**Date**: 2026-09-17

## Context

This repo follows the conventions encoded in [`mateonunez-skills`](https://github.com/mateonunez/skills). Recording the decision here so the next contributor (human or agent) knows the choice was deliberate.

## Decision

- **Package manager**: pnpm via corepack. `packageManager` field pinned in `package.json`.
- **Lint + format**: Biome only. No ESLint, no Prettier.
- **Tests**: `node:test` + `borp` runner + `c8` coverage. No Jest, no Vitest.
- **Error handling in business logic**: `Result<T, E>` (see `result-not-throw` skill). Throws reserved for boundary code.
- **Module organisation**: vertical slices (package by feature) in monorepos. Workspace protocol (`workspace:*`) for internal deps.
- **Commits**: Conventional Commits with scopes.

## Consequences

- New tooling must clear the `single-tool-per-job` bar before being added.
- Migrations away from any of these defaults require a follow-up ADR.

## Deviations

- **Throws at the schema and client boundary.** `semantics()` throws `TypeError` / `RangeError` on a wiring mistake, and `.ask()` lets the SDK's typed errors through. Both are boundary code, not business logic. `jod` has no `Result` API because its callers are already inside a network boundary.
- **Source imports use `.ts` specifiers**, rewritten to `.js` on emit by `rewriteRelativeImportExtensions`. This is what lets `node` and `borp` run the sources unbuilt.
