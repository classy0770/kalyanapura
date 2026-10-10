import { AuthForm } from "@/modules/accounts/components/auth-form";
export const metadata = { title: "New password" };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const query = await searchParams;
  return <AuthForm mode="reset" token={query.error ? undefined : query.token} />;
}
