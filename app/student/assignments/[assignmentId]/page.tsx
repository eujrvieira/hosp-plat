import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const { supabase, user } = await requireUser();
  const [{ data: assignment }, { data: profile }] = await Promise.all([
    supabase.from("case_assignments").select("id,state,current_branch_key,course:courses(id,name,term),patient:simulated_patients(id,code,display_name,age,sex,weight_kg,height_cm,baseline_summary)").eq("id", assignmentId).maybeSingle(),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
  ]);
  if (!assignment) return <AppShell userName={profile?.full_name || profile?.email}><div className="alert">VocÃª nÃ£o possui acesso a este caso.</div></AppShell>;
  const patient:any = assignment.patient;
  const { data: episodes } = await supabase.from("case_episodes").select("id,week_no,title,summary,branch_key,release_at,due_at,is_final").eq("patient_id", patient.id).order("week_no");
  const { data: submissions } = await supabase.from("student_submissions").select("id,episode_id,status,submitted_at,version_no").eq("assignment_id", assignmentId).order("version_no", {ascending:false});
  const latestByEpisode = new Map<string,any>();
  (submissions||[]).forEach((s:any)=>{ if(!latestByEpisode.has(s.episode_id)) latestByEpisode.set(s.episode_id,s); });
  return (
    <AppShell userName={profile?.full_name || profile?.email}>
      <section className="hero"><div><div className="eyebrow">{patient.code} Â· {(assignment.course as any)?.name}</div><h1>{patient.display_name}</h1><p>{patient.baseline_summary}</p></div><StatusBadge value={assignment.state}/></section>
      <section className="card" style={{marginBottom:24}}><h2>Dados basais</h2><dl className="kv"><dt>Idade</dt><dd>{patient.age ?? "â€”"}</dd><dt>Sexo</dt><dd>{patient.sex ?? "â€”"}</dd><dt>Peso</dt><dd>{patient.weight_kg ? `${patient.weight_kg} kg` : "â€”"}</dd><dt>Altura</dt><dd>{patient.height_cm ? `${patient.height_cm} cm` : "â€”"}</dd><dt>Ramo atual</dt><dd>{assignment.current_branch_key}</dd></dl></section>
      <section className="stack"><div className="row-between"><h2 style={{margin:0}}>Linha do tempo liberada</h2><span className="small muted">Somente episÃ³dios liberados ficam acessÃ­veis.</span></div>{(episodes||[]).length ? <div className="grid grid-2">{(episodes||[]).map((e:any)=>{ const sub=latestByEpisode.get(e.id); return <Link className="card" key={e.id} href={`/student/assignments/${assignmentId}/episodes/${e.id}`}><div className="row-between"><div><div className="eyebrow">Semana {e.week_no}</div><h3 style={{margin:"4px 0"}}>{e.title}</h3></div>{sub ? <StatusBadge value={sub.status}/> : <span className="badge">pendente</span>}</div><p>{e.summary}</p><div className="small muted">Liberado: {formatDateTime(e.release_at)} Â· Prazo: {formatDateTime(e.due_at)}</div></Link>})}</div> : <div className="empty">Nenhum episÃ³dio foi liberado ainda.</div>}</section>
    </AppShell>
  );
}


