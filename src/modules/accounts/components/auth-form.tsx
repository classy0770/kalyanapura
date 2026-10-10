"use client";
import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "../client";
import { emailSchema, loginSchema, passwordSchema, signupSchema } from "../schemas";
import styles from "./account.module.css";
import signupStyles from "./signup.module.css";

type Mode = "login" | "signup" | "forgot" | "reset" | "verify";
const titles: Record<Mode, string> = { login: "Welcome back.", signup: "Start your wedding journey.", forgot: "Forgot your password?", reset: "Choose a new password.", verify: "Verify your email." };
const descriptions: Record<Mode, string> = { login: "Log in to your KalyanaPura account.", signup: "Create your account. Verify your email before logging in.", forgot: "We’ll send a reset link if an eligible account exists.", reset: "Your new password will sign you out of existing sessions.", verify: "Open the verification link in your inbox, then return to log in. You can request another email below." };
const labels: Record<Mode, string> = { login: "Log in", signup: "Create account", forgot: "Send reset link", reset: "Reset password", verify: "Send verification email" };

function errorMessage(code?: string) {
  if (code === "EMAIL_NOT_VERIFIED") return "Verify your email before logging in. Use the verification link below to request another email.";
  if (code === "TEMPORARILY_UNAVAILABLE") return "Account services are unavailable. Please try again once setup is complete.";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "Check your email and password and try again.";
  if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") return "This link is invalid or expired. Request a new one.";
  return "We couldn’t complete that request. Check your details or try again shortly.";
}

export function AuthForm({ mode, token, notice }: { mode: Mode; token?: string; notice?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(notice ?? "");
  const [complete, setComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "");
    const parsed = mode === "signup" ? signupSchema.safeParse({ name, email, password }) : mode === "login" ? loginSchema.safeParse({ email, password }) : mode === "reset" ? passwordSchema.safeParse(password) : emailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your details."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = mode === "signup" ? await authClient.signUp.email({ name: name.trim(), email: cleanEmail, password, callbackURL: "/login?verified=1" })
        : mode === "login" ? await authClient.signIn.email({ email: cleanEmail, password, callbackURL: "/dashboard" })
        : mode === "forgot" ? await authClient.requestPasswordReset({ email: cleanEmail, redirectTo: "/reset-password" })
        : mode === "verify" ? await authClient.sendVerificationEmail({ email: cleanEmail, callbackURL: "/login?verified=1" })
        : await authClient.resetPassword({ newPassword: password, token: token ?? "" });
      if (result.error) { setError(result.error.status === 429 ? "Too many attempts. Please wait a minute and try again." : errorMessage(result.error.code)); return; }
      if (mode === "login") { router.replace("/dashboard"); router.refresh(); return; }
      setMessage(mode === "reset" ? "Password reset. Log in with your new password." : "If this address is eligible, an email has been queued. Check your inbox and spam folder; delivery can take a little time.");
      setComplete(true);
    } catch { setError("Account services are unavailable. Please try again shortly."); }
    finally { setBusy(false); }
  }
  const showForm = !complete && (mode !== "reset" || !!token);
  return <section className={`${styles.card} ${mode === "signup" ? signupStyles.signupCard : ""}`}>
    <p className={styles.eyebrow}>{mode === "signup" ? "Your next chapter starts here" : "KalyanaPura accounts"}</p><h1>{titles[mode]}</h1><p className={mode === "signup" ? signupStyles.intro : undefined}>{mode === "signup" ? "A few details, and you’re on your way. Create an account to begin with KalyanaPura." : descriptions[mode]}</p>
    {message && <p className={styles.message} role="status">{message}</p>}
    {error && <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p>}
    {mode === "reset" && !token && <p className={`${styles.message} ${styles.error}`} role="alert">This reset link is missing or invalid. Request a new link.</p>}
    {showForm && <form className={styles.form} onSubmit={submit} aria-busy={busy}>
      {mode === "signup" && <label>Your name<input name="name" autoComplete="name" placeholder="e.g. Ananya Sharma" required maxLength={150} disabled={busy} /></label>}
      {mode !== "reset" && <label>Email address<input name="email" type="email" autoComplete="email" placeholder={mode === "signup" ? "you@example.com" : undefined} required maxLength={254} disabled={busy} /></label>}
      {mode === "signup" ? <div><label htmlFor={passwordId}>Password</label><div className={signupStyles.passwordField}><input id={passwordId} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Create a password" minLength={8} maxLength={128} required disabled={busy} aria-describedby={`${passwordId}-hint`} /><button type="button" className={signupStyles.passwordToggle} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={busy}>{showPassword ? "Hide" : "Show"}</button></div><span id={`${passwordId}-hint`} className={styles.hint}>Use 8–128 characters. Keep it unique.</span></div>
        : ["login", "reset"].includes(mode) && <label>{mode === "reset" ? "New password" : "Password"}<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 8} maxLength={128} required disabled={busy} />{mode !== "login" && <span className={styles.hint}>Use 8–128 characters.</span>}</label>}
      <button className={`${styles.button} ${mode === "signup" ? signupStyles.submit : ""}`} disabled={busy} type="submit">{busy ? "Please wait…" : labels[mode]}{mode === "signup" && !busy && <span aria-hidden="true">→</span>}</button>
    </form>}
    {mode === "signup" && showForm && <p className={signupStyles.verificationNote}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>We’ll email you a verification link. Verify your email before logging in.</p>}
    <div className={`${styles.links} ${mode === "signup" ? signupStyles.signupLinks : ""}`}>{mode === "signup" ? <><span>Already have an account? <Link href="/login">Log in</Link></span>{complete && <Link href="/verify-email">Resend verification email</Link>}</> : mode === "login" ? <><Link href="/signup">Create an account</Link><Link href="/forgot-password">Forgot password?</Link><Link href="/verify-email">Resend verification email</Link></> : <><Link href="/login">Back to login</Link>{mode === "reset" ? <Link href="/forgot-password">Request a new reset link</Link> : <Link href="/verify-email">Resend verification email</Link>}</>}</div>
  </section>;
}
