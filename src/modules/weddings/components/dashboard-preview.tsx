"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WeddingEvent } from "@/modules/events/schemas";
import type { RsvpOverview } from "@/modules/guests/rsvp-contract";
import { EventsOverview } from "@/modules/events/components/events-overview";
import { daysUntilWedding, type Membership } from "../schemas";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/modules/accounts/components/logout-button";
import styles from "./dashboard-preview.module.css";

export type WeddingPreviewDetails = { brideName: string; groomName: string; weddingDate: string; location: string; title: string };
export const sampleWedding: WeddingPreviewDetails = { brideName: "Kavitha", groomName: "Rajesh", weddingDate: "2027-02-14", location: "Kozhikode, Kerala", title: "Together begins here" };
export function formatWeddingDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

const features = {
  events: { label: "Events", icon: "calendar", description: "Bring every ceremony into a shared itinerary with venues, timings, and dress codes." },
  tasks: { label: "Tasks", icon: "check", description: "Share the little things to do, assign them to wedding members, and track progress." },
  guests: { label: "Guests", icon: "users", description: "Organise guest groups and the celebrations they are invited to." },
  invitations: { label: "Invitations & RSVP", icon: "mail", description: "Share invitations and see who will be joining your celebration." },
  expenses: { label: "Expenses", icon: "rupee", description: "Keep wedding expenses and payments together, organised by category." },
  vendors: { label: "My vendors", icon: "store", description: "Keep your chosen vendors and their contact details in one place." },
  discovery: { label: "Discover vendors", icon: "search", description: "Explore vendors through external Maps discovery and save your favourites." },
  website: { label: "Wedding website", icon: "globe", description: "Give your celebration a public home with your story and wedding details." },
  photos: { label: "Private photo gallery", icon: "photo", description: "Keep your wedding memories in a private gallery, separate from your public wedding website." },
  qr: { label: "Guest QR", icon: "qr", description: "Share a QR code for the guest gallery and photo-upload experience when gallery capabilities are available." },
  livestream: { label: "Livestream", icon: "play", description: "Help guests watch your celebration through a livestream on your wedding website." },
  details: { label: "Wedding details", icon: "settings", description: "Editing wedding details will be available in a future feature." },
  members: { label: "Wedding members", icon: "users", description: "Plan with your family. Wedding membership and Admin permissions will arrive in a future feature." },
} as const;
type Feature = keyof typeof features;
type IconName = typeof features[Feature]["icon"] | "dashboard" | "menu" | "close" | "arrow" | "heart" | "location" | "sparkle";
const groups: { label: string; items: Feature[] }[] = [
  { label: "Planning", items: ["events", "tasks"] },
  { label: "Guests", items: ["guests", "invitations"] },
  { label: "Finance & vendors", items: ["expenses", "vendors", "discovery"] },
  { label: "Website & memories", items: ["website", "photos", "qr", "livestream"] },
  { label: "Settings", items: ["details", "members"] },
];
const paths: Record<IconName, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 11h18 M7 15h3 M14 15h3",
  check: "M9 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5 M9 11l4 4L21 5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
  mail: "M3 5h18v14H3z M3 5l9 7 9-7", rupee: "M5 4h14 M5 8h14 M7 4c9 0 9 8 0 8H5l11 9",
  store: "M3 9l2-6h14l2 6 M3 9v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9H3 M5 15v6h14v-6 M9 21v-5h6v5",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M17 17l5 5",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M2 12h20 M12 2c6 6 6 14 0 20-6-6-6-14 0-20",
  photo: "M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M16 7h.01",
  qr: "M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h4v4h-6z M12 3v6 M3 12h6 M12 12h5 M21 12v3 M12 18v3",
  play: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M10 8l6 4-6 4z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  menu: "M3 6h18 M3 12h18 M3 18h18", close: "M6 6l12 12 M18 6L6 18", arrow: "M4 12h16 M14 6l6 6-6 6",
  heart: "M20 4c-3-3-7-1-8 2-1-3-5-5-8-2-5 5 2 11 8 16 6-5 13-11 8-16z",
  location: "M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14 M12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  sparkle: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
};
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
const stats: { feature: Feature; label: string; value: string; detail: string }[] = [
  { feature: "events", label: "Wedding events", value: "6", detail: "Celebrations to look forward to" },
  { feature: "tasks", label: "Tasks completed", value: "18 / 32", detail: "One step closer to the big day" },
  { feature: "guests", label: "Guest groups", value: "120", detail: "Your favourite people, together" },
  { feature: "invitations", label: "RSVP responses", value: "86 / 120", detail: "Guest groups who have responded" },
  { feature: "expenses", label: "Total expenses", value: "₹12,45,000", detail: "Across your wedding categories" },
  { feature: "vendors", label: "Wedding vendors", value: "8", detail: "The team behind your celebration" },
];

export function DashboardPreview({ details = sampleWedding, onBack, accountName, membership, initialDays = 42, children, activePage = "dashboard", eventOverview, guestCount, rsvpOverview }: { details?: WeddingPreviewDetails; onBack?: () => void; accountName?: string; membership?: Membership; initialDays?: number; children?: ReactNode; activePage?: "dashboard"|"events"|"guests"; eventOverview?: { count: number; upcoming: WeddingEvent[] }; guestCount?: number; rsvpOverview?: RsvpOverview }) {
  const [days, setDays] = useState(initialDays);
  useEffect(() => {
    if (!membership) return;
    const update = () => setDays(daysUntilWedding(details.weddingDate));
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [details.weddingDate, membership]);
  const drawer = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const [feature, setFeature] = useState<Feature>("events");
  const names = `${details.groomName} & ${details.brideName}`;
  function openFeature(next: Feature) { drawer.current?.close(); setFeature(next); panel.current?.showModal(); }
  function previewButton(key: Feature, label: string, className = styles.textButton) {
    if (key === "invitations" && membership) return <Link className={className} href="/dashboard/guests">View guest responses<Icon name="arrow" size={14} /></Link>;
    if (key === "guests") return <Link className={className} href={membership ? "/dashboard/guests" : "/preview/guests"}>{membership ? "View guest list" : "Guest list preview"}<Icon name="arrow" size={14} /></Link>;
    if (key === "events" && membership) return <Link className={className} href="/dashboard/events">{label === "Explore preview" ? "View events" : label}<Icon name="arrow" size={14} /></Link>;
    return <button type="button" className={className} onClick={() => openFeature(key)}>{label}<Icon name="arrow" size={14} /></button>;
  }
  const navigation = <>
    <Link href="/" className={styles.brand}><Image src="/images/homepage/wordmark.png" alt="KalyanaPura home" width={260} height={60} sizes="174px" /></Link>
    <nav aria-label="Wedding preview navigation">
      <Link href={membership ? "/dashboard" : "#wedding-dashboard"} className={`${styles.navItem} ${activePage === "dashboard" ? styles.activeNav : ""}`} aria-current={activePage === "dashboard" ? "page" : undefined} onClick={() => drawer.current?.close()}><Icon name="dashboard" /><span>Dashboard</span></Link>
      {groups.map(group => <div className={styles.navGroup} key={group.label}><p>{group.label}</p>{group.items.map(key => key === "invitations" && membership ? <Link key={key} className={styles.navItem} href="/dashboard/guests" onClick={() => drawer.current?.close()}><Icon name="mail" /><span>Invitations & RSVP</span></Link> : key === "guests" ? <Link key={key} className={`${styles.navItem} ${activePage === "guests" ? styles.activeNav : ""}`} aria-current={activePage === "guests" ? "page" : undefined} href={membership ? "/dashboard/guests" : "/preview/guests"} onClick={() => drawer.current?.close()}><Icon name="users" /><span>Guest list</span>{!membership && <small>Preview</small>}</Link> : key === "events" && membership ? <Link key={key} className={`${styles.navItem} ${activePage === "events" ? styles.activeNav : ""}`} aria-current={activePage === "events" ? "page" : undefined} href="/dashboard/events" onClick={() => drawer.current?.close()}><Icon name="calendar" /><span>Events</span></Link> : <button type="button" className={styles.navItem} key={key} onClick={() => openFeature(key)}><Icon name={features[key].icon} /><span>{features[key].label}</span><small>Soon</small></button>)}</div>)}
    </nav>
    <div className={styles.sidebarFoot}><Icon name="heart" /><p>A little less planning.<br />A lot more celebrating.</p></div>
  </>;
  return <div className={styles.workspace}>
    <a href="#wedding-dashboard" className={styles.skipLink}>Skip to dashboard</a>
    <aside className={styles.sidebar} aria-label="Preview workspace">{navigation}</aside>
    <div className={styles.workspaceBody}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}><button type="button" className={styles.menuButton} aria-label="Open workspace navigation" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu" size={22} /></button><span>Workspace <span aria-hidden="true">/</span> <strong>{activePage === "events" ? "Events" : activePage === "guests" ? "Guest list" : "Dashboard"}</strong></span></div>
        <div className={styles.account}>{accountName !== undefined ? <><Link href="/account" className={styles.accountLink}><span className={styles.avatar} aria-hidden="true">{Array.from(accountName.trim())[0]?.toLocaleUpperCase() || "?"}</span><span className={styles.accountName}>{accountName}</span></Link>{membership && <span className={styles.roleBadge}>{membership.role === "admin" ? "Admin" : "Manager"}</span>}<LogoutButton className={styles.logout} /></> : <><span className={styles.previewBadge}>Design preview</span><Link href="/account">My account</Link></>}</div>
      </header>
      <main id="wedding-dashboard" className={styles.dashboard} tabIndex={-1}>
        {children ?? <>
        <h1 className={styles.srOnly}>Your wedding workspace.</h1>
        <section className={styles.hero} aria-label="Wedding details preview">
          <div className={styles.heroTop}><p className={styles.eyebrow}>Your celebration, beautifully organised</p><span className={styles.countdown}><Icon name="calendar" /><span>{days === 0 ? "Your wedding day" : days < 0 ? `${Math.abs(days)} days since the wedding` : `${days} days to go`}<small>{membership ? "Asia/Kolkata" : "Sample countdown"}</small></span></span></div>
          <div className={styles.heroMain}><div>{details.title && <p className={styles.weddingTitle}>{details.title}</p>}<h2>{names}</h2><div className={styles.weddingMeta}><span><Icon name="calendar" /><time dateTime={details.weddingDate}>{formatWeddingDay(details.weddingDate)}</time></span><span><Icon name="location" />{details.location}</span><span><Icon name="globe" />Asia/Kolkata · INR</span></div></div>{onBack ? <button type="button" className={styles.outlineButton} onClick={onBack}>← Edit preview details</button> : membership ? previewButton("details", "Wedding details", styles.outlineButton) : <Link href="/create-wedding" className={styles.outlineButton}>Preview wedding setup<Icon name="arrow" size={14} /></Link>}</div>
          <div className={styles.together}><span className={styles.coupleAvatar} aria-hidden="true"><Icon name="heart" /></span><div><strong>Better, together.</strong><p>A shared space for your family and your celebration.</p></div>{previewButton("members", "Explore collaboration")}</div>
        </section>
        <div className={styles.previewNotice} role="note"><Icon name="sparkle" size={22} /><div><strong>Your workspace is taking shape</strong><p>{membership ? "Your wedding details and countdown are real. Your events, guest list and RSVP totals are saved too. Other planning panels below use fictional sample data until their features are available." : "Design preview. No wedding has been created or saved. Planning panels and countdown use fictional sample data."}</p></div></div>
        <section className={styles.statGrid} aria-label="Planning summaries">{stats.map(stat => <article className={styles.statCard} key={stat.feature}><div className={styles.statTop}><Icon name={features[stat.feature].icon} size={21} /><span className={styles.sampleBadge}>{(stat.feature === "events" && eventOverview) || (stat.feature === "guests" && guestCount !== undefined) || (stat.feature === "invitations" && rsvpOverview) ? "Saved" : "Sample"}</span></div><p>{stat.label}</p><strong>{stat.feature === "events" && eventOverview ? eventOverview.count : stat.feature === "guests" && guestCount !== undefined ? guestCount : stat.feature === "invitations" && rsvpOverview ? `${rsvpOverview.respondedGuestCount} / ${rsvpOverview.guestCount}` : stat.value}</strong><small>{stat.detail}</small>{previewButton(stat.feature, "Explore preview")}</article>)}</section>
        <div className={styles.dashboardGrid}>
          <div className={styles.mainColumn}>
            <section className={styles.card} aria-labelledby="celebrations-heading"><div className={styles.cardHead}><div><span className={styles.sampleBadge}>{eventOverview ? "Saved itinerary" : "Sample itinerary"}</span><h2 id="celebrations-heading">Your celebrations</h2></div>{previewButton("events", "View events")}</div>{eventOverview ? <EventsOverview count={eventOverview.count} events={eventOverview.upcoming} /> : <><p className={styles.muted}>A few moments to look forward to.</p><div className={styles.eventList}>{[
              { name: "Mehendi & a little magic", time: "4:00 PM", venue: "The garden courtyard", attire: "Florals & festive colours", tone: "gold" },
              { name: "An evening of sangeet", time: "7:00 PM", venue: "The celebration hall", attire: "Dress to dance", tone: "wine" },
              { name: "The wedding ceremony", time: "10:00 AM", venue: "The main mandap", attire: "Traditional elegance", tone: "sage" },
            ].map((event, index) => <article className={styles.event} key={event.name}><span className={`${styles.eventDay} ${styles[event.tone as "gold" | "wine" | "sage"]}`}><small>EVENT</small><strong>0{index + 1}</strong></span><div><h3>{event.name}</h3><p>{event.time} · {event.venue}</p><span className={styles.attire}>{event.attire}</span></div><button type="button" className={styles.iconButton} aria-label={`Preview ${event.name}`} onClick={() => openFeature("events")}><Icon name="arrow" /></button></article>)}</div>{previewButton("events", "+ Plan a celebration", styles.outlineButton)}</>}</section>
            <section className={styles.card} aria-labelledby="tasks-heading"><div className={styles.cardHead}><div><span className={styles.sampleBadge}>Sample tasks</span><h2 id="tasks-heading">A little closer to “I do”</h2></div>{previewButton("tasks", "View tasks")}</div><p className={styles.muted}>The little things that make the day yours.</p>{[
              { title: "Finalise the wedding invitations", person: "Sample assignee · Kavitha", status: "In progress" },
              { title: "Confirm the ceremony flowers", person: "Sample assignee · Rajesh", status: "To do" },
              { title: "Choose the sangeet playlist", person: "Sample assignee · Family", status: "To do" },
            ].map(task => <div className={styles.task} key={task.title}><span className={styles.taskCircle} aria-hidden="true" /><div><h3>{task.title}</h3><p>{task.person}</p></div><span className={styles.taskStatus}>{task.status}</span></div>)}{previewButton("tasks", "+ Plan a task", styles.outlineButton)}</section>
          </div>
          <div className={styles.sideColumn}>
            <section className={styles.card} aria-labelledby="rsvp-heading"><span className={styles.sampleBadge}>{rsvpOverview ? "Saved RSVPs" : "Sample RSVPs"}</span><h2 id="rsvp-heading">Who’s celebrating?</h2><p className={styles.muted}>{rsvpOverview ? `${rsvpOverview.respondedGuestCount} of ${rsvpOverview.guestCount} guest groups have responded.` : "86 of 120 guest groups have responded."}</p><div className={styles.rsvp}><div className={styles.ring} style={rsvpOverview ? { background: rsvpOverview.guestCount ? `conic-gradient(#742c40 0 ${rsvpOverview.attending/rsvpOverview.guestCount*100}%, #b88b79 0 ${(rsvpOverview.attending+rsvpOverview.notAttending)/rsvpOverview.guestCount*100}%, #e7dfd6 0 100%)` : "#e7dfd6" } : undefined} role="img" aria-label={rsvpOverview ? `${rsvpOverview.attending} attending groups, ${rsvpOverview.notAttending} not attending, ${rsvpOverview.pending} pending` : "Sample RSVPs: 72 attending groups, 14 not attending, and 34 pending"}><div><strong>{rsvpOverview?.respondedGuestCount ?? 86}</strong><span>responses</span></div></div><div className={styles.legend}><p><i className={styles.attending} />Attending<strong>{rsvpOverview?.attending ?? 72}</strong></p><p><i className={styles.declined} />Not attending<strong>{rsvpOverview?.notAttending ?? 14}</strong></p><p><i className={styles.pending} />Pending<strong>{rsvpOverview?.pending ?? 34}</strong></p></div></div>{rsvpOverview && <p className={styles.muted}>Expected attendees: <strong>{rsvpOverview.expectedAttendees}</strong></p>}{previewButton("invitations", "Explore invitations & RSVP")}</section>
            <section className={styles.card} aria-labelledby="expenses-heading"><span className={styles.sampleBadge}>Sample expenses</span><h2 id="expenses-heading">Wedding expenses</h2><p className={styles.expenseTotal}>₹12,45,000<small>Total sample expenses</small></p>{[["Venue", "₹6,50,000"], ["Decorations", "₹2,80,000"], ["Photography", "₹1,75,000"], ["Catering", "₹90,000"], ["Entertainment", "₹50,000"]].map(([label, amount]) => <div className={styles.expense} key={label}><span>{label}</span><strong>{amount}</strong></div>)}{previewButton("expenses", "Explore expenses")}</section>
            <section className={`${styles.card} ${styles.sharing}`} aria-labelledby="sharing-heading"><Icon name="heart" size={25} /><span className={styles.sampleBadge}>Future features</span><h2 id="sharing-heading">A celebration worth sharing</h2><p>Give your story a home, and keep your memories close.</p><div>{(["website", "photos", "qr", "livestream"] as const).map(key => <button type="button" className={styles.shareButton} key={key} onClick={() => openFeature(key)}><Icon name={features[key].icon} /><span>{features[key].label}</span><small>Soon</small><Icon name="arrow" size={14} /></button>)}</div></section>
          </div>
        </div>
        <footer className={styles.footer}><span>KalyanaPura</span><p>A shared space for your celebration. <Link href="/">Back to homepage →</Link></p></footer>
        </>}
      </main>
    </div>
    <dialog ref={drawer} className={styles.drawer} aria-label="Workspace navigation"><button type="button" className={styles.closeButton} aria-label="Close workspace navigation" autoFocus onClick={() => drawer.current?.close()}><Icon name="close" /></button>{navigation}</dialog>
    <dialog ref={panel} className={styles.featurePanel} aria-labelledby="preview-feature-title"><button type="button" className={styles.closeButton} aria-label="Close feature preview" autoFocus onClick={() => panel.current?.close()}><Icon name="close" /></button><span className={styles.featureIcon}><Icon name={features[feature].icon} size={30} /></span><p className={styles.eyebrow}>Something lovely is on its way</p><h2 id="preview-feature-title">{features[feature].label}</h2><span className={styles.previewBadge}>Coming soon</span><p>{features[feature].description}</p><p className={styles.muted}>This is a design preview. Nothing is created, changed, or sent from this panel.</p><button type="button" className={styles.primaryButton} onClick={() => panel.current?.close()}>Back to workspace</button></dialog>
  </div>;
}
