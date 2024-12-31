import { ErrorResponse } from "../types";

export class AppError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = "AppError";
  }
}

export const handleError = (error: unknown): ErrorResponse => {
  console.error("Error occurred:", error);

  if (error instanceof AppError) {
    return {
      error: error.message,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
    };
  }

  return {
    error: "An unexpected error occurred",
  };
};
