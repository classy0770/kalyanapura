"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./invitation-preview.module.css";
export function InvitationEntry({ token }: { token: string }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const locked = useRef(false);
  // Keep the entry credential in memory only; remove it before any navigation.
  useEffect(() => { window.history.replaceState(null,"","/invitation"); },[]);
  async function open() {
    if (locked.current) return; locked.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/guest/access",{ method: "POST",headers: { "Content-Type": "application/json","X-KP-Request": "1" },body: JSON.stringify({ source: "invitation",token }),referrerPolicy: "no-referrer" });
      if (!response.ok) { setError(response.status === 404 ? "This invitation is unavailable. Ask the family for a current link." : "Your invitation couldn’t be opened right now. Please try again."); return; }
      window.location.replace("/invitation");
    } catch { setError("Your invitation couldn’t be opened right now. Please try again."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className={styles.page}><main className={styles.unavailable}><div className={styles.seal} aria-hidden="true">✉</div><p className={styles.eyebrow}>Your personal invitation</p><h1>You’re invited to celebrate.</h1><p>Open your invitation to see the celebrations chosen for you. No account is needed.</p>{error && <p role="alert">{error}</p>}<button className={styles.primary} disabled={busy} onClick={open}>{busy ? "Opening invitation…" : "Open my invitation"}</button><p className={styles.disclaimer}>This is a personal link. Share it only with people in your invitation group.</p></main></div>;
}
