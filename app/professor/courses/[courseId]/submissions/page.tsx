import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCourseStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function SubmissionsPage({params}:{params:Promise<{courseId:string}>}){
  const {courseId}=await params;
  const {supabase,user}=await requireCourseStaff(courseId);
  const [{data:course},{data:profile},{data:rows}]=await Promise.all([
    supabase.from("courses").select("name,term").eq("id",courseId).single(),
    supabase.from("profiles").select("full_name,email").eq("id",user.id).single(),
    supabase.from("student_submissions").select("id,status,version_no,submitted_at,summary,assignment:case_assignments!inner(id,course_id,group:student_groups(name),student:profiles(full_name,email),patient:simulated_patients(display_name,code)),episode:case_episodes(week_no,title)").eq("assignment.course_id",courseId).order("submitted_at",{ascending:false,nullsFirst:false})
  ]);
  return <AppShell userName={profile?.full_name||profile?.email}>
    <section className="hero"><div><div className="eyebrow">{course?.name}</div><h1>Submissões</h1><p>Entregas semanais dos grupos e alunos individuais.</p></div><Link className="btn btn-secondary" href={`/professor/courses/${courseId}`}>Voltar</Link></section>
    {(rows||[]).length?<div className="table-wrap"><table><thead><tr><th>Paciente</th><th>Responsável</th><th>Semana</th><th>Status</th><th>Envio</th><th></th></tr></thead><tbody>{(rows||[]).map((s:any)=><tr key={s.id}><td><strong>{s.assignment?.patient?.display_name}</strong><div className="small muted">{s.assignment?.patient?.code}</div></td><td>{s.assignment?.group?.name||s.assignment?.student?.full_name||s.assignment?.student?.email}</td><td>Semana {s.episode?.week_no}<div className="small muted">{s.episode?.title}</div></td><td><StatusBadge value={s.status}/></td><td>{formatDateTime(s.submitted_at)}</td><td><Link className="btn btn-secondary btn-small" href={`/professor/courses/${courseId}/submissions/${s.id}`}>Corrigir</Link></td></tr>)}</tbody></table></div>:<div className="empty">Nenhuma submissão registrada.</div>}
  </AppShell>
}
