import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";
import { forgotPasswordAction } from "@/lib/actions/auth";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/actions/auth-state";

export const metadata = {
  title: "Forgot Password",
};

async function forgotPassword(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  "use server";

  return forgotPasswordAction(previousState, formData);
}

export default function ForgotPasswordPage() {
  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Reset password"
      description="Enter your account email and we will send a reset link if an account exists."
    >
      <AuthForm
        action={forgotPassword}
        initialState={initialAuthActionState}
        submitLabel="Send reset link"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
        ]}
        footerText="Remembered your password?"
        footerHref="/login"
        footerLabel="Sign in"
      />
    </AuthPanel>
  );
}
