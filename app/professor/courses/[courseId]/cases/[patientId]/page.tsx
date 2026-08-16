import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCourseStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { assignPatient, completeAssignment, createEpisode, setAssignmentBranch } from "../actions";

export default async function PatientAdminPage({ params }: { params: Promise<{ courseId: string; patientId: string }> }) {
  const { courseId, patientId } = await params;
  const { supabase, user } = await requireCourseStaff(courseId);
  const [{ data: patient }, { data: groups }, { data: students }, { data: assignments }, { data: profile }] = await Promise.all([
    supabase.from("simulated_patients").select("*, episodes:case_episodes(id,week_no,title,branch_key,release_at,due_at,is_final,summary)").eq("id", patientId).eq("course_id", courseId).single(),
    supabase.from("student_groups").select("id,name").eq("course_id", courseId).eq("is_archived", false).order("name"),
    supabase.from("course_memberships").select("user:profiles(id,full_name,email)").eq("course_id", courseId).eq("role", "student").eq("status", "active"),
    supabase.from("case_assignments").select("id,state,current_branch_key,group:student_groups(id,name),student:profiles(id,full_name,email)").eq("course_id", courseId).eq("patient_id", patientId).order("created_at"),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
  ]);
  const episodes = [...(patient?.episodes || [])].sort((a: any,b: any) => a.week_no - b.week_no || a.branch_key.localeCompare(b.branch_key));
  return (
    <AppShell userName={profile?.full_name || profile?.email}>
      <section className="hero"><div><div className="eyebrow">{patient?.code}</div><h1>{patient?.display_name}</h1><p>{patient?.baseline_summary}</p></div><Link className="btn btn-secondary" href={`/professor/courses/${courseId}/cases`}>Voltar</Link></section>
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <section className="card"><h2>Novo episódio semanal</h2><form action={createEpisode.bind(null, courseId, patientId)} className="form-grid">
          <div className="field"><label>Semana</label><input className="input" name="week_no" type="number" min="1" required /></div>
          <div className="field"><label>Ramo</label><input className="input" name="branch_key" defaultValue="main" /></div>
          <div className="field span-2"><label>Título</label><input className="input" name="title" placeholder="Semana 2 — resposta parcial ao tratamento" required /></div>
          <div className="field span-2"><label>Resumo visível ao aluno</label><textarea className="textarea" name="summary" required /></div>
          <div className="field span-2"><label>Notas exclusivas do professor</label><textarea className="textarea" name="teacher_only_notes" /></div>
          <div className="field"><label>Liberação</label><input className="input" name="release_at" type="datetime-local" required /></div>
          <div className="field"><label>Prazo</label><input className="input" name="due_at" type="datetime-local" /></div>
          <label className="row"><input type="checkbox" name="is_final" /> Episódio final</label><div><button className="btn" type="submit">Criar episódio</button></div>
        </form></section>
        <section className="card"><h2>Atribuir paciente</h2><form action={assignPatient.bind(null, courseId, patientId)} className="stack">
          <div className="field"><label>Modo</label><select className="select" name="mode" defaultValue="group"><option value="group">Grupo</option><option value="student">Aluno individual</option></select></div>
          <div className="field"><label>Destino</label><select className="select" name="target_id" required defaultValue=""><option value="" disabled>Selecione…</option><optgroup label="Grupos">{(groups || []).map((g: any)=><option key={g.id} value={g.id}>{g.name}</option>)}</optgroup><optgroup label="Alunos">{(students || []).map((s: any)=><option key={s.user?.id} value={s.user?.id}>{s.user?.full_name || s.user?.email}</option>)}</optgroup></select><div className="small muted">Ao escolher aluno, altere também “Modo” para Aluno individual.</div></div>
          <div className="field"><label>Ramo inicial</label><input className="input" name="branch_key" defaultValue="main" /></div><button className="btn" type="submit">Atribuir</button>
        </form></section>
      </div>
      <section className="card" style={{ marginBottom: 24 }}><h2>Episódios</h2>{episodes.length ? <div className="table-wrap"><table><thead><tr><th>Semana</th><th>Ramo</th><th>Título</th><th>Liberação</th><th>Prazo</th><th></th></tr></thead><tbody>{episodes.map((e: any)=><tr key={e.id}><td>{e.week_no}</td><td><span className="badge">{e.branch_key}</span></td><td><strong>{e.title}</strong>{e.is_final ? <div className="small muted">Final</div> : null}</td><td>{formatDateTime(e.release_at)}</td><td>{formatDateTime(e.due_at)}</td><td><Link className="btn btn-secondary btn-small" href={`/professor/courses/${courseId}/cases/${patientId}/episodes/${e.id}`}>Editar dados</Link></td></tr>)}</tbody></table></div> : <div className="empty">Nenhum episódio criado.</div>}</section>
      <section className="card"><h2>Atribuições</h2>{(assignments || []).length ? <div className="stack">{(assignments || []).map((a:any)=><div className="card card-subtle" key={a.id}><div className="row-between"><div><strong>{a.group?.name || a.student?.full_name || a.student?.email}</strong><div className="small muted">Ramo atual: {a.current_branch_key}</div></div><StatusBadge value={a.state} /></div><div className="divider"/><div className="row"><form action={setAssignmentBranch.bind(null,courseId,patientId,a.id)} className="row"><input className="input" style={{width:160}} name="branch_key" defaultValue={a.current_branch_key}/><button className="btn btn-secondary btn-small">Alterar ramo</button></form>{a.state !== "completed" ? <form action={completeAssignment.bind(null,courseId,patientId,a.id)}><button className="btn btn-small">Concluir caso</button></form> : null}</div></div>)}</div> : <div className="empty">Paciente ainda não atribuído.</div>}</section>
    </AppShell>
  );
}
