import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { initialAuthActionState } from "@/lib/actions/auth-state";

export const metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Reset password"
      description="Enter your account email and we will send a reset link if an account exists."
    >
      <AuthForm
        action={forgotPasswordAction}
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
