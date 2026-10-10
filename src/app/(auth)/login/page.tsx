import type { Metadata } from "next";
import { AuthForm } from "@/modules/accounts/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; error?: string }> }) {
  const query = await searchParams;
  return <AuthForm mode="login" notice={query.error ? "That verification link is invalid or expired. Request a new verification email." : query.verified === "1" ? "Email verified. You can now log in." : undefined} />;
}
