import Link from "next/link";

export function ApplicationShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <Link className="brand" href="/">KalyanaPura<span>Wedding workspace</span></Link>
        <nav aria-label="Main navigation">
          <Link href="/">Overview</Link>
          <Link href="/login">Log in</Link>
          <Link href="/dashboard">Dashboard preview</Link>
        </nav>
      </header>
      <main id="main-content" className="page-container">{children}</main>
      <footer className="site-footer">Foundation preview · Product workflows are not implemented.</footer>
    </>
  );
}
