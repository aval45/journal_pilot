import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";
import { loginAction } from "@/lib/actions/auth";
import { initialAuthActionState } from "@/lib/actions/auth-state";

export const metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <AuthPanel
      eyebrow="JournalPilot"
      title="Sign in"
      description="Access your manuscript, review, editorial, or admin workspace."
    >
      <AuthForm
        action={loginAction}
        initialState={initialAuthActionState}
        submitLabel="Sign in"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        footerText="New to JournalPilot?"
        footerHref="/register"
        footerLabel="Create an account"
        secondaryHref="/forgot-password"
        secondaryLabel="Forgot password?"
      />
    </AuthPanel>
  );
}
