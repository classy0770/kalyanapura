"use client";
import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { weddingInputSchema } from "../schemas";
import type { ApiFailure, ApiSuccess } from "@/shared/http/api-contract";
import type { WeddingResource } from "../schemas";
import { DashboardPreview, sampleWedding, type WeddingPreviewDetails } from "./dashboard-preview";
import styles from "./wedding-preview.module.css";

const blank: WeddingPreviewDetails = { brideName: "", groomName: "", weddingDate: "", location: "", title: "" };
export function CreateWeddingPreview({ mode = "preview" }: { mode?: "preview" | "create" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(blank);
  const [preview, setPreview] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  async function showDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (mode === "create") {
      setError("");
      const parsed = weddingInputSchema.safeParse({ ...details, title: details.title.trim() || null });
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your wedding details."); return; }
      setBusy(true);
      try {
        const response = await fetch("/api/v1/weddings", { method: "POST", headers: { "Content-Type": "application/json", "X-KP-Request": "1" }, body: JSON.stringify(parsed.data) });
        const result = await response.json() as ApiSuccess<WeddingResource> | ApiFailure;
        if (response.ok || ("error" in result && result.error.code === "ALREADY_IN_WEDDING")) { router.replace("/dashboard"); router.refresh(); return; }
        if (response.status === 401) { router.replace("/login"); return; }
        if ("error" in result && result.error.code === "EMAIL_NOT_VERIFIED") { router.replace("/verify-email"); return; }
        setError("error" in result ? result.error.message : "We couldn’t save your wedding. Please try again.");
      } catch { setError("We couldn’t confirm whether your wedding was saved. Check your dashboard before trying again."); }
      finally { setBusy(false); }
      return;
    }
    setDetails(Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value.trim()])) as WeddingPreviewDetails);
    setPreview(true);
    requestAnimationFrame(() => { container.current?.focus(); window.scrollTo({ top: 0, behavior: "instant" }); });
  }
  function editDetails() { setPreview(false); requestAnimationFrame(() => container.current?.focus()); }
  function field(name: keyof WeddingPreviewDetails, label: string, placeholder: string, maxLength: number, optional = false) {
    return <label>{label}{optional && <span>Optional</span>}<input name={name} value={details[name]} onChange={event => setDetails({ ...details, [name]: event.target.value })} disabled={busy} placeholder={placeholder} maxLength={maxLength} required={!optional} pattern={!optional && name !== "weddingDate" ? ".*\\S.*" : undefined} min={name === "weddingDate" ? "0001-01-01" : undefined} max={name === "weddingDate" ? "9999-12-31" : undefined} type={name === "weddingDate" ? "date" : "text"} /></label>;
  }
  return <div ref={container} tabIndex={-1}>
    {preview ? <DashboardPreview details={details} onBack={editDetails} /> : <>
      <header className={styles.setupHeader}><Link href="/" className={styles.brand}><Image src="/images/homepage/wordmark.png" alt="KalyanaPura home" width={260} height={60} sizes="174px" /></Link><Link href="/">← Back to homepage</Link></header>
      <main className={styles.setupMain}>
        {mode === "preview" && <div className={styles.previewNotice} role="note"><strong>Design preview</strong><span>No wedding will be saved. Details stay in this page and clear on refresh.</span></div>}
        <div className={styles.setupGrid}>
          <section className={styles.setupForm}><p className={styles.eyebrow}>Create your wedding</p><h1>A place for your celebration.</h1><p>Every beautiful celebration starts with a few details. Give your wedding a place to come together.</p>
            {error && <p className={styles.formError} role="alert">{error} <Link href="/dashboard">Check dashboard →</Link></p>}
            <form onSubmit={showDashboard} aria-busy={busy}><div className={styles.fields}>
              {field("brideName", "Bride name", "e.g. Kavitha", 150)}{field("groomName", "Groom name", "e.g. Rajesh", 150)}
              {field("weddingDate", "Wedding date", "", 10)}{field("location", "Wedding location", "e.g. Kozhikode, Kerala", 500)}
              {field("title", "Wedding title", "e.g. Together begins here", 150, true)}
            </div><p className={styles.hint}>India Standard Time · Asia/Kolkata &nbsp; | &nbsp; Currency · INR (₹)</p><button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? "Creating your wedding…" : mode === "create" ? "Create wedding" : "Preview wedding dashboard"} <span aria-hidden="true">→</span></button><p className={styles.saveNote}>{mode === "create" ? "Your private wedding workspace is one step away." : "Design preview only. Nothing is saved."}</p></form>
          </section>
          <aside className={styles.companion} aria-label="Fictional wedding example"><div className={styles.companionHeader}><span className={styles.eyebrow}>Your wedding, at a glance</span><small>Fictional example</small></div><div className={styles.invitationCard}><p className={styles.eyebrow}>Together begins here</p><h2>{sampleWedding.groomName}<span>&amp;</span>{sampleWedding.brideName}</h2><p>14 February 2027</p><p>{sampleWedding.location}</p></div><Image src="/images/homepage/ritual.png" alt="Illustrative wedding ritual" width={500} height={280} sizes="(max-width: 760px) 85vw, 380px" /><ol><li><span>1</span><div>Wedding details<small>The beginning of your story</small></div></li><li><span>2</span><div>Your workspace<small>A preview of your planning home</small></div></li><li><span>3</span><div>Plan together<small>Family collaboration · Future feature</small></div></li></ol></aside>
        </div><footer className={styles.dashboardFooter}>Your wedding, beautifully organised. <Link href="/">Back to homepage →</Link></footer>
      </main>
    </>}
  </div>;
}
