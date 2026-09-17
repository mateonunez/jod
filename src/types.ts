import type {
  ChoiceQuestion,
  NoulQuestion,
  Question,
  Questions,
  ResultFor,
  ScoreQuestion,
  Usage,
} from "@typesafe-ai/sdk";

export type ValueOf<Q extends Question> =
  Q extends ChoiceQuestion<infer C>
    ? keyof C & string
    : Q extends ScoreQuestion
      ? number
      : Q extends NoulQuestion
        ? boolean
        : never;

export type Answers<Q extends Questions> = { [K in keyof Q]: ValueOf<Q[K]> };

type ConfidentKey<Q extends Questions> = {
  [K in keyof Q]: Q[K] extends NoulQuestion ? never : K;
}[keyof Q];

/** Noul has no confidence because it already *is* a probability. */
export type Confidences<Q extends Questions> = { [K in ConfidentKey<Q>]: number };

export type ProbabilityOf<Q extends Question> =
  Q extends ChoiceQuestion<infer C>
    ? { [label in keyof C]: number }
    : Q extends ScoreQuestion<infer L>
      ? ResultFor<ScoreQuestion<L>>["probabilities"]
      : Q extends NoulQuestion
        ? number
        : never;

export type Probabilities<Q extends Questions> = { [K in keyof Q]: ProbabilityOf<Q[K]> };

export type RawAnswers<Q extends Questions> = { [K in keyof Q]: ResultFor<Q[K]> };

/** `$`-prefixed so the sidecars can never collide with a question id. */
export type Reward<Q extends Questions> = Answers<Q> & {
  readonly $confidence: Confidences<Q>;
  readonly $probabilities: Probabilities<Q>;
  readonly $raw: RawAnswers<Q>;
  readonly $model: string;
  readonly $usage: Usage;
};

export interface StandardIssue {
  readonly message: string;
  readonly path?: readonly unknown[];
}

export type StandardResult<Output = unknown> =
  | { readonly value: Output }
  | { readonly issues: readonly StandardIssue[] };

/**
 * Structural, not nominal, so any Standard Schema implementation satisfies it.
 * `validate` returns `unknown` on purpose: implementations disagree on the
 * result's shape, and Jod narrows it at runtime rather than fighting variance.
 */
export interface StandardSchema<Output = unknown> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => unknown;
    readonly types?: { readonly input: unknown; readonly output: Output } | undefined;
  };
}

export type InferState<S> = S extends {
  readonly "~standard": { readonly types?: { readonly output: infer O } | undefined };
}
  ? O
  : unknown;

export type StateInput<S> = S extends StandardSchema ? InferState<S> : unknown;
