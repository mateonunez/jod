import type { Fetch, Questions, SystemOneResult } from "@typesafe-ai/sdk";

export type FixtureRequest = Record<string, unknown>;

export type FixtureSource =
  | SystemOneResult<Questions>
  | ((request: FixtureRequest) => SystemOneResult<Questions> | Promise<SystemOneResult<Questions>>);

/**
 * A `fetch` that answers from a recorded result instead of the network. Pass it
 * to `TypeSafeClient`, so tests keep the SDK's parsing and error handling while
 * giving up only the socket.
 */
export function fixtureFetch(source: FixtureSource): Fetch {
  return async (_input, init) => {
    const request = typeof init?.body === "string" ? (JSON.parse(init.body) as FixtureRequest) : {};
    const body = typeof source === "function" ? await source(request) : source;

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
