import Image from "next/image";
import Link from "next/link";
import styles from "./wedding-preview.module.css";

export type WeddingPreviewDetails = { brideName: string; groomName: string; weddingDate: string; location: string; title: string };
export const sampleWedding: WeddingPreviewDetails = { brideName: "Kavitha", groomName: "Rajesh", weddingDate: "2027-02-14", location: "Kozhikode, Kerala", title: "Together begins here" };
export function formatWeddingDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
const futureSections = ["Events", "Tasks", "Guests", "Expenses", "Vendors", "Wedding website", "Photos", "Wedding members"];
const modules = [
  { title: "Your celebrations", description: "Bring every ceremony into one shared timeline.", category: "Events & itineraries" },
  { title: "A little help from everyone", description: "Make room for family, shared tasks, and thoughtful planning.", category: "Tasks & wedding members" },
  { title: "Everyone who matters", description: "Keep guest details, invitations, and RSVPs together.", category: "Guests & invitations" },
  { title: "The details, beautifully kept", description: "Organise expenses, vendors, and wedding memories.", category: "Expenses, vendors & photos" },
];
export function DashboardPreview({ details = sampleWedding, onBack }: { details?: WeddingPreviewDetails; onBack?: () => void }) {
  const names = `${details.groomName} & ${details.brideName}`;
  return <div className={styles.workspace}>
    <a href="#wedding-dashboard" className={styles.skipLink}>Skip to dashboard</a>
    <aside className={styles.sidebar} aria-label="Preview workspace">
      <Link href="/" className={styles.brand}><Image src="/images/homepage/wordmark.png" alt="KalyanaPura home" width={260} height={60} sizes="174px" /></Link>
      <div className={styles.identity}><h2>{names}</h2><p>{details.location}</p><span>{formatWeddingDay(details.weddingDate)}</span><small>Preview details · Not saved</small></div>
      <nav aria-label="Wedding preview navigation"><Link href="/dashboard" aria-current="page" className={styles.activeNav}>▦ <span>Dashboard</span></Link>{futureSections.map(label => <button key={label} type="button" disabled><span>{label}</span><small>Later</small></button>)}</nav>
      <div className={styles.sidebarFoot}><span className={styles.avatar} aria-hidden="true">{details.groomName.charAt(0)}{details.brideName.charAt(0)}</span><div><strong>Organiser view</strong><small>Design preview</small></div></div>
    </aside>
    <div className={styles.workspaceBody}>
      <header className={styles.workspaceHeader}><span>Wedding workspace / Dashboard</span><Link href="/account">My account →</Link></header>
      <main id="wedding-dashboard" className={styles.dashboard}>
        <div className={styles.previewNotice} role="note"><strong>Design preview</strong><span>Fictional wedding details. No wedding has been created or saved.</span></div>
        <div className={styles.dashboardHeading}><div><p className={styles.eyebrow}>A new chapter, together</p><h1>Your wedding workspace.</h1><p>A calm place for everything that comes next.</p></div>{onBack ? <button className={styles.secondaryButton} type="button" onClick={onBack}>← Edit preview details</button> : <Link href="/create-wedding" className={styles.secondaryButton}>Preview wedding setup →</Link>}</div>
        <section className={styles.weddingBanner} aria-label="Wedding details preview"><div><span className={styles.eyebrow}>Your celebration</span><h2>{names}</h2>{details.title && <p className={styles.weddingTitle}>{details.title}</p>}<div className={styles.bannerDetails}><span>{formatWeddingDay(details.weddingDate)}</span><span>{details.location}</span></div><small>India · Asia/Kolkata · INR</small></div><Image src="/images/homepage/ceremony.png" alt="Illustrative decorated wedding venue" width={720} height={400} sizes="(max-width: 760px) 85vw, 340px" /></section>
        <div className={styles.metricGrid}>{["Events", "Tasks completed", "Guests", "Recorded expenses"].map(label => <div className={styles.metric} key={label}><span>{label}</span><strong aria-label="Not available">—</strong><small>Available in a future feature</small></div>)}</div>
        <section className={styles.emptyState}><span className={styles.crest} aria-hidden="true">✧</span><div><p className={styles.eyebrow}>Make room for the celebration</p><h2>Your story is just getting started.</h2><p>This is how a new workspace will look. Planning tools will be added one feature at a time.</p></div><span className={styles.badge}>Workspace preview</span></section>
        <div className={styles.moduleGrid}>{modules.map((item, index) => <section className={styles.moduleCard} key={item.title}><div className={styles.moduleTop}><span>0{index + 1}</span><small>Coming later</small></div><p className={styles.eyebrow}>{item.category}</p><h2>{item.title}</h2><p>{item.description}</p></section>)}</div>
        <footer className={styles.dashboardFooter}>Your wedding, beautifully organised. <Link href="/">Back to homepage</Link></footer>
      </main>
    </div>
  </div>;
}
