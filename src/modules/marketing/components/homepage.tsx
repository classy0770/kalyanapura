import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { MobileNavigation } from "./mobile-navigation";
import { AccountNavigation } from "./account-navigation";
import { WeddingWebsitePreview } from "./wedding-website-preview";
import styles from "./homepage.module.css";

const displayFont = localFont({
  src: [
    { path: "../../../../public/fonts/cormorant-400.ttf", weight: "400", style: "normal" },
    { path: "../../../../public/fonts/cormorant-600.ttf", weight: "600", style: "normal" },
    { path: "../../../../public/fonts/cormorant-italic-400.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-home-display", display: "swap",
});
const bodyFont = localFont({
  src: [
    { path: "../../../../public/fonts/jakarta-400.ttf", weight: "400", style: "normal" },
    { path: "../../../../public/fonts/jakarta-500.ttf", weight: "500", style: "normal" },
    { path: "../../../../public/fonts/jakarta-600.ttf", weight: "600", style: "normal" },
    { path: "../../../../public/fonts/jakarta-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-home-body", display: "swap",
});

const navigation = [
  { href: "#features", label: "Features" },
  { href: "#family-planning", label: "Family planning" },
  { href: "#invitations", label: "Invitations & RSVPs" },
  { href: "#wedding-website", label: "Wedding website" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];
const events = [
  { name: "Haldi Ceremony", date: "13 Feb 2027", venue: "Tharavadu Home", tag: "Family" },
  { name: "Wedding (Muhurtham)", date: "14 Feb 2027", venue: "Kadavu Resort", tag: "Primary" },
  { name: "Wedding Reception", date: "15 Feb 2027", venue: "Grand Ballroom", tag: "All guests" },
];
const tasks = [
  { title: "Confirm catering menu", person: "Anjali (Cousin)", status: "In progress" },
  { title: "Share reception invitations", person: "Arun (Brother)", status: "To do" },
  { title: "Finalise ceremony schedule", person: "Meera (Sister)", status: "Completed" },
];

function Wordmark({ footer = false }: { footer?: boolean }) {
  return <Link href="/" aria-label="KalyanaPura home" className={footer ? styles.footerBrand : styles.brand}>
    <Image src="/images/homepage/wordmark.png" alt="KalyanaPura" width={260} height={60} sizes="200px" />
  </Link>;
}

function Benefits({ items }: { items: ReadonlyArray<{ title: string; description: string }> }) {
  return <ul className={styles.benefits}>{items.map(({ title, description }) => <li key={title}>
    <span className={styles.check} aria-hidden="true">✓</span>
    <div><h3>{title}</h3><p>{description}</p></div>
  </li>)}</ul>;
}

function TaskRows() {
  return <div className={styles.taskRows}>{tasks.map((task) => <div className={styles.taskRow} key={task.title}>
    <div><strong className={task.status === "Completed" ? styles.completed : undefined}>{task.title}</strong>
      <small>Assigned to <b>{task.person}</b></small></div>
    <span className={`${styles.status} ${task.status === "Completed" ? styles.success : task.status === "In progress" ? styles.pending : ""}`}>{task.status}</span>
  </div>)}</div>;
}

function WorkspacePreview() {
  return <figure className={styles.workspaceFigure} aria-label="Illustrative wedding workspace with fictional sample data">
    <div className={styles.workspace}>
      <div className={styles.windowBar}><span className={styles.windowDots} aria-hidden="true">● ● ●</span><span>Wedding workspace</span><span className={styles.sample}>Sample data</span></div>
      <div className={styles.workspaceBody}>
        <div className={styles.weddingIdentity}><div><span className={styles.eyebrow}>Wedding workspace</span><h2>Rajesh &amp; Kavitha</h2><p>14 February 2027 · Kozhikode, Kerala</p></div><span className={styles.chip}>3 events</span></div>
        <div className={styles.metrics}>
          <div><span>Tasks progress</span><strong>12 <small>of 24 done</small></strong><div className={styles.progress}><span /></div></div>
          <div><span>Guest invitations</span><strong>186 <small>shared</small></strong><small>Links &amp; email</small></div>
          <div><span>RSVP responses</span><strong>132 <small>received</small></strong><small>Illustrative guest list</small></div>
          <div><span>Recorded expenses</span><strong>₹4,85,000</strong><small>Agreed costs recorded</small></div>
        </div>
        <div className={styles.workspaceColumns}>
          <div><h3 className={styles.smallHeading}>Upcoming events</h3><div className={styles.eventRows}>{events.map((event, index) => <div key={event.name} className={index === 1 ? styles.primaryEvent : ""}>
            <strong>{event.name}</strong><small>{event.date} · {event.venue}</small><span>{event.tag}</span>
          </div>)}</div></div>
          <div><h3 className={styles.smallHeading}>Family tasks</h3><TaskRows /></div>
        </div>
      </div>
    </div>
    <div className={styles.guestOverlay}><div className={styles.overlayHeader}><span>Guest mobile view</span><small>Sample invitation</small></div><h3>Asha Menon’s Invitation</h3><p>Wedding &amp; Reception</p><div><span>Attending · 3 people</span><span className={styles.check} aria-hidden="true">✓</span></div></div>
    <figcaption>Illustrative preview · Fictional wedding, not a live workspace</figcaption>
  </figure>;
}

const faqs = [
  { question: "What can I use right now?", answer: "This homepage previews the planned KalyanaPura experience. Wedding details and totals shown here are fictional examples. Account signup, verification, login, and password reset are implemented and require configured account services. Wedding planning, invitations, and photo sharing are coming in later releases. The dashboard remains a public preview." },
  { question: "Will my guests need an account?", answer: "No. The planned guest experience uses a personal invitation link for viewing invited events and responding. Gallery access will use a valid invitation or a shared gallery link. Guest access will never grant family organiser permissions." },
  { question: "Can my family help plan the wedding?", answer: "Yes. The planned workspace supports Admin and Manager members, with tasks assigned to family organisers. Only Admins will manage memberships and delete gallery photos." },
  { question: "Will the photo gallery be public?", answer: "The private gallery will be separate from the public wedding website. Gallery access will require a valid link or member access; the website will show only content selected for publication." },
  { question: "Can guests change their RSVP?", answer: "Guests will be able to revisit an active invitation link and update their overall attendance response. Their party size, including the named guest, must stay within the organiser’s limit." },
  { question: "Can guests upload wedding photos?", answer: "Guest uploads are planned when organisers enable them. Guests will use a valid gallery link or QR code without creating an account. Only wedding Admins will delete photos." },
  { question: "Can I book or pay vendors through KalyanaPura?", answer: "No. KalyanaPura is designed to organise vendor contacts and recorded expenses, with discovery opening Google Maps externally. Bookings, contracts, and payments happen directly with vendors." },
];

export function Homepage() {
  return <div className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
    <a className={styles.skipLink} href="#main-content">Skip to content</a>
    <div className={styles.announcement}><span aria-hidden="true">●</span> Homepage preview · Planning tools are coming next</div>
    <header className={styles.header}><div className={styles.headerInner}>
      <Wordmark />
      <nav className={styles.desktopNavigation} aria-label="Homepage navigation">{navigation.map(({ href, label }) => <a key={href} href={href}>{label}</a>)}</nav>
      <div className={styles.headerActions}><AccountNavigation /><Link className={styles.button} href="/dashboard">Explore workspace</Link></div>
      <MobileNavigation links={navigation} />
    </div></header>
    <main id="main-content">
      <section className={styles.hero}><div className={`${styles.container} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}><span className={styles.pill}><span aria-hidden="true">●</span> Made for Indian weddings</span>
          <h1>Your wedding,<br /><em>beautifully organised.</em></h1>
          <p className={styles.lead}>Plan events, bring your family together, manage invitations, and collect wedding memories—all in one shared workspace.</p>
          <div className={styles.actions}><Link className={styles.button} href="/dashboard">Explore the wedding preview <span aria-hidden="true">→</span></Link><a className={styles.secondaryButton} href="#how-it-works">See how it works</a></div>
          <div className={styles.reassurance}><span className={styles.check} aria-hidden="true">✓</span><p><strong>Your family plans together.</strong><br />Your guests join through simple links.</p></div>
        </div><WorkspacePreview />
      </div></section>

      <section id="features" className={`${styles.section} ${styles.tinted}`}><div className={styles.container}>
        <div className={styles.sectionIntro}><span className={styles.eyebrow}>The wedding coordination challenge</span><h2>Bring the moving pieces together.</h2><p>Guest lists in spreadsheets. Tasks buried in chats. Updates passed from one family member to another. Give everyone one place to stay organised.</p></div>
        <div className={styles.threeColumns}>{[
          ["“Who’s handling this?”", "Important tasks get lost across family chats. Without a clear owner, the small details get forgotten or duplicated.", "Clear family task assignments & due dates"],
          ["“Who has confirmed?”", "Separate notes and spreadsheets make it hard to know who is coming. Keep guest responses together, where everyone can find them.", "One guest list with personal RSVP links"],
          ["“Where did we save that?”", "Vendor contacts, agreed costs, and event schedules shouldn’t be scattered across messages and personal notes.", "Contacts, recorded costs & schedules in one place"],
        ].map(([title, description, outcome], index) => <article className={styles.problemCard} key={title}><span className={styles.number}>0{index + 1}</span><h3>{title}</h3><p>{description}</p><div><span aria-hidden="true">→</span> {outcome}</div></article>)}</div>
      </div></section>

      <section id="family-planning" className={styles.section}><div className={`${styles.container} ${styles.split}`}>
        <div><span className={styles.eyebrow}>Collaborative organisation</span><h2>Everyone knows what needs to happen.</h2><p className={styles.lead}>Plan each event, assign responsibilities, and keep the details in one shared wedding workspace.</p>
          <Benefits items={[
            { title: "Multi-event celebrations", description: "Haldi, Sangeet, Muhurtham, and Reception—each with its own schedule, venue, and details." },
            { title: "One owner per task", description: "Give each responsibility to a family member, with a clear due date and progress status." },
            { title: "A personal “My Tasks” view", description: "Help each organiser see what needs their attention, without searching through a family chat." },
          ]} />
          <aside className={styles.noteCard}><span className={styles.eyebrow}>Vendors &amp; expenses</span><p>Keep vendor contacts and agreed costs alongside the events they belong to. Record expenses without complicated budgeting formulas.</p><div><span>Illustrative recorded total</span><strong>₹4,85,000</strong></div></aside>
        </div>
        <div className={styles.previewStack}>
          <figure className={styles.card}><div className={styles.memberHeader}><span className={styles.avatar}>A</span><div><strong>Anjali’s workspace view</strong><small>Family organiser · Sample data</small></div><span className={styles.chip}>Manager</span></div><div className={styles.previewTabs}><span>My tasks</span><span>All tasks</span><span>Events</span></div><div className={styles.taskSummary}><h3>What’s on your list?</h3><span>3 tasks</span></div><TaskRows /><figcaption>Illustrative view · Tasks cannot be changed here</figcaption></figure>
          <figure className={styles.card}><div className={styles.taskSummary}><h3>Contacts &amp; agreed costs</h3><span className={styles.sample}>Sample data</span></div><div className={styles.vendorRow}><span className={styles.vendorIcon} aria-hidden="true">✧</span><div><strong>Malabar Catering</strong><small>Wedding · Catering</small></div><strong>₹2,40,000</strong></div><div className={styles.vendorRow}><span className={styles.vendorIcon} aria-hidden="true">♧</span><div><strong>Bloom &amp; Co.</strong><small>Reception · Decoration</small></div><strong>₹85,000</strong></div><figcaption>Vendor discovery will open Google Maps externally.</figcaption></figure>
        </div>
      </div></section>

      <section id="invitations" className={`${styles.section} ${styles.tinted}`}><div className={`${styles.container} ${styles.invitationGrid}`}>
        <figure className={styles.invitationFigure}><div className={styles.phone}>
          <div className={styles.phoneBar}><span>Personal invitation</span><span className={styles.sample}>Sample</span></div>
          <div className={styles.phoneContent}><span className={styles.eyebrow}>You’re warmly invited</span><h3>Rajesh &amp; Kavitha</h3><p>14 February 2027 · Kozhikode</p><div className={styles.guestGreeting}><small>A personal invitation for</small><strong>Asha Menon &amp; family</strong></div>
            <h4>Your invited events</h4>{events.slice(1).map(event => <div className={styles.invitedEvent} key={event.name}><strong>{event.name}</strong><small>{event.date} · {event.venue}</small></div>)}
            <div className={styles.rsvp}><h4>Will you be joining us?</h4><div><span className={styles.selectedResponse}>✓ Attending</span><span>Not attending</span></div><p>Total people attending <strong>3</strong></p><small>Including you · Up to 4 people</small><div className={styles.responseNote}>Illustrative RSVP · No response is submitted</div></div>
          </div>
        </div><figcaption>Sample guest invitation · No account or form submission</figcaption></figure>
        <div><span className={styles.eyebrow}>Guest coordination</span><h2>A thoughtful invitation.<br />A simple response.</h2><p className={styles.lead}>Share a personal invitation with the events each guest is invited to. They can confirm attendance without creating an account.</p>
          <Benefits items={[
            { title: "Invite guests to selected events", description: "Not every guest attends every function. Each invitation shows the schedules relevant to that guest." },
            { title: "Share by email or WhatsApp", description: "Personal links and prepared WhatsApp messages make sharing simple. The organiser sends WhatsApp messages manually." },
            { title: "Keep responses in one guest list", description: "An overall attendance response and a clear party size help the family coordinate catering and seating." },
          ]} /><div className={styles.softNote}><strong>A simpler welcome:</strong> Guests will open a link, view their invitation, and respond from their phone.</div>
        </div>
      </div></section>

      <section id="wedding-website" className={styles.section}><div className={styles.container}>
        <div className={`${styles.sectionIntro} ${styles.centered}`}><span className={styles.eyebrow}>Your wedding website</span><h2>A beautiful home for<br />your wedding details.</h2><p>Choose a theme, add your wedding details, and share one place for your celebration.</p></div>
        <WeddingWebsitePreview />
        <div className={styles.twoColumns}>
          <article className={styles.memoryCard}><div className={styles.cardLabel}>Public wedding website <span className={styles.chip}>Planned feature</span></div><h3>A simple, elegant welcome for your guests</h3><p>Share the events you choose to publish, venue links, and a YouTube livestream for loved ones joining from afar.</p>
            <figure className={styles.websitePreview}><div><span className={styles.eyebrow}>Celebrating our wedding</span><h4>Rajesh &amp; Kavitha</h4><small>14 February 2027 · Kozhikode, Kerala</small></div><div className={styles.ceremonyImage}><Image src="/images/homepage/ceremony.png" alt="Illustrative decorated wedding ceremony venue" width={720} height={400} sizes="(max-width: 760px) 90vw, 500px" /><span>Wedding ceremony · Sample preview</span></div><figcaption>Illustrative website · No active livestream</figcaption></figure>
          </article>
          <article className={styles.memoryCard}><div className={styles.cardLabel}>Private photo sharing <span className={styles.chip}>Planned feature</span></div><h3>The moments everyone helped make</h3><p>A private, link-accessible gallery for guests and family. Guest uploads will be available when organisers enable them.</p>
            <figure className={styles.galleryPreview}><div className={styles.galleryHeading}><span className={styles.gallerySymbol} aria-hidden="true">▦</span><div><strong>Wedding Memories</strong><small>Private gallery · Illustrative preview</small></div><span className={styles.chip}>Link access</span></div><div className={styles.albumLabels}><span>All moments</span><span>Haldi</span><span>Muhurtham</span><span>Reception</span></div><div className={styles.photoGrid}>{["haldi", "ritual", "reception"].map((name) => <Image key={name} src={`/images/homepage/${name}.png`} alt={`Illustrative ${name} celebration photograph`} width={240} height={240} sizes="(max-width: 760px) 25vw, 140px" />)}<div className={styles.uploadPreview}><span aria-hidden="true">＋</span>Guest uploads<small>Coming later</small></div></div><figcaption>Sample imagery · No live gallery or upload</figcaption></figure>
          </article>
        </div>
      </div></section>

      <section id="how-it-works" className={`${styles.section} ${styles.tinted}`}><div className={styles.container}><div className={styles.sectionIntro}><span className={styles.eyebrow}>The planned journey</span><h2>Start with your wedding.<br />Build the plan together.</h2><p>A straightforward path from your first account to a celebration the whole family can help organise.</p></div><div className={styles.threeColumns}>{[
        ["Create your wedding workspace", "Sign up, verify your email, and add your couple names, wedding date, and location."],
        ["Bring your family into the plan", "Invite family organisers, add your events, and assign the responsibilities that need attention."],
        ["Welcome guests. Collect memories.", "Share invitations, coordinate responses, and give guests a private place to contribute photos."],
      ].map(([title, description], index) => <article className={styles.step} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>

      <section id="faq" className={styles.section}><div className={styles.faqContainer}><div className={`${styles.sectionIntro} ${styles.centered}`}><span className={styles.eyebrow}>A little clarity</span><h2>Thoughtful by design.<br />Simple for the family.</h2><p>A few things to know about the experience we’re building.</p></div><div className={styles.trustRow}><span>✓ Private wedding workspace</span><span>✓ Simple guest links</span><span>✓ Clear family responsibilities</span></div><div className={styles.faqs}>{faqs.map(({ question, answer }, index) => <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className={styles.finalCta}><div className={styles.container}><span className={styles.pill}><span aria-hidden="true">●</span> A calmer way to plan</span><h2>Make room for the celebration.</h2><p>Give your family one place to plan the wedding together.</p><div className={styles.actions}><Link href="/dashboard" className={styles.button}>Explore the workspace preview <span aria-hidden="true">→</span></Link><Link href="/signup" className={styles.secondaryButton}>Create an account</Link></div><small>Wedding planning previews · Account access requires service configuration</small></div></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><div className={styles.footerGrid}><div><Wordmark footer /><p>Your wedding, beautifully organised.<br />A shared space for Indian couples and their families.</p></div><nav aria-label="Footer product navigation"><h2>Discover</h2>{navigation.map(({ href, label }) => <a key={href} href={href}>{label}</a>)}</nav><nav aria-label="Preview navigation"><h2>Explore the preview</h2><Link href="/dashboard">Dashboard preview</Link><Link href="/login">Log in</Link><a href="#faq">What’s coming next</a></nav></div><div className={styles.copyright}><span>© 2026 KalyanaPura.</span><span>Built for the people who make the celebration.</span></div></div></footer>
  </div>;
}
