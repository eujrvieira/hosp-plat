import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireCourseStaff } from "@/lib/auth";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase, user } = await requireCourseStaff(courseId);
  const [{ data: course }, { count: studentCount }, { count: groupCount }, { count: assignmentCount }, { data: profile }] = await Promise.all([
    supabase.from("courses").select("id,name,term,status,start_date,end_date").eq("id", courseId).single(),
    supabase.from("course_memberships").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("role", "student").eq("status", "active"),
    supabase.from("student_groups").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("is_archived", false),
    supabase.from("case_assignments").select("id", { count: "exact", head: true }).eq("course_id", courseId).neq("state", "archived"),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
  ]);

  return (
    <AppShell userName={profile?.full_name || profile?.email}>
      <section className="hero">
        <div><div className="eyebrow">Área docente</div><h1>{course?.name}</h1><p>{course?.term}</p></div>
        {course?.status ? <StatusBadge value={course.status} /> : null}
      </section>
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card"><div className="muted small">Alunos ativos</div><div className="metric">{studentCount || 0}</div></div>
        <div className="card"><div className="muted small">Grupos</div><div className="metric">{groupCount || 0}</div></div>
        <div className="card"><div className="muted small">Casos atribuídos</div><div className="metric">{assignmentCount || 0}</div></div>
      </div>
      <div className="grid grid-3">
        <Link className="card" href={`/professor/courses/${courseId}/users`}><h3>Usuários e grupos</h3><p className="muted">Convites, funções, matrículas, suspensão de acesso e composição dos grupos.</p></Link>
        <Link className="card" href={`/professor/courses/${courseId}/cases`}><h3>Casos clínicos</h3><p className="muted">Pacientes simulados, episódios semanais, exames, prescrições e atribuições.</p></Link>
        <Link className="card" href={`/professor/courses/${courseId}/submissions`}><h3>Submissões</h3><p className="muted">Entregas dos grupos, correção, notas e feedback.</p></Link>
      </div>
    </AppShell>
  );
}
