"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ApiFailure, ApiList, ApiPage, ApiSuccess } from "@/shared/http/api-contract";
import { eventCreateSchema, eventTypes, formatEventTime, kolkataInput, eventFormInstant, type WeddingEvent } from "../schemas";
import styles from "./events.module.css";

type Draft = { name: string; type: WeddingEvent["type"]; startsAt: string; endsAt: string; venueName: string; address: string; description: string; dressCode: string; isPublic: boolean };
const blank: Draft = { name: "", type: "custom", startsAt: "", endsAt: "", venueName: "", address: "", description: "", dressCode: "", isPublic: false };
const label = (value: string) => value.charAt(0).toUpperCase()+value.slice(1);
export function EventsManager({ weddingId, initialEvents, initialPage, capacity }: { weddingId: string; initialEvents: WeddingEvent[]; initialPage: ApiPage; capacity: number }) {
  const router = useRouter(), drawer = useRef<HTMLDialogElement>(null);
  const [events,setEvents] = useState(initialEvents), [page,setPage] = useState(initialPage);
  const [mode,setMode] = useState<"create"|"edit"|"view"|null>(null), [selected,setSelected] = useState<WeddingEvent|null>(null);
  const [draft,setDraft] = useState(blank), [busy,setBusy] = useState(false), [loading,setLoading] = useState(false), [error,setError] = useState("");
  const [conflict,setConflict] = useState(false), [notice,setNotice] = useState("");
  const [uncertain,setUncertain] = useState(false);
  const base = `/api/v1/weddings/${weddingId}/events`;
  useEffect(() => { if (mode && !drawer.current?.open) drawer.current?.showModal(); },[mode]);
  function close() { if (busy || loading) return; drawer.current?.close(); setMode(null); if (!uncertain) setError(""); setConflict(false); }
  function create(type: Draft["type"] = "custom") { if (uncertain || loading || busy) return; setDraft({ ...blank,type,name: type === "custom" ? "" : label(type) }); setSelected(null); setError(""); setConflict(false); setMode("create"); }
  function edit(event: WeddingEvent) { setDraft({ name: event.name,type: event.type, startsAt: kolkataInput(event.startsAt).slice(0,16), endsAt: event.endsAt ? kolkataInput(event.endsAt).slice(0,16) : "",venueName: event.venueName ?? "",address: event.address ?? "",description: event.description ?? "",dressCode: event.dressCode ?? "",isPublic: event.isPublic }); setSelected(event); setConflict(false); setError(""); setMode("edit"); }
  async function detail(event: WeddingEvent, editing = false) {
    if (loading || busy || uncertain) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${base}/${event.id}`,{ cache: "no-store" });
      const result = await response.json() as ApiSuccess<WeddingEvent>|ApiFailure;
      if (!response.ok || !("data" in result)) throw new Error("error" in result ? result.error.message : "Couldn’t load this event.");
      setSelected(result.data); if (editing) edit(result.data); else setMode("view");
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t load this event."); }
    finally { setLoading(false); }
  }
  async function refreshList(cursor?: string, allPages = false) {
    const refreshed: WeddingEvent[] = [];
    let next = cursor, refreshedPage: ApiPage;
    do {
      const response = await fetch(base+(next ? `?cursor=${encodeURIComponent(next)}` : ""),{ cache: "no-store" });
      const result = await response.json() as ApiList<WeddingEvent>|ApiFailure;
      if (!response.ok || !("data" in result)) throw new Error("error" in result ? result.error.message : "Couldn’t refresh events.");
      refreshed.push(...result.data); refreshedPage = result.page;
      next = allPages && result.page.hasMore ? result.page.nextCursor ?? undefined : undefined;
    } while (next);
    setEvents(previous => cursor ? [...previous,...refreshed] : refreshed); setPage(refreshedPage);
  }
  async function loadMore() { setLoading(true); setError(""); try { await refreshList(page.nextCursor ?? undefined); } catch { setError("Couldn’t load events. Try refreshing the list."); } finally { setLoading(false); } }
  async function checkSavedEvents() {
    if (loading || busy) return;
    setLoading(true);
    try { await refreshList(undefined,true); setUncertain(false); setError(""); setConflict(false); drawer.current?.close(); setMode(null); setNotice("Saved events reloaded. Check the list before creating another event."); router.refresh(); }
    catch { setError("Couldn’t reload saved events. Check saved events again before trying another save."); }
    finally { setLoading(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || loading || conflict || uncertain) return;
    const optional = (value: string) => value.trim() || null;
    const parsed = eventCreateSchema.safeParse({ ...draft, startsAt: eventFormInstant(draft.startsAt, selected?.startsAt), endsAt: draft.endsAt ? eventFormInstant(draft.endsAt, selected?.endsAt) : null, venueName: optional(draft.venueName),address: optional(draft.address),description: optional(draft.description),dressCode: optional(draft.dressCode),coverPhotoId: selected?.coverPhotoId ?? null });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your event details."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(mode === "edit" && selected ? `${base}/${selected.id}` : base,{ method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "X-KP-Request": "1", ...(mode === "edit" && selected ? { "X-Expected-Version": String(selected.version) } : {}) },body: JSON.stringify(parsed.data) });
      const result = await response.json() as ApiSuccess<WeddingEvent>|ApiFailure;
      if (!response.ok || !("data" in result)) {
        if (response.status === 401) { router.replace("/login"); return; }
        if (response.status === 412) setConflict(true);
        setError("error" in result ? result.error.message : "Couldn’t save this event."); return;
      }
      drawer.current?.close(); setMode(null); setNotice(mode === "edit" ? "Event updated." : "Event created.");
      try { await refreshList(); } catch { setError("Your event was saved, but the list could not refresh. Reload the page to see it."); }
      router.refresh();
    } catch { setUncertain(true); setError("We couldn’t confirm the saved result. Check saved events before trying again."); }
    finally { setBusy(false); }
  }
  function input(name: "name"|"startsAt"|"endsAt"|"venueName"|"address"|"dressCode", title: string, required = false, maxLength = 500) { return <label>{title}<input name={name} value={draft[name]} onChange={event => setDraft({ ...draft,[name]: event.target.value })} type={name.endsWith("At") ? "datetime-local" : "text"} required={required} maxLength={maxLength} disabled={busy || loading || conflict || uncertain} step={name.endsWith("At") ? "60" : undefined} /></label>; }
  return <section className={styles.events} aria-labelledby="events-heading">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Every moment, together</p><h1 id="events-heading">Events & itineraries</h1><p>Bring your celebrations into one shared schedule.</p></div><button className={styles.primary} type="button" disabled={busy || loading || uncertain} onClick={() => create()}>+ Add event</button></div>
    <div className={styles.subhead}><span>Asia/Kolkata · India Standard Time</span><span>Up to {capacity} events per wedding</span></div>
    <section className={styles.shortcuts} aria-label="Ceremony shortcuts"><h2>Start with a celebration</h2><div>{eventTypes.map(type => <button type="button" key={type} disabled={busy || loading || uncertain} onClick={() => create(type)}>{type === "custom" ? "+ Custom event" : label(type)}</button>)}</div></section>
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {error && !mode && <p role="alert" className={styles.error}>{error} <button type="button" disabled={loading || busy} onClick={checkSavedEvents}>{loading ? "Checking…" : "Check saved events"}</button></p>}
    {!events.length ? <div className={styles.empty}><span aria-hidden="true">✧</span><h2>Your celebrations begin here.</h2><p>Add your first ceremony, gathering or reception. Events can happen before or after your wedding day.</p><button type="button" className={styles.primary} disabled={busy || loading || uncertain} onClick={() => create()}>Create your first event</button></div> : <div className={styles.list}>{events.map(event => <article key={event.id} className={styles.card}><div className={styles.cardTop}><span className={styles.tag}>{label(event.type)}</span><span>{event.isPublic ? "Selected for future website" : "Private workspace"}</span></div><h2>{event.name}</h2><p className={styles.time}><time dateTime={event.startsAt}>{formatEventTime(event.startsAt)}</time>{event.endsAt && <> — <time dateTime={event.endsAt}>{formatEventTime(event.endsAt)}</time></>} <small>IST</small></p><div className={styles.logistics}><p><span>Venue</span>{event.venueName || "Venue to be decided"}</p><p><span>Dress code</span>{event.dressCode || "No dress code specified"}</p></div>{event.description && <p className={styles.description}>{event.description}</p>}<div className={styles.actions}><button type="button" disabled={loading || busy || uncertain} onClick={() => detail(event)}>View details<span aria-hidden="true"> →</span></button><button type="button" disabled={loading || busy || uncertain} onClick={() => detail(event,true)}>Edit event</button></div></article>)}</div>}
    {page.hasMore && <button type="button" className={styles.secondary} disabled={loading || busy || uncertain} onClick={loadMore}>{loading ? "Loading…" : "Load more events"}</button>}
    <p className={styles.footnote}>Cover uploads, event deletion, calendar sync and linked planning tools will arrive in later features.</p>
    <dialog ref={drawer} className={styles.drawer} aria-labelledby="event-dialog-title" onCancel={event => { if (busy || loading) event.preventDefault(); else close(); }}>
      <div className={styles.drawerHead}><div><p className={styles.eyebrow}>Ceremony logistics</p><h2 id="event-dialog-title">{mode === "view" ? selected?.name : mode === "edit" ? "Edit event" : "Add event"}</h2></div><button type="button" aria-label="Close event panel" disabled={busy} onClick={close}>×</button></div>
      {error && <div className={styles.error} role="alert">{error}{conflict && selected && <button type="button" disabled={loading || busy || uncertain} onClick={() => detail(selected,true)}>Reload latest details</button>}{!conflict && <button type="button" disabled={busy || loading} onClick={checkSavedEvents}>{loading ? "Checking…" : "Check saved events"}</button>}</div>}
      {mode === "view" && selected ? <div className={styles.details}><span className={styles.tag}>{label(selected.type)}</span><dl>{[["Starts",formatEventTime(selected.startsAt)+" IST"],["Ends",selected.endsAt ? formatEventTime(selected.endsAt)+" IST" : "Not specified"],["Venue",selected.venueName ?? "Not specified"],["Address",selected.address ?? "Not specified"],["Dress code",selected.dressCode ?? "Not specified"],["Description",selected.description ?? "No notes yet"],["Website selection",selected.isPublic ? "Selected; website publishing is not available yet" : "Private workspace"]].map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><button className={styles.primary} type="button" onClick={() => edit(selected)}>Edit event</button></div> : <form onSubmit={save} aria-busy={busy} className={styles.form}><p className={styles.formNote}>Choose your start date and time in Asia/Kolkata. An optional end date can be the next day.</p>{input("name","Event name",true,150)}<label>Event type<select value={draft.type} disabled={busy || loading || conflict || uncertain} onChange={event => setDraft({ ...draft,type: event.target.value as Draft["type"] })}>{eventTypes.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label>{input("startsAt","Start date and time",true)}{input("endsAt","End date and time (optional)")}{input("venueName","Venue name (optional)")}{input("address","Address (optional)")}{input("dressCode","Dress code (optional)",false,5000)}<label>Description (optional)<textarea value={draft.description} maxLength={5000} rows={4} disabled={busy || loading || conflict || uncertain} onChange={event => setDraft({ ...draft,description: event.target.value })} /></label><label className={styles.checkbox}><input type="checkbox" checked={draft.isPublic} disabled={busy || loading || conflict || uncertain} onChange={event => setDraft({ ...draft,isPublic: event.target.checked })} />Include on future public wedding website</label><small>This choice does not publish the event.</small><div className={styles.formActions}><button type="button" disabled={busy} className={styles.secondary} onClick={close}>Cancel</button><button type="submit" disabled={busy || loading || conflict || uncertain} className={styles.primary}>{busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create event"}</button></div></form>}
    </dialog>
  </section>;
}
