"use client";
import { useEffect, useRef, useState } from "react";
import type { ApiFailure, ApiSuccess } from "@/shared/http/api-contract";
import { memberRsvpSchema, type Guest } from "../schemas";
import styles from "./guest-list-preview.module.css";

export function MemberRsvpForm({ weddingId,guest,partyLimit,onCurrent,onBusy }: { weddingId: string; guest: Guest; partyLimit: number; onCurrent: (guest: Guest) => Promise<void>; onBusy: (busy: boolean) => void }) {
  const [current,setCurrent] = useState(guest), [open,setOpen] = useState(false);
  const [status,setStatus] = useState(guest.rsvp.status), [people,setPeople] = useState(guest.rsvp.partySize || 1);
  const [lower,setLower] = useState(false), [allocation,setAllocation] = useState(guest.maxPartySize);
  const [confirmed,setConfirmed] = useState(false), [busy,setBusy] = useState(false), [blocked,setBlocked] = useState(false), [message,setMessage] = useState("");
  const lock = useRef(false), base = `/api/v1/weddings/${weddingId}/guests/${guest.id}`;
  const [retryAt,setRetryAt] = useState(0);
  useEffect(() => { if (!retryAt) return; const timer = window.setTimeout(()=>setRetryAt(0),Math.max(0,retryAt-Date.now())); return ()=>window.clearTimeout(timer); },[retryAt]);
  function sync(value: Guest) { setCurrent(value); setStatus(value.rsvp.status); setPeople(value.rsvp.partySize || 1); setAllocation(value.maxPartySize); setLower(false); setConfirmed(false); }
  async function reload() {
    if (lock.current || retryAt) return; lock.current = true; setBusy(true); onBusy(true);
    try { const response = await fetch(base,{ cache: "no-store" }), body = await response.json() as ApiSuccess<Guest>|ApiFailure;
      if (!response.ok || !("data" in body)) throw new Error("Couldn’t load this guest. Check your membership and try again.");
      sync(body.data); setBlocked(false); setOpen(true); await onCurrent(body.data); setMessage("Latest RSVP and allocation loaded. Review and confirm before saving.");
    } catch (error) { setBlocked(true); setMessage(error instanceof Error ? error.message : "Couldn’t reload the response."); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || blocked || retryAt || !confirmed) return;
    const parsed = memberRsvpSchema.safeParse({ status,partySize: status === "attending" ? people : 0 });
    const max = lower ? allocation : current.maxPartySize;
    if (!parsed.success || parsed.data.partySize > max || (lower && (!Number.isInteger(max) || max < 1 || max >= current.maxPartySize || max > partyLimit))) { setMessage("Choose a valid response within the allocation. A new allocation must be lower than the current one and within the configured limit."); return; }
    lock.current = true; setBusy(true); onBusy(true); setMessage("");
    try {
      const response = await fetch(lower ? base : base+"/rsvp",{ method: lower ? "PATCH" : "PUT",headers: { "Content-Type": "application/json","X-KP-Request": "1","X-Expected-Version": String(current.version) },body: JSON.stringify(lower ? { maxPartySize: max,rsvp: parsed.data } : parsed.data) });
      const body = await response.json() as ApiFailure|ApiSuccess<unknown>;
      if (!response.ok) { setBlocked([401,403,404,409,412,429].includes(response.status) || response.status >= 500); if (response.status === 429) { setConfirmed(false); setRetryAt(Date.now()+Math.min(3600,Math.max(1,Number(response.headers.get("Retry-After")) || 60))*1000); } setMessage(response.status >= 500 ? "We couldn’t confirm this correction. Reload before another save." : "error" in body ? body.error.message : "Couldn’t save the correction."); return; }
      const fresh = await fetch(base,{ cache: "no-store" }), result = await fresh.json() as ApiSuccess<Guest>|ApiFailure;
      if (!fresh.ok || !("data" in result)) throw new Error();
      sync(result.data); await onCurrent(result.data); setOpen(false); setMessage("Organiser RSVP correction saved.");
    } catch { setBlocked(true); setMessage("We couldn’t confirm the current result. Reload the saved RSVP before another correction; it may already be saved."); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <section className={styles.invitationControls} aria-label="Organiser RSVP correction"><h3>Organiser RSVP correction</h3><p>Record a phone response, correct attendance, or reset to Pending. No message is sent.</p>{!open && !blocked && <button className={styles.secondary} disabled={busy} onClick={reload}>Record or correct RSVP</button>}{open && <form onSubmit={save}><fieldset disabled={busy || blocked}><label>Corrected RSVP status<select value={status} onChange={event => { setStatus(event.target.value as Guest["rsvp"]["status"]); setConfirmed(false); }}><option value="pending">Pending</option><option value="attending">Attending</option><option value="not_attending">Not attending</option></select></label>{status === "attending" && <label>Corrected attending people<input type="number" min="1" max={lower ? allocation : current.maxPartySize} required value={people} onChange={event => { setPeople(Number(event.target.value)); setConfirmed(false); }} /></label>}{current.maxPartySize > 1 && <label className={styles.check}><input type="checkbox" checked={lower} onChange={event => { setLower(event.target.checked); setConfirmed(false); }} />Lower allocation with this correction</label>}{lower && <label>New maximum party size<input type="number" min="1" max={Math.min(partyLimit,current.maxPartySize-1)} required value={allocation} onChange={event => { setAllocation(Number(event.target.value)); setConfirmed(false); }} /></label>}<p>Current allocation: {current.maxPartySize}. Organisers may correct responses even without active invited events. Attendance is never reduced automatically.</p><label className={styles.check}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this organiser correction.</label></fieldset><button className={styles.primary} disabled={busy || blocked || !confirmed}>{busy ? "Saving…" : "Save RSVP correction"}</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel correction</button></form>}{message && <p role={blocked ? "alert" : "status"}>{message}</p>}{blocked && <button className={styles.secondary} disabled={busy || !!retryAt} onClick={reload}>{retryAt ? "Please wait before reloading" : "Reload saved RSVP"}</button>}</section>;
}
