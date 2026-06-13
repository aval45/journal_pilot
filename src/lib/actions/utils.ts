import "server-only";

import { AccessDeniedError } from "@/lib/access-errors";
import type { ActionResult } from "@/lib/action-result";
import { AuthenticationError, DeactivatedAccountError } from "@/lib/auth";
import { RateLimitError, rateLimitActionError } from "@/lib/rate-limit";

export async function withActionErrorHandling<T>(
  action: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof DeactivatedAccountError ||
      error instanceof AccessDeniedError
    ) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (error instanceof RateLimitError) {
      return rateLimitActionError();
    }

    console.error("Unhandled action error:", error);
    
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
