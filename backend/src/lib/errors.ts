import { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "APP_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function assertOrThrow(condition: unknown, statusCode: number, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new AppError(statusCode, message, code);
  }
}

export function registerErrorHandler(app: { setErrorHandler: Function }) {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (
      typeof error === "object"
      && error !== null
      && "statusCode" in error
      && typeof (error as { statusCode: unknown }).statusCode === "number"
      && "message" in error
      && typeof (error as { message: unknown }).message === "string"
    ) {
      const fastifyError = error as { statusCode: number; code?: string; message: string };
      if (fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
        return reply.status(fastifyError.statusCode).send({
          error: {
            code: fastifyError.code ?? "BAD_REQUEST",
            message: fastifyError.message,
            requestId: request.id,
          },
        });
      }
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.issues,
          requestId: request.id,
        },
      });
    }

    request.log.error(error);

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        requestId: request.id,
      },
    });
  });
}
