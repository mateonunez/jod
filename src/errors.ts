import type { StandardIssue } from "./types.ts";

export type JodErrorCode = "invalid_state" | "invalid_response";

export class JodError extends Error {
  readonly code: JodErrorCode;

  constructor(code: JodErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class JodStateError extends JodError {
  readonly issues: readonly StandardIssue[];

  constructor(issues: readonly StandardIssue[]) {
    super("invalid_state", `State failed schema validation: ${formatIssues(issues)}`);
    this.issues = issues;
  }
}

export class JodResponseError extends JodError {
  readonly questionId: string | undefined;

  constructor(message: string, questionId?: string) {
    super("invalid_response", message);
    this.questionId = questionId;
  }
}

function formatIssues(issues: readonly StandardIssue[]): string {
  if (issues.length === 0) return "unknown issue";
  return issues
    .map((issue) => {
      const path = issue.path?.map(String).join(".") ?? "";
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
