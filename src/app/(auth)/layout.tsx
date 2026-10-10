import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import styles from "@/modules/accounts/components/account.module.css";

export const metadata: Metadata = { referrer: "no-referrer" };

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={styles.shell}><header className={styles.header}><Link href="/" aria-label="KalyanaPura home"><Image src="/images/homepage/wordmark.png" alt="KalyanaPura" width={260} height={60} sizes="174px" /></Link><Link href="/">Back to homepage</Link></header><main className={styles.main}>{children}</main><footer className={styles.footer}>Your wedding, beautifully organised.</footer></div>;
}
