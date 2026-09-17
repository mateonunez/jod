# Context

Domain language for this repo. Fill these sections as I work — do not pre-populate from a template.

## Language

**Semantic schema**:
The value `semantics()` returns: one state schema, one question set, and the client that answers it, bound together and reusable.
_Avoid_: "jod schema", "model", "spec".

**State**:
The text or structured value the questions are asked about. Validated locally before any request.
_Avoid_: "input", "prompt", "document" (unless it literally is a document).

**Question**:
One judgment for Jev: a Choice, a Score, or a Noul. Carries `instructions` and, for Choice and Score, `criteria`.
_Avoid_: "prompt", "task", "query".

**Primitive**:
One of the three question kinds. Same sense as TypeSafe's.

**Ask**:
The act of validating the state and sending every question in one request. Spelled `.ask()`.
_Avoid_: "call", "run", "evaluate".

**Reward**:
What `.ask()` resolves to: one projected value per question, plus `$`-prefixed sidecars.
_Avoid_: "answer" — that word belongs to Jev.

**Sidecar**:
A `$`-prefixed key on a Reward that carries metadata rather than a projected value.
_Avoid_: "meta", "envelope".

**Projection**:
Turning a raw Jev answer into the value your code branches on — an option id, a number, or a boolean at a threshold.
_Avoid_: "parsing", "coercion".

**Threshold**:
The probability at or above which a Noul projects to `true`. Application policy; never sent to Jev.
_Avoid_: "cutoff" when the 0..1 projection is meant.

**Fixture**:
A recorded response replayed through `fixtureFetch`, so a semantic schema runs with no network and no key.
_Avoid_: "mock", "stub" — it is a replay of a real shape.

## Relationships

- A **semantic schema** holds one **state** schema and many **questions**.
- `.ask()` validates the **state**, then returns one **reward** per call.
- A **reward** has one projected value per **question**, plus **sidecars**.
- A **fixture** replaces the socket, never the SDK client.

## Flagged ambiguities

- **"schema"** means two things. Use **state schema** for the Standard Schema on the input, and **ask spec** for the question set. **Semantic schema** is the whole `semantics()` value.
- **"answer"** means two things. Jev's raw object is an **answer** and lives in `$raw`. The value your code reads is a **projection**.
- **"validate"** means two things. `jod` validates the **state**, deterministically and locally. It never validates answers — it **projects** them. Jev **judges**.
- **"model"** means two things. The model id (`jev-latest`) versus a domain model. Write **model id** for the former.
- **"noul"** is both the primitive and its answer field. The primitive is a **Noul question**; the number is the **noul value**.
