import type { ActionResult } from "@/lib/action-result";

export type AuthActionState = ActionResult<{ message: string }>;

export const initialAuthActionState: AuthActionState = {
  success: true,
  data: { message: "" },
};
