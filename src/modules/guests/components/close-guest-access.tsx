"use client";
import { useState, useSyncExternalStore } from "react";
import styles from "./invitation-preview.module.css";
const subscribe = () => () => {};
export function CloseGuestAccess() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  async function close() { if (busy) return; setBusy(true); setError(""); try { const response = await fetch("/api/v1/guest/access",{ method: "DELETE",headers: { "Content-Type": "application/json","X-KP-Request": "1" },body: "{}" }); if (!response.ok) throw new Error(); window.location.replace("/invitation"); } catch { setError("Couldn’t close guest access. Please try again."); setBusy(false); } }
  return <div><button className={styles.secondary} disabled={!ready || busy} onClick={close}>{busy ? "Closing…" : "Close guest access"}</button>{error && <p role="alert">{error}</p>}</div>;
}
