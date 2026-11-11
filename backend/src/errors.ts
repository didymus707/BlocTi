import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    res.status(400).json({
      error: first ? `${first.path.join(".") || "body"}: ${first.message}` : "invalid request",
      code: "invalid_request",
      details: error.issues,
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
    return;
  }
  // malformed JSON from express.json()
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "body is not valid JSON", code: "invalid_json" });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "request body too large", code: "too_large" });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "internal error", code: "internal" });
};
