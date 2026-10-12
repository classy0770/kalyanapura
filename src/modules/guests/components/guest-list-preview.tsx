"use client";

import { useRef, useState } from "react";
import styles from "./guest-list-preview.module.css";

type Guest = { id: number; name: string; email: string; phone: string; maxPartySize: number; events: string[]; notes: string; status: "Pending" | "Attending" | "Not attending"; partySize: number };
const ceremonies = ["Haldi & Mehendi", "Muhurtham", "Reception"];
const sampleGuests: Guest[] = [
  { id: 1, name: "Suresh & Lakshmi Menon", email: "suresh@example.com", phone: "", maxPartySize: 4, events: ["Muhurtham", "Reception"], notes: "Bride’s maternal uncle. Arrange transport from the hotel.", status: "Attending", partySize: 3 },
  { id: 2, name: "Anjali & Deepak Kurup", email: "anjali@example.com", phone: "", maxPartySize: 2, events: ceremonies, notes: "Friends of the couple", status: "Pending", partySize: 0 },
  { id: 3, name: "Madhavan Unni & family", email: "", phone: "", maxPartySize: 5, events: ["Muhurtham", "Reception"], notes: "Contact through the family", status: "Attending", partySize: 4 },
  { id: 4, name: "Priya Nair", email: "priya@example.com", phone: "", maxPartySize: 1, events: ["Haldi & Mehendi", "Reception"], notes: "College friend", status: "Not attending", partySize: 0 },
  { id: 5, name: "Arjun & Meera", email: "arjun@example.com", phone: "", maxPartySize: 3, events: ["Reception"], notes: "Travelling from Bengaluru", status: "Pending", partySize: 0 },
  { id: 6, name: "Chandrasekharan", email: "", phone: "", maxPartySize: 1, events: ["Muhurtham"], notes: "Prefers a phone invitation", status: "Attending", partySize: 1 },
];
const emptyGuest: Guest = { id: 0, name: "", email: "", phone: "", maxPartySize: 1, events: [], notes: "", status: "Pending", partySize: 0 };

/** Presentation prototype only. No persistence, invitation tokens or provider calls. */
export function GuestListPreview() {
  const [guests, setGuests] = useState(sampleGuests);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All responses");
  const [event, setEvent] = useState("All events");
  const [draft, setDraft] = useState<Guest>(emptyGuest);
  const [viewing, setViewing] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = guests.filter(guest => `${guest.name} ${guest.email} ${guest.phone} ${guest.notes}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (status === "All responses" || guest.status === status) && (event === "All events" || guest.events.includes(event)));
  const attending = guests.filter(guest => guest.status === "Attending");
  const pending = guests.filter(guest => guest.status === "Pending").length;
  const declined = guests.filter(guest => guest.status === "Not attending").length;
  function open(guest: Guest, readOnly = false) { setDraft({ ...guest, events: [...guest.events] }); setViewing(readOnly); dialog.current?.showModal(); }
  function reset() { setGuests(sampleGuests); setQuery(""); setStatus("All responses"); setEvent("All events"); setMessage("Fictional samples restored."); }
  return <section className={styles.page} aria-labelledby="guest-list-heading">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Your favourite people, together</p><h1 id="guest-list-heading">Guest list</h1><p>Make room for everyone who makes your celebration yours.</p></div><button className={styles.primary} onClick={() => open(emptyGuest)}>+ Add guest</button></div>
    <div className={styles.notice} role="note"><strong>Interactive design preview</strong><p>Guests, events and RSVP responses here are fictional. Preview changes last until you refresh; nothing is saved or sent.</p><button className={styles.textButton} onClick={reset}>Reset samples</button></div>
    <div className={styles.metrics} aria-label="Fictional guest summaries">{[
      ["Guest groups", guests.length, "One record per invitation"],
      ["Attending", attending.length, `${attending.reduce((sum, guest) => sum + guest.partySize, 0)} people in total`],
      ["Awaiting response", pending, "We’re keeping a place for them"],
      ["Not attending", declined, "With us in spirit"],
    ].map(([label, count, detail]) => <article key={label}><span className={styles.eyebrow}>{label}</span><strong>{count}</strong><p>{detail}</p></article>)}</div>
    <div className={styles.directory}>
      <div className={styles.directoryHead}><div><h2>Family & friends</h2><p>Contact details, celebrations and a little context.</p></div><span className={styles.sample}>Sample directory</span></div>
      <div className={styles.filters}><label className={styles.search}>Search guests<input type="search" placeholder="Search names, contacts or notes…" value={query} onChange={e => setQuery(e.target.value)} /></label><label>RSVP status<select value={status} onChange={e => setStatus(e.target.value)}>{["All responses", "Pending", "Attending", "Not attending"].map(value => <option key={value}>{value}</option>)}</select></label><label>Invited event<select value={event} onChange={e => setEvent(e.target.value)}>{["All events", ...ceremonies].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Fictional guests for design review</caption><thead><tr>{["Guest / family", "Contact", "Max. party", "Invited events", "RSVP", "People attending", "Actions"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(guest => <tr key={guest.id}>
        <td data-label="Guest / family"><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{guest.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span><div><button className={styles.nameButton} onClick={() => open(guest, true)}>{guest.name}</button><p className={styles.notes}>{guest.notes}</p></div></div></td>
        <td data-label="Contact"><span>{guest.email || "No email added"}</span><p>{guest.phone || "No phone added"}</p></td><td data-label="Max. party"><span className={styles.number}>{guest.maxPartySize}</span></td><td data-label="Invited events"><div className={styles.chips}>{guest.events.length ? guest.events.map(name => <span key={name}>{name}</span>) : <span>No events selected</span>}</div></td><td data-label="RSVP"><span className={`${styles.status} ${guest.status === "Attending" ? styles.attending : guest.status === "Pending" ? styles.pending : styles.declined}`}>{guest.status}</span></td><td data-label="People attending"><strong>{guest.partySize}</strong><small> / {guest.maxPartySize}</small></td><td data-label="Actions"><button className={styles.textButton} aria-label={`Edit ${guest.name}`} onClick={() => open(guest)}>Edit</button></td>
      </tr>)}</tbody></table></div>
      {!visible.length && <div className={styles.empty}><h2>No guests found</h2><p>Try a different search or clear your filters.</p><button className={styles.secondary} onClick={() => { setQuery(""); setStatus("All responses"); setEvent("All events"); }}>Clear filters</button></div>}
      <div className={styles.tableFoot}><span>Showing {visible.length} of {guests.length} sample guest groups</span><span>Party sizes include the named guest.</span></div>
    </div>
    <div className={styles.future}><span aria-hidden="true">✉</span><div><h2>A personal invitation comes next</h2><p>Invitation links, RSVP collection, CSV imports and reminders will arrive in later features. This preview sends no invitations.</p></div><span className={styles.sample}>Coming later</span></div>
    <p className={styles.feedback} role="status">{message}</p>
    <dialog ref={dialog} className={styles.drawer} aria-labelledby="guest-form-heading"><div className={styles.drawerHead}><div><p className={styles.eyebrow}>Sample guest group</p><h2 id="guest-form-heading">{viewing ? "Guest details" : draft.id ? "Edit guest" : "Add a guest"}</h2></div><button className={styles.close} aria-label="Close guest panel" onClick={() => dialog.current?.close()}>×</button></div>
      {viewing ? <div className={styles.details}><h3>{draft.name}</h3><dl><dt>Email</dt><dd>{draft.email || "Not added"}</dd><dt>Phone</dt><dd>{draft.phone || "Not added"}</dd><dt>Maximum party size</dt><dd>{draft.maxPartySize} including the named guest</dd><dt>Invited events</dt><dd>{draft.events.join(", ") || "None selected"}</dd><dt>Sample RSVP</dt><dd>{draft.status} · {draft.partySize} people</dd><dt>Organiser notes</dt><dd>{draft.notes || "No notes"}</dd></dl><button className={styles.primary} onClick={() => setViewing(false)}>Edit sample guest</button></div> : <form onSubmit={e => { e.preventDefault(); const updated = { ...draft, name: draft.name.trim(), id: draft.id || Math.max(0, ...guests.map(guest => guest.id)) + 1 }; if (!updated.name) return; setGuests(current => draft.id ? current.map(guest => guest.id === draft.id ? updated : guest) : [...current, updated]); setMessage(`“${updated.name}” updated in this preview only. Nothing was saved or sent.`); dialog.current?.close(); }}>
        <p className={styles.formNotice}>Try the form. Changes affect this fictional preview only.</p>
        <label>Guest / family name<input required maxLength={200} autoFocus value={draft.name} placeholder="e.g. Ravi & family" onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <div className={styles.formPair}><label>Email <small>Optional</small><input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label><label>Phone <small>Optional</small><input type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></label></div>
        <label>Maximum party size<input type="number" required min={Math.max(1, draft.partySize)} step="1" value={draft.maxPartySize} onChange={e => setDraft({ ...draft, maxPartySize: Number(e.target.value) })} /><small>Includes the named guest. {draft.partySize ? `At least ${draft.partySize} people, matching the sample attending count.` : "Defaults to one person."}</small></label>
        <fieldset><legend>Events invited to</legend><p>Choose the celebrations this group will join.</p>{ceremonies.map(name => <label className={styles.check} key={name}><input type="checkbox" checked={draft.events.includes(name)} onChange={e => setDraft({ ...draft, events: e.target.checked ? [...draft.events, name] : draft.events.filter(eventName => eventName !== name) })} />{name}</label>)}</fieldset>
        <label>Organiser notes <small>Optional</small><textarea rows={3} maxLength={2000} value={draft.notes} placeholder="Travel plans, family connections, or anything helpful…" onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
        <div className={styles.formFoot}><button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>Cancel</button><button className={styles.primary} type="submit">{draft.id ? "Update preview" : "Add to preview"}</button></div>
      </form>}
    </dialog>
  </section>;
}
