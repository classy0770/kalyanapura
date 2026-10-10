import Link from "next/link";

import { ApplicationShell } from "@/components/layouts/application-shell";

export default function NotFound() {
  return (
    <ApplicationShell>
      <section className="panel narrow">
        <p className="eyebrow">Page unavailable</p>
        <h1>This page is not available.</h1>
        <p>Explore the homepage, access your account, or visit the dashboard preview. Wedding planning workflows are coming next.</p>
        <Link className="button secondary" href="/">Return to overview</Link>
      </section>
    </ApplicationShell>
  );
}
