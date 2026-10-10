"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import styles from "./wedding-website-preview.module.css";

const themes = [
  { id: "classic", name: "Classic Indian", description: "Warm, refined, and rooted in celebration.", tags: ["Warm neutrals", "Wine accents", "Editorial serif"] },
  { id: "minimal", name: "Minimal Elegant", description: "Quiet details. Timeless simplicity.", tags: ["Airy whitespace", "Fine dividers", "Centered balance"] },
  { id: "modern", name: "Modern Celebration", description: "Confident typography. A fresh layout.", tags: ["Bold sans", "Split composition", "Block accents"] },
] as const;

const celebrations = [
  { title: "Wedding Ceremony", subtitle: "Muhurtham", date: "14 February 2027", time: "9:30 AM", venue: "Kadavu Resort, Kozhikode" },
  { title: "Reception", subtitle: "Celebration", date: "15 February 2027", time: "6:30 PM", venue: "Grand Ballroom, Kozhikode" },
] as const;

export function WeddingWebsitePreview() {
  const [selected, setSelected] = useState(1);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % themes.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + themes.length - 1) % themes.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = themes.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return <div className={styles.showcase}>
    <p className={styles.introduction}><span>Same wedding. Three ways to present it.</span></p>
    <div className={styles.themes} role="tablist" aria-label="Wedding website themes">
      {themes.map((theme, index) => <button key={theme.id} type="button" role="tab"
        id={`theme-${theme.id}`} aria-selected={selected === index} aria-controls={`preview-${theme.id}`}
        tabIndex={selected === index ? 0 : -1} ref={(element) => { tabs.current[index] = element; }}
        onKeyDown={(event) => navigate(event, index)} onClick={() => setSelected(index)}
        className={styles.theme}>
        <span className={styles.themeTitle}>{theme.name}<span className={styles.indicator} aria-hidden="true" /></span>
        <span className={styles.description}>{theme.description}</span>
        <span className={styles.tags}>{theme.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
      </button>)}
    </div>
    <div className={styles.browser}>
      <div className={styles.browserBar}><span className={styles.dots} aria-hidden="true">● ● ●</span><span className={styles.address}>Wedding website · Rajesh &amp; Kavitha</span><span className={styles.sample}>Sample website preview</span></div>
      {themes.map((theme, index) => <div key={theme.id} id={`preview-${theme.id}`} role="tabpanel"
        aria-labelledby={`theme-${theme.id}`} tabIndex={0} hidden={selected !== index}
        className={`${styles.preview} ${styles[theme.id]}`}>
        <div className={styles.sheet}>
          <div className={styles.welcome}>
            <div className={styles.identity}>
              <span className={styles.kicker}>{theme.id === "classic" ? "शुभ विवाह · Wedding celebration" : theme.id === "minimal" ? "Celebrating the marriage of" : "Modern wedding"}</span>
              <h3>Rajesh <span>{theme.id === "modern" ? "+" : "&"}</span> Kavitha</h3>
              <p className={styles.date}>14 February 2027 <span>·</span> Kozhikode, Kerala</p>
            </div>
            <div className={styles.note}>{theme.id === "modern" && <span className={styles.kicker}>A note to our loved ones</span>}<p>We would love for you<br />to celebrate with us.</p></div>
          </div>
          <div className={styles.scheduleHeading}><span>{theme.id === "classic" ? "Ceremonial schedule" : "The celebrations"}</span><span>All guests welcome</span></div>
          <div className={styles.schedule}>{celebrations.map((event, eventIndex) => <div className={styles.event} key={event.title}>
            <span className={styles.eventNumber}>0{eventIndex + 1} <span>{event.subtitle}</span></span>
            <h4>{event.title}</h4><p>{event.date} · {event.time}</p><p className={styles.venue}>{event.venue}</p>
          </div>)}</div>
          <div className={styles.previewFooter}><span>{theme.id === "classic" ? "Dress guideline · Traditional & festive formal" : "With love, from our families to yours"}</span><span>Kozhikode, Kerala</span></div>
        </div>
      </div>)}
      <div className={styles.browserFooter}><p>Choose your theme when setting up your wedding website.</p><span>Website creation &amp; publishing coming later <span aria-hidden="true">→</span></span></div>
    </div>
    <p className={styles.caption}>Interactive theme demo · Fictional wedding details · No live website, RSVP, or publishing</p>
  </div>;
}
