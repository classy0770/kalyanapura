import { AuthForm } from "@/modules/accounts/components/auth-form";
export const metadata = { title: "Verify email" };
export default function VerifyEmailPage() { return <AuthForm mode="verify" />; }
