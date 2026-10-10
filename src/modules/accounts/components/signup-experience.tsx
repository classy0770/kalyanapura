import Image from "next/image";
import localFont from "next/font/local";
import { AuthForm } from "./auth-form";
import styles from "./signup.module.css";

const displayFont = localFont({
  src: [
    { path: "../../../../public/fonts/cormorant-400.ttf", weight: "400", style: "normal" },
    { path: "../../../../public/fonts/cormorant-italic-400.ttf", weight: "400", style: "italic" },
  ], variable: "--font-signup-display", display: "swap",
});
const bodyFont = localFont({
  src: [
    { path: "../../../../public/fonts/jakarta-400.ttf", weight: "400", style: "normal" },
    { path: "../../../../public/fonts/jakarta-600.ttf", weight: "600", style: "normal" },
  ], variable: "--font-signup-body", display: "swap",
});

export function SignupExperience() {
  return <div className={`${styles.experience} ${displayFont.variable} ${bodyFont.variable}`}>
    <aside className={styles.story} aria-label="A new chapter with KalyanaPura">
      <div className={styles.storyCopy}>
        <span className={styles.eyebrow}>For the moments that matter</span>
        <h2>A beautiful beginning.<br /><em>A celebration of you.</em></h2>
        <p>Behind every wedding is a story worth celebrating. Let yours begin here.</p>
      </div>
      <figure className={styles.photograph}>
        <Image src="/images/homepage/ritual.png" alt="Illustrative wedding ritual, with hands holding a coconut surrounded by flowers" fill sizes="(max-width: 760px) 90vw, 540px" loading="eager" />
        <figcaption>Traditions to cherish. Memories to keep.<span>Illustrative wedding imagery</span></figcaption>
      </figure>
      <div className={styles.storyFooter}><span aria-hidden="true">✧</span> Your wedding, beautifully organised.</div>
    </aside>
    <div className={styles.formPanel}><AuthForm mode="signup" /></div>
  </div>;
}
