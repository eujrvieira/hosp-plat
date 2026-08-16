import Link from "next/link";
import { signOut } from "@/app/login/actions";

export function AppShell({ children, userName }: { children: React.ReactNode; userName?: string | null }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">Rx</span>
          <span>Farmácia Hospitalar</span>
        </Link>
        <div className="topbar-actions">
          {userName ? <span className="small muted">{userName}</span> : null}
          <Link className="btn btn-secondary btn-small" href="/dashboard">Painel</Link>
          <form action={signOut}><button className="btn btn-secondary btn-small" type="submit">Sair</button></form>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
