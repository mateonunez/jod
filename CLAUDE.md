# jod

Semantic schemas over TypeSafe's Jev. Read [`CONTEXT.md`](./CONTEXT.md) before you touch anything — it holds the domain language, and the words in it are not interchangeable.

## Mateo skills

This repo is wired for these skills. Run `setup-mateonunez-skills` only if the conventions below go missing.

- [`result-not-throw`](https://github.com/mateonunez/skills) — `Result<T, E>` in business logic; throws only at boundaries. `jod` throws at two boundaries only: schema wiring in `semantics()`, and the SDK's typed errors out of `.ask()`. See [`docs/adr/0001`](./docs/adr/0001-conventions.md).
- [`vertical-slices`](https://github.com/mateonunez/skills) — organise by feature, not by layer. `jod` is a single package, so its slices are files: `semantics.ts` (binding + projection), `types.ts` (Reward mapping), `errors.ts`, `fixtures.ts`.
- [`node-native-tests`](https://github.com/mateonunez/skills) — `node:test` + `borp` + `c8`. Never Jest, never Vitest.
- [`single-tool-per-job`](https://github.com/mateonunez/skills) — Biome is the only lint and format tool.
- [`conventional-commits-scoped`](https://github.com/mateonunez/skills) — scoped Conventional Commits.

## Commands

```sh
pnpm check          # typecheck + lint + test + build — run this before you say done
pnpm typecheck
pnpm test           # hermetic
pnpm test:e2e       # live, needs TYPESAFE_API_KEY
pnpm lint:fix
pnpm example:triage
```

## Releasing

Release Please owns versions and `CHANGELOG.md`. Never bump `package.json` by hand, and never tag or publish manually.

- Merge to `main`; Release Please opens a `chore(release): X.Y.Z` PR.
- Merge that PR; the tag, the GitHub Release, and the npm publish follow.
- Commit types drive versions: `fix:` patch, `feat:` minor, `feat!:` minor while pre-major.
- Types hidden in [`release-please-config.json`](./release-please-config.json) stay out of the changelog.
- Scopes must come from the repo's existing catalogue — the `conventional-commits-scoped` skill.

## What matters here

- **The SDK is a dependency, not a reference.** Primitives, the client, and the error taxonomy come from `@typesafe-ai/sdk` and are re-exported. Do not reimplement anything that exists there — see [`docs/adr/0003`](./docs/adr/0003-delegate-transport-and-primitives-to-the-official-sdk.md).
- **`jod` is a semantics layer, not a Zod replacement.** See [`docs/adr/0002`](./docs/adr/0002-semantics-layer-not-a-zod-replacement.md).
- **Never put a network call behind something that looks pure.** Only `.ask()` spends money.
- **Thresholds never reach the wire.** They are application policy and live on the schema.
- **`jod` sets no model.** The SDK owns the resolution chain. The only ids the account offers are aliases, so never hardcode one in `src/` — see the README's model section.
