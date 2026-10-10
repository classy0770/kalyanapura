import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccount } from "@/modules/accounts/server/session";
import { CapabilityConfigurationError, CapabilityUnavailableError } from "@/server/config";
import { LogoutButton } from "@/modules/accounts/components/logout-button";
import styles from "@/modules/accounts/components/account.module.css";

export const runtime = "nodejs";
export const metadata = { title: "Your account" };
export default async function AccountPage() {
  const requestHeaders = await headers();
  if (!requestHeaders.get("cookie")?.includes("kalyanapura.session_token=")) redirect("/login");
  let account;
  try { account = await getAccount(requestHeaders); }
  catch (error) {
    if (!(error instanceof CapabilityConfigurationError || error instanceof CapabilityUnavailableError)) throw error;
    return <section className={styles.card}><h1>Account temporarily unavailable.</h1><p>We couldn’t check your session. Please try again once account services are available.</p></section>;
  }
  if (!account) redirect("/login");
  if (!account.emailVerified) redirect("/verify-email");
  return <section className={styles.card}><p className={styles.eyebrow}>Your account</p><h1>Welcome, {account.name}.</h1><p>You’re logged in with a verified email address.</p><div className={styles.details}><strong>{account.email}</strong><p>Wedding creation and joining will be available in the next feature. This account page does not grant access to a wedding.</p></div><LogoutButton /></section>;
}
