import "server-only";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

export async function getAccount(headers: Headers) {
  const session = await (await getAuth()).api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified };
}

export async function requireVerifiedAccount(headers: Headers) {
  if (!headers.get("cookie")?.includes("kalyanapura.session_token=")) redirect("/login");
  const account = await getAccount(headers);
  if (!account) redirect("/login");
  if (!account.emailVerified) redirect("/verify-email");
  return account;
}
