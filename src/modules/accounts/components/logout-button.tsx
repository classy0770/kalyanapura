"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../client";
import styles from "./account.module.css";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  return <><button className={styles.button} disabled={busy} onClick={async () => {
    setBusy(true); setError(false);
    try { const result = await authClient.signOut();
      if (result.error) { setError(true); return; }
      router.replace("/login"); router.refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }}>{busy ? "Logging out…" : "Log out"}</button>{error && <p role="alert">Logout failed. Please try again; your session may still be active.</p>}</>;
}
