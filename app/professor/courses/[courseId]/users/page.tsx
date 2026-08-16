import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCourseStaff } from "@/lib/auth";
import { addStudentToGroup, createGroup, inviteMember, removeStudentFromGroup, setMembershipStatus } from "./actions";

export default async function UsersPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase, user } = await requireCourseStaff(courseId);
  const [{ data: course }, { data: memberships }, { data: groups }, { data: profile }] = await Promise.all([
    supabase.from("courses").select("name,term").eq("id", courseId).single(),
    supabase.from("course_memberships").select("id,role,status,joined_at,user:profiles(id,full_name,email)").eq("course_id", courseId).order("created_at"),
    supabase.from("student_groups").select("id,name,is_archived,members:group_members(user_id,user:profiles(id,full_name,email))").eq("course_id", courseId).eq("is_archived", false).order("name"),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
  ]);
  const students = (memberships || []).filter((m: any) => m.role === "student" && m.status !== "archived");

  return (
    <AppShell userName={profile?.full_name || profile?.email}>
      <section className="hero"><div><div className="eyebrow">{course?.name}</div><h1>Usuários e grupos</h1><p>Gerencie vínculos acadêmicos. Senhas nunca são exibidas ou armazenadas nesta área.</p></div><Link className="btn btn-secondary" href={`/professor/courses/${courseId}`}>Voltar</Link></section>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <section className="card">
          <h2>Convidar usuário</h2>
          <form action={inviteMember.bind(null, courseId)} className="stack">
            <div className="field"><label>Nome</label><input className="input" name="full_name" placeholder="Nome completo" /></div>
            <div className="field"><label>E-mail</label><input className="input" name="email" type="email" required /></div>
            <div className="field"><label>Função nesta turma</label><select className="select" name="role" defaultValue="student"><option value="student">Aluno</option><option value="assistant">Professor colaborador</option><option value="instructor">Professor</option></select></div>
            <button className="btn" type="submit">Enviar convite / vincular</button>
          </form>
        </section>
        <section className="card">
          <h2>Criar grupo</h2>
          <form action={createGroup.bind(null, courseId)} className="row">
            <input className="input" style={{ flex: 1 }} name="name" placeholder="Grupo 01" required />
            <button className="btn" type="submit">Criar</button>
          </form>
          <div className="divider" />
          <p className="small muted">Depois de criar o grupo, adicione alunos usando o seletor em cada cartão abaixo.</p>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Matrículas</h2>
        <div className="table-wrap"><table><thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {(memberships || []).map((m: any) => <tr key={m.id}><td><strong>{m.user?.full_name || "Sem nome"}</strong><div className="small muted">{m.user?.email}</div></td><td>{m.role}</td><td><StatusBadge value={m.status} /></td><td><div className="row">
            {m.status === "suspended" ? <form action={setMembershipStatus.bind(null, courseId, m.id, "active")}><button className="btn btn-small" type="submit">Reativar</button></form> : null}
            {m.status === "active" && m.user?.id !== user.id ? <form action={setMembershipStatus.bind(null, courseId, m.id, "suspended")}><button className="btn btn-secondary btn-small" type="submit">Suspender</button></form> : null}
            {m.user?.id !== user.id ? <form action={setMembershipStatus.bind(null, courseId, m.id, "archived")}><button className="btn btn-secondary btn-small" type="submit">Arquivar</button></form> : null}
          </div></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="stack">
        <h2 style={{ marginBottom: 0 }}>Grupos</h2>
        {(groups || []).length ? <div className="grid grid-2">{(groups || []).map((g: any) => <div className="card" key={g.id}>
          <div className="row-between"><h3 style={{ margin: 0 }}>{g.name}</h3><span className="badge">{g.members?.length || 0} aluno(s)</span></div>
          <div className="divider" />
          <div className="stack">
            {(g.members || []).map((gm: any) => <div className="row-between" key={gm.user_id}><div><strong>{gm.user?.full_name || gm.user?.email}</strong><div className="small muted">{gm.user?.email}</div></div><form action={removeStudentFromGroup.bind(null, courseId, g.id, gm.user_id)}><button className="btn btn-secondary btn-small" type="submit">Remover</button></form></div>)}
          </div>
          <div className="divider" />
          <form action={addStudentToGroup.bind(null, courseId)} className="row">
            <input type="hidden" name="group_id" value={g.id} />
            <select className="select" name="user_id" style={{ flex: 1 }} required defaultValue=""><option value="" disabled>Adicionar aluno…</option>{students.map((s: any) => <option key={s.user?.id} value={s.user?.id}>{s.user?.full_name || s.user?.email}</option>)}</select>
            <button className="btn btn-small" type="submit">Adicionar</button>
          </form>
        </div>)}</div> : <div className="empty">Nenhum grupo criado.</div>}
      </section>
    </AppShell>
  );
}
