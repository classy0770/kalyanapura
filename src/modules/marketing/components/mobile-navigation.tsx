"use client";

import { useState } from "react";
import styles from "./homepage.module.css";

export function MobileNavigation({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.mobileNavigation}>
      <button type="button" aria-expanded={open} aria-controls="homepage-mobile-menu" onClick={() => setOpen(!open)}>
        {open ? "Close" : "Menu"} <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      {open && <nav id="homepage-mobile-menu" aria-label="Mobile homepage navigation">
        {links.map(({ href, label }) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>}
    </div>
  );
}
