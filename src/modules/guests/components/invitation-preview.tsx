"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./invitation-preview.module.css";

type Answer = "attending" | "not_attending";
type Mode = "invited" | "no-events" | "unavailable";
const celebrations = [
  { name: "Wedding ceremony", date: "Sunday, 14 February 2027", time: "10:00 AM – 1:00 PM", venue: "Lotus Pavilion", address: "Marine Drive, Kochi, Kerala", dress: "Traditional Indian attire", description: "Join us for our wedding ceremony, followed by a warm Kerala sadhya with family and friends.", image: "/images/homepage/ceremony.png" },
  { name: "Evening reception", date: "Sunday, 14 February 2027", time: "6:00 PM onwards", venue: "Bolgatty Palace", address: "Bolgatty Island, Kochi, Kerala", dress: "Festive evening attire", description: "An evening of stories, laughter and dinner as we begin our next chapter together.", image: "/images/homepage/reception.png" },
];

/** Fictional presentation only: no guest grants, persistence or invitation sends. */
export function InvitationPreview() {
  const [mode,setMode] = useState<Mode>("invited");
  const [answer,setAnswer] = useState<Answer | null>(null);
  const [partySize,setPartySize] = useState(2);
  const [response,setResponse] = useState<{ status: Answer; partySize: number } | null>(null);
  function reset(next: Mode = "invited") { setMode(next); setAnswer(null); setPartySize(2); setResponse(null); }
  return <div className={styles.page}>
    <a className={styles.skip} href="#invitation-content">Skip to invitation</a>
    <header className={styles.header}><Link className={styles.brand} href="/">KalyanaPura<span>A celebration of togetherness</span></Link>{mode !== "unavailable" && <nav aria-label="Invitation sections"><a href="#celebrations">Celebrations</a><a href="#rsvp">RSVP</a></nav>}<span className={styles.badge}>Personal invitation · Sample</span></header>
    <aside className={styles.preview} aria-label="Design preview controls"><div><strong>Interactive design preview</strong><p>Names, venues and responses are fictional. Nothing is saved or sent.</p></div><label>Preview scenario<select value={mode} onChange={event => reset(event.target.value as Mode)}><option value="invited">Personal invitation</option><option value="no-events">No active events</option><option value="unavailable">Invitation unavailable</option></select></label><button onClick={() => reset()}>Reset preview</button></aside>
    <main id="invitation-content">
      {mode === "unavailable" ? <section className={styles.unavailable}><span className={styles.seal} aria-hidden="true">✉</span><p className={styles.eyebrow}>Invitation unavailable</p><h1>Let’s help you find your invitation.</h1><p>This sample shows a link that has been disabled, replaced or is no longer available. Please ask the couple or their family for a current invitation link.</p><button className={styles.primary} onClick={() => reset()}>Return to sample invitation</button></section> : <>
        <section className={styles.hero} aria-labelledby="couple-heading"><div className={styles.seal} aria-hidden="true">A<span>&</span>A</div><p className={styles.eyebrow}>Together with our families</p><p className={styles.salutation}>Dear Suresh & Lakshmi,</p><h1 id="couple-heading">Anjali <em>&</em> Arjun</h1><p className={styles.welcome}>Some moments are made more beautiful by the people we share them with. We would love to celebrate ours with you.</p><p className={styles.date}>Sunday, 14 February 2027 <span aria-hidden="true">·</span> Kochi, Kerala</p><a className={styles.primary} href="#rsvp">Let us know you’re coming <span aria-hidden="true">↗</span></a><div className={styles.cover}><Image src="/images/homepage/ceremony.png" alt="Fictional wedding preview: a warmly lit mandap decorated with flowers" fill priority sizes="(max-width: 700px) 100vw, 1050px" /><span>A day to remember. A joy to share.</span></div></section>
        <div className={styles.content}>
          <section id="celebrations" className={styles.events} aria-labelledby="celebrations-heading"><p className={styles.eyebrow}>Come celebrate with us</p><h2 id="celebrations-heading">Your celebrations</h2><p>These are the events on your personal invitation. One RSVP covers your whole invitation.</p>
            {mode === "no-events" ? <div className={styles.empty}><h3>No active invited events</h3><p>There are currently no active events on this sample invitation. Please check with the family for details. New attendance responses are unavailable; you can still choose not attending.</p></div> : celebrations.map((event,index) => <article className={styles.event} key={event.name}><div className={styles.eventImage}><Image src={event.image} alt="" fill sizes="(max-width: 700px) 90vw, 560px" /><span>0{index+1} / Celebration</span></div><div className={styles.eventBody}><p className={styles.eyebrow}>{event.date}</p><h3>{event.name}</h3><p className={styles.time}>{event.time} <span>India Standard Time</span></p><p>{event.description}</p><div className={styles.venue}><strong>{event.venue}</strong><span>{event.address}</span><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue+", "+event.address)}`} target="_blank" rel="noopener noreferrer">View directions <span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens Google Maps in a new tab)</span></a></div><p className={styles.dress}>Dress code <strong>{event.dress}</strong></p></div></article>)}
            <p className={styles.note}>The details above are illustrative. Please follow the information on your real invitation when making travel plans.</p>
          </section>
          <section id="rsvp" className={styles.rsvp} aria-labelledby="rsvp-heading"><p className={styles.eyebrow}>A place for you</p><h2 id="rsvp-heading">Will you join us?</h2><p>Your invitation is for <strong>Suresh & Lakshmi</strong>, with room for up to <strong>4 people</strong>, including the named guest.</p>
            {response ? <div className={styles.confirmation} role="status"><span className={styles.check} aria-hidden="true">✓</span><h3>{response.status === "attending" ? "We can’t wait to celebrate!" : "You’ll be with us in spirit."}</h3><p>{response.status === "attending" ? `Preview response: attending with ${response.partySize} ${response.partySize === 1 ? "person" : "people"}.` : "Preview response: not attending."}</p><p className={styles.disclaimer}>This is a preview confirmation. Your response has not been saved or sent.</p><button className={styles.secondary} onClick={() => setResponse(null)}>Change preview response</button></div> : <form onSubmit={event => { event.preventDefault(); if (!answer || (answer === "attending" && mode === "no-events")) return; setResponse({ status: answer,partySize: answer === "attending" ? partySize : 0 }); }}>
              <fieldset className={styles.choices}><legend>Your RSVP</legend><label className={`${styles.choice} ${answer === "attending" ? styles.active : ""}`}><input type="radio" name="attendance" value="attending" checked={answer === "attending"} disabled={mode === "no-events"} onChange={() => setAnswer("attending")} /><span><strong>Joyfully accept</strong><small>We’ll be there to celebrate.</small></span></label><label className={`${styles.choice} ${answer === "not_attending" ? styles.active : ""}`}><input type="radio" name="attendance" value="not_attending" checked={answer === "not_attending"} onChange={() => setAnswer("not_attending")} /><span><strong>Regretfully decline</strong><small>Sending our love and best wishes.</small></span></label></fieldset>
              {answer === "attending" && <label className={styles.party}>How many people will attend?<select value={partySize} onChange={event => setPartySize(Number(event.target.value))}>{[1,2,3,4].map(size => <option key={size} value={size}>{size} {size === 1 ? "person" : "people"}</option>)}</select><small>Count everyone in your group, including yourself.</small></label>}
              {mode === "no-events" && <p className={styles.disclaimer}>Attendance is unavailable while no active invited events remain.</p>}
              <button className={styles.primary} type="submit" disabled={!answer}>Preview response <span aria-hidden="true">→</span></button><p className={styles.disclaimer}>Try the form. This preview does not submit an RSVP.</p>
            </form>}
            <div className={styles.personal}><span aria-hidden="true">✉</span><div><strong>Made just for your invitation</strong><p>No account needed. Your real invitation will show only your invited celebrations.</p></div></div>
          </section>
        </div>
        <div className={styles.closing}><p>With love, and a little anticipation</p><h2>Anjali & Arjun</h2><span>We’re so glad you’re part of our story.</span></div>
      </>}
    </main>
    <footer className={styles.footer}>Made with <Link href="/">KalyanaPura</Link><span>Fictional invitation · Design preview only</span></footer>
  </div>;
}
