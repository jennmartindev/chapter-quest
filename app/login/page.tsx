import LoginForm from "@/components/LoginForm";

// Render at request time so the Supabase client isn't constructed during the
// build (when env vars aren't present).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
