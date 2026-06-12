import { AuthForm } from "@/components/auth/auth-form";
import { AuthPanel } from "@/components/auth/auth-panel";
import { registerAction } from "@/lib/actions/auth";
import { initialAuthActionState } from "@/lib/actions/auth-state";

export const metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <AuthPanel
      eyebrow="Author access"
      title="Create account"
      description="Start with an author account. Additional roles can be assigned by an admin later."
    >
      <AuthForm
        action={registerAction}
        initialState={initialAuthActionState}
        submitLabel="Create account"
        fields={[
          {
            name: "name",
            label: "Full name",
            type: "text",
            autoComplete: "name",
          },
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
            autoComplete: "new-password",
          },
        ]}
        footerText="Already have an account?"
        footerHref="/login"
        footerLabel="Sign in"
      />
    </AuthPanel>
  );
}
