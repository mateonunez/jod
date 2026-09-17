import type {
  ChoiceResponse,
  EntryType,
  NoulResponse,
  Question,
  Questions,
  RequestOptions,
  ResultFor,
  ScoreResponse,
  SystemOneResult,
  TypeSafeClientConfig,
} from "@typesafe-ai/sdk";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { JodResponseError, JodStateError } from "./errors.ts";
import type { Reward, StandardResult, StandardSchema, StateInput } from "./types.ts";

const DEFAULT_NOUL_THRESHOLD = 0.5;

export interface SemanticsDefinition<Q extends Questions, S> {
  /** Every question here travels in one request. */
  readonly ask: Q;
  /** Any Standard Schema for the input state. Omit to send the input as-is. */
  readonly state?: S;
  /** Bring your own client to share retries, timeouts, logging, and headers. */
  readonly client?: TypeSafeClient;
  /** Or let Jod build one. Forwarded to `new TypeSafeClient(config)`. */
  readonly config?: TypeSafeClientConfig;
  readonly model?: string;
  /** Per-question id; the probability at which a Noul projects to `true`. Default `0.5`. */
  readonly thresholds?: Readonly<Record<string, number>>;
}

export interface Semantics<Q extends Questions, S> {
  readonly questions: Q;
  readonly state: S;
  readonly client: TypeSafeClient;
  /**
   * Validates the state locally and for free, then asks every question in one
   * parallel request. The request is the only step that costs money.
   */
  ask(input: StateInput<S>, options?: RequestOptions): Promise<Reward<Q>>;
}

export function semantics<Q extends Questions, S extends StandardSchema | undefined = undefined>(
  definition: SemanticsDefinition<Q, S>,
): Semantics<Q, S> {
  if (definition.client !== undefined && definition.config !== undefined) {
    throw new TypeError("Pass either `client` or `config`, never both.");
  }

  const thresholds = definition.thresholds ?? {};
  for (const [id, threshold] of Object.entries(thresholds)) {
    if (threshold < 0 || threshold > 1) {
      throw new RangeError(`Threshold for "${id}" must be between 0 and 1, received ${threshold}`);
    }
  }

  let client = definition.client;
  const resolveClient = (): TypeSafeClient => {
    client ??= new TypeSafeClient(definition.config ?? {});
    return client;
  };

  return {
    questions: definition.ask,
    state: definition.state as S,
    get client() {
      return resolveClient();
    },
    async ask(input, options) {
      const state = await resolveState(definition.state, input);
      const result = await resolveClient().systemOne(
        {
          state: state as EntryType,
          questions: definition.ask,
          ...(definition.model === undefined ? {} : { model: definition.model }),
        },
        options,
      );

      return project(definition.ask, result, thresholds);
    },
  };
}

async function resolveState<S>(schema: S | undefined, input: unknown): Promise<unknown> {
  if (schema === undefined) return input;

  const result = (await (schema as StandardSchema)["~standard"].validate(input)) as StandardResult;

  if ("value" in result) return result.value;
  throw new JodStateError(result.issues);
}

function project<Q extends Questions>(
  ask: Q,
  result: SystemOneResult<Q>,
  thresholds: Readonly<Record<string, number>>,
): Reward<Q> {
  const values: Record<string, unknown> = {};
  const confidence: Record<string, number> = {};
  const probabilities: Record<string, unknown> = {};
  const raw: Record<string, unknown> = {};

  const questions = ask as Record<string, Question | undefined>;
  const answers = result.answers as unknown as Record<string, ResultFor<Question> | undefined>;

  for (const id of Object.keys(questions)) {
    const question = questions[id];
    const answer = answers[id];
    if (question === undefined || answer === undefined) {
      throw new JodResponseError(`Response is missing an answer for question "${id}".`, id);
    }

    raw[id] = answer;

    switch (question.type) {
      case "choice": {
        const typed = asChoice(answer, id);
        values[id] = typed.choice;
        confidence[id] = typed.confidence;
        probabilities[id] = typed.probabilities;
        break;
      }
      case "score": {
        const typed = asScore(answer, id);
        values[id] = typed.score;
        confidence[id] = typed.confidence;
        probabilities[id] = typed.probabilities;
        break;
      }
      case "noul": {
        const typed = asNoul(answer, id);
        values[id] = typed.noul >= (thresholds[id] ?? DEFAULT_NOUL_THRESHOLD);
        probabilities[id] = typed.noul;
        break;
      }
    }
  }

  return {
    ...values,
    $confidence: confidence,
    $probabilities: probabilities,
    $raw: raw,
    $model: result.model,
    $usage: result.usage,
  } as Reward<Q>;
}

function asChoice(answer: ResultFor<Question>, id: string): ChoiceResponse {
  if (answer.type !== "choice") {
    throw new JodResponseError(`Expected a Choice answer for "${id}".`, id);
  }
  return answer;
}

function asScore(answer: ResultFor<Question>, id: string): ScoreResponse {
  if (answer.type !== "score") {
    throw new JodResponseError(`Expected a Score answer for "${id}".`, id);
  }
  return answer;
}

function asNoul(answer: ResultFor<Question>, id: string): NoulResponse {
  if (answer.type !== "noul") {
    throw new JodResponseError(`Expected a Noul answer for "${id}".`, id);
  }
  return answer;
}
