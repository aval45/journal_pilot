import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";
import { loginAction } from "@/lib/actions/auth";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/actions/auth-state";

export const metadata = {
  title: "Login",
};

async function login(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  "use server";

  return loginAction(previousState, formData);
}

export default function LoginPage() {
  return (
    <AuthPanel
      eyebrow="JournalPilot"
      title="Sign in"
      description="Access your manuscript, review, editorial, or admin workspace."
    >
      <AuthForm
        action={login}
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
