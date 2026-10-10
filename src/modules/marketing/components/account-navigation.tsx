"use client";

import Link from "next/link";
import { authClient } from "@/modules/accounts/client";
import styles from "./homepage.module.css";

export function AccountNavigation() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className={styles.profilePlaceholder} aria-hidden="true" />;
  if (!data?.user) return <Link href="/login">Log in</Link>;
  const name = data.user.name.trim();
  const initial = Array.from(name)[0]?.toLocaleUpperCase() || "?";
  return <Link href="/dashboard" className={styles.profileLink} aria-label={`${name || "Your"} profile, open dashboard`} title={name || "Your profile"}>{initial}</Link>;
}
