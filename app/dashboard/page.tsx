import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createCourse } from "./actions";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user } = await requireUser();
  await supabase.rpc("mark_memberships_joined");
  const params = await searchParams;

  const [{ data: profile }, { data: memberships }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase
      .from("course_memberships")
      .select("id, role, status, course:courses(id,name,term,start_date,end_date,status)")
      .eq("user_id", user.id)
      .in("status", ["active", "invited"])
      .order("created_at", { ascending: false }),
    supabase.rpc("is_platform_admin"),
  ]);

  const staffCourses = (memberships || []).filter((m: any) => ["instructor", "assistant"].includes(m.role));
  const studentCourses = (memberships || []).filter((m: any) => m.role === "student");

  let assignments: any[] = [];
  if (studentCourses.length) {
    const { data } = await supabase
      .from("case_assignments")
      .select("id,state,current_branch_key,course_id,patient:simulated_patients(id,code,display_name,baseline_summary), course:courses(name,term)")
      .in("course_id", studentCourses.map((m: any) => m.course.id))
      .order("created_at", { ascending: false });
    assignments = data || [];
  }

  return (
    <AppShell userName={profile?.full_name || profile?.email || user.email}>
      <section className="hero">
        <div>
          <div className="eyebrow">Visão geral</div>
          <h1>Seu painel</h1>
          <p>Turmas, pacientes simulados e atividades que exigem sua ação.</p>
        </div>
      </section>
      {params.error ? <div className="alert" style={{ marginBottom: 18 }}>{params.error}</div> : null}

      {staffCourses.length ? (
        <section className="stack" style={{ marginBottom: 28 }}>
          <div className="row-between"><h2 style={{ margin: 0 }}>Área docente</h2></div>
          <div className="grid grid-2">
            {staffCourses.map((m: any) => (
              <Link className="card" key={m.id} href={`/professor/courses/${m.course.id}`}>
                <div className="row-between"><strong>{m.course.name}</strong><StatusBadge value={m.role} /></div>
                <p className="muted">{m.course.term}</p>
                <p className="small muted">{formatDate(m.course.start_date)} — {formatDate(m.course.end_date)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {studentCourses.length ? (
        <section className="stack" style={{ marginBottom: 28 }}>
          <div className="row-between"><h2 style={{ margin: 0 }}>Meus pacientes</h2></div>
          {assignments.length ? <div className="grid grid-2">
            {assignments.map((a: any) => (
              <Link className="card" key={a.id} href={`/student/assignments/${a.id}`}>
                <div className="row-between"><strong>{a.patient?.display_name || a.patient?.code}</strong><StatusBadge value={a.state} /></div>
                <p className="muted">{a.course?.name} · {a.course?.term}</p>
                <p>{a.patient?.baseline_summary}</p>
              </Link>
            ))}
          </div> : <div className="empty">Você está matriculado, mas ainda não recebeu um paciente.</div>}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="card">
          <h2>Criar nova turma</h2>
          <form action={createCourse} className="form-grid">
            <div className="field span-2"><label>Nome da turma</label><input className="input" name="name" placeholder="Farmácia Hospitalar — 2026.2" required /></div>
            <div className="field"><label>Período</label><input className="input" name="term" placeholder="2026.2" required /></div>
            <div className="field"><label>Início</label><input className="input" name="start_date" type="date" /></div>
            <div className="field"><label>Fim</label><input className="input" name="end_date" type="date" /></div>
            <div><button className="btn" type="submit">Criar turma</button></div>
          </form>
        </section>
      ) : null}

      {!staffCourses.length && !studentCourses.length && !isAdmin ? (
        <div className="empty">Sua conta está ativa, mas ainda não foi vinculada a nenhuma turma.</div>
      ) : null}
    </AppShell>
  );
}
