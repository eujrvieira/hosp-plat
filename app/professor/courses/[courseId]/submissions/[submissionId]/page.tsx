import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCourseStaff } from "@/lib/auth";
import { gradeSubmission, reopenSubmission } from "../actions";

export default async function SubmissionDetailPage({params}:{params:Promise<{courseId:string;submissionId:string}>}){
  const {courseId,submissionId}=await params;
  const {supabase,user}=await requireCourseStaff(courseId);
  const [{data:profile},{data:s}]=await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id",user.id).single(),
    supabase.from("student_submissions").select("id,status,summary,version_no,author_snapshot,submitted_at,assignment:case_assignments!inner(course_id,group:student_groups(name),student:profiles(full_name,email),patient:simulated_patients(display_name,code)),episode:case_episodes(week_no,title),problems:med_related_problems(id,sort_order,category,description,evidence,interventions:pharm_interventions(id,recommendation,priority,target,simulated_outcome),monitoring:monitoring_plans(id,parameter,target,timeframe)),scores(id,total_points),feedback(id,text,released_at)").eq("id",submissionId).eq("assignment.course_id",courseId).maybeSingle()
  ]);
  if(!s) return <AppShell userName={profile?.full_name||profile?.email}><div className="alert">Submissão não encontrada.</div></AppShell>;
  const score=s.scores?.[0]; const fb=s.feedback?.[0];
  return <AppShell userName={profile?.full_name||profile?.email}>
    <section className="hero"><div><div className="eyebrow">{s.assignment?.patient?.code} · Semana {s.episode?.week_no}</div><h1>{s.assignment?.patient?.display_name}</h1><p>{s.episode?.title}</p></div><div className="row"><StatusBadge value={s.status}/><Link className="btn btn-secondary" href={`/professor/courses/${courseId}/submissions`}>Voltar</Link></div></section>
    <section className="card" style={{marginBottom:24}}><h2>Síntese farmacêutica</h2><p style={{whiteSpace:"pre-wrap"}}>{s.summary}</p></section>
    <section className="stack" style={{marginBottom:24}}><h2 style={{margin:0}}>Problemas, intervenções e monitoramento</h2>{[...(s.problems||[])].sort((a:any,b:any)=>a.sort_order-b.sort_order).map((p:any,i:number)=><div className="card" key={p.id}><div className="row-between"><h3 style={{margin:0}}>Problema {i+1}</h3><span className="badge">{p.category}</span></div><p><strong>{p.description}</strong></p><p className="muted">Evidência: {p.evidence}</p><div className="divider"/><h4>Intervenções</h4>{(p.interventions||[]).map((it:any)=><div className="card card-subtle" key={it.id}><div className="row-between"><strong>{it.recommendation}</strong><span className="badge">{it.priority}</span></div><div className="small muted">Alvo: {it.target||"—"}</div></div>)}<h4>Monitoramento</h4>{(p.monitoring||[]).map((m:any)=><div className="small" key={m.id}><strong>{m.parameter}</strong> · meta {m.target||"—"} · prazo {m.timeframe||"—"}</div>)}</div>)}</section>
    <section className="card"><h2>Correção</h2><form action={gradeSubmission.bind(null,courseId,submissionId)} className="stack"><div className="field"><label>Nota total</label><input className="input" name="total_points" type="number" step="0.1" min="0" defaultValue={score?.total_points??""} required/></div><div className="field"><label>Feedback</label><textarea className="textarea" name="feedback" defaultValue={fb?.text||""} required/></div><label className="row"><input type="checkbox" name="release_now" defaultChecked={!!fb?.released_at}/> Liberar feedback ao aluno agora</label><button className="btn" type="submit">Salvar correção</button></form>{s.status!=="draft"&&s.status!=="reopened"?<><div className="divider"/><form action={reopenSubmission.bind(null,courseId,submissionId)}><button className="btn btn-secondary" type="submit">Reabrir para edição</button></form></>:null}</section>
  </AppShell>
}
