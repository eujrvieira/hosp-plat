import { sendMagicLink, signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="eyebrow">Plataforma educacional</div>
        <h1>Farmácia Hospitalar</h1>
        <p className="muted">Acompanhe pacientes simulados, revise a farmacoterapia e registre intervenções ao longo do semestre.</p>
        <div className="divider" />
        {params.error ? <div className="alert">{params.error}</div> : null}
        {params.message ? <div className="success">{params.message}</div> : null}
        <form action={signIn} className="stack" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn" type="submit">Entrar</button>
        </form>
        <div className="divider" />
        <form action={sendMagicLink} className="stack">
          <div className="field">
            <label htmlFor="magic-email">Ou receber um link de acesso</label>
            <input className="input" id="magic-email" name="email" type="email" required placeholder="seu@email.com" />
          </div>
          <button className="btn btn-secondary" type="submit">Enviar link mágico</button>
        </form>
      </section>
    </main>
  );
}
