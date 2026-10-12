"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { ApiFailure, ApiSuccess } from "@/shared/http/api-contract";
import type { GuestInvitation } from "../invitation-contract";
import { guestRsvpSchema, type SavedGuestRsvp } from "../rsvp-contract";
import styles from "./invitation-preview.module.css";

const subscribe = () => () => {};
export function GuestRsvpForm({ view,onCurrent }: { view: GuestInvitation; onCurrent: (view: GuestInvitation) => void }) {
  const ready = useSyncExternalStore(subscribe,() => true,() => false);
  const [status,setStatus] = useState<"attending"|"not_attending"|"">(view.guest.rsvp.status === "pending" ? "" : view.guest.rsvp.status);
  const [partySize,setPartySize] = useState(view.guest.rsvp.partySize || 1);
  const [editing,setEditing] = useState(view.guest.rsvp.status === "pending");
  const [busy,setBusy] = useState(false), [blocked,setBlocked] = useState(false), [message,setMessage] = useState("");
  const [retryAt,setRetryAt] = useState(0), locked = useRef(false);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setTimeout(() => setRetryAt(0),Math.max(0,retryAt-Date.now()));
    return () => window.clearTimeout(timer);
  },[retryAt]);
  const disabled = !ready || busy || blocked || !!retryAt || !view.capabilities.canRespond;

  async function reload() {
    if (locked.current) return; locked.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/guest/invitation",{ cache: "no-store" });
      const body = await response.json() as ApiSuccess<GuestInvitation>|ApiFailure;
      if (!response.ok || !("data" in body)) throw new Error(response.status === 401 || response.status === 404 ? "Your guest access is unavailable. Reopen your personal invitation or ask the family for a current link." : "The latest response couldn’t be loaded. Please try again.");
      onCurrent(body.data);
      setStatus(body.data.guest.rsvp.status === "pending" ? "" : body.data.guest.rsvp.status);
      setPartySize(body.data.guest.rsvp.partySize || 1); setBlocked(false); setEditing(true);
      setMessage("Latest response and invitation loaded. Check these before saving another change.");
    } catch (error) { setBlocked(true); setMessage(error instanceof Error ? error.message : "Please try loading your response again."); }
    finally { locked.current = false; setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || disabled) return;
    const answer = guestRsvpSchema.safeParse({ invitationContext: view.invitationContext,status,partySize: status === "not_attending" ? 0 : partySize });
    if (!answer.success || answer.data.partySize > view.guest.maxPartySize) { setMessage(`Choose an answer and a party size from 1 to ${view.guest.maxPartySize} when attending.`); return; }
    locked.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/guest/rsvp",{ method: "PUT",headers: { "Content-Type": "application/json","X-KP-Request": "1","X-Expected-Version": String(view.guest.version) },body: JSON.stringify(answer.data) });
      const body = await response.json() as ApiSuccess<SavedGuestRsvp>|ApiFailure;
      if (!response.ok || !("data" in body)) {
        const mustReload = [409,412,429].includes(response.status) || response.status >= 500;
        setBlocked(mustReload || [401,404].includes(response.status));
        if (response.status === 429) setRetryAt(Date.now()+Math.min(3600,Math.max(1,Number(response.headers.get("Retry-After")) || 60))*1000);
        setMessage(response.status >= 500 ? "We couldn’t confirm your save. Load the latest response before trying again." : "error" in body ? body.error.message : "Your response couldn’t be saved.");
        return;
      }
      onCurrent({ ...view,guest: { ...view.guest,version: body.data.version,rsvp: body.data.rsvp },capabilities: { ...view.capabilities,...body.data.capabilities } });
      setEditing(false); setBlocked(false);
    } catch { setBlocked(true); setMessage("We couldn’t confirm your save. Load the latest response before trying again; your answer may already be saved."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div>
    <div className={styles.confirmation} aria-live="polite"><h3>{view.guest.rsvp.status === "pending" ? "Your current response" : "Your response is saved"}</h3><p>{view.guest.rsvp.status === "pending" ? "Awaiting response" : view.guest.rsvp.status === "attending" ? `Attending · ${view.guest.rsvp.partySize} ${view.guest.rsvp.partySize === 1 ? "person" : "people"}` : "Not attending"}</p>{!editing && <button className={styles.secondary} disabled={!ready || busy} onClick={() => setEditing(true)}>Change response</button>}</div>
    {!view.capabilities.canAttend && <p className={styles.disclaimer}>No active invited events remain. Your saved response is unchanged. You can still choose not attending.</p>}
    {editing && <form onSubmit={save}><fieldset className={styles.choices} disabled={disabled}><legend>Will you be attending?</legend><label className={`${styles.choice} ${status === "attending" ? styles.active : ""}`}><input type="radio" name="attendance" value="attending" checked={status === "attending"} disabled={!view.capabilities.canAttend} onChange={() => setStatus("attending")} /><span><strong>Yes, I’ll be there</strong><small>We look forward to celebrating together.</small></span></label><label className={`${styles.choice} ${status === "not_attending" ? styles.active : ""}`}><input type="radio" name="attendance" value="not_attending" checked={status === "not_attending"} onChange={() => setStatus("not_attending")} /><span><strong>Sorry, I can’t attend</strong><small>Send your wishes to the happy couple.</small></span></label></fieldset>{status === "attending" && <label className={styles.party}>How many people will attend?<select value={partySize} disabled={disabled || !view.capabilities.canAttend} onChange={event => setPartySize(Number(event.target.value))}>{Array.from({ length: view.guest.maxPartySize },(_,index) => index+1).map(size => <option key={size} value={size}>{size} {size === 1 ? "person" : "people"}</option>)}</select><small>Include yourself in the total.</small></label>}<button className={styles.primary} disabled={disabled || !status || (status === "attending" && !view.capabilities.canAttend)}>{busy ? "Saving…" : "Save response"}</button><p className={styles.disclaimer}>One response covers your invitation group and all its invited celebrations. You can change it later through this link.</p></form>}
    {message && <p role="alert">{message}</p>}{blocked && <button className={styles.secondary} disabled={!ready || busy || !!retryAt} onClick={reload}>{busy ? "Loading…" : retryAt ? "Please wait before reloading" : "Load latest response"}</button>}
  </div>;
}
