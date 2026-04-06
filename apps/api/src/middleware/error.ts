import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as 400);
  }

  console.error("Unhandled error:", err);
  return c.json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
      },
    },
    500
  );
};
