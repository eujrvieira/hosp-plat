import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireCourseStaff } from "@/lib/auth";
import { createPatient } from "./actions";

export default async function CasesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase, user } = await requireCourseStaff(courseId);
  const [{ data: course }, { data: patients }, { data: profile }] = await Promise.all([
    supabase.from("courses").select("name,term").eq("id", courseId).single(),
    supabase.from("simulated_patients").select("id,code,display_name,age,sex,baseline_summary,created_at,episodes:case_episodes(id),assignments:case_assignments(id)").eq("course_id", courseId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
  ]);
  return (
    <AppShell userName={profile?.full_name || profile?.email}>
      <section className="hero"><div><div className="eyebrow">{course?.name}</div><h1>Casos clínicos</h1><p>Crie pacientes fictícios e construa a evolução semanal sem expor episódios futuros.</p></div><Link className="btn btn-secondary" href={`/professor/courses/${courseId}`}>Voltar</Link></section>
      <div className="grid grid-2">
        <section className="card">
          <h2>Novo paciente</h2>
          <form action={createPatient.bind(null, courseId)} className="form-grid">
            <div className="field"><label>Código</label><input className="input" name="code" placeholder="SIM-001" required /></div>
            <div className="field"><label>Nome fictício</label><input className="input" name="display_name" placeholder="Paciente Alfa" required /></div>
            <div className="field"><label>Idade</label><input className="input" name="age" type="number" min="0" /></div>
            <div className="field"><label>Sexo</label><select className="select" name="sex" defaultValue=""><option value="">Não informado</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="Outro">Outro</option></select></div>
            <div className="field"><label>Peso (kg)</label><input className="input" name="weight_kg" type="number" step="0.1" /></div>
            <div className="field"><label>Altura (cm)</label><input className="input" name="height_cm" type="number" step="0.1" /></div>
            <div className="field span-2"><label>Resumo basal</label><textarea className="textarea" name="baseline_summary" required placeholder="Motivo da internação, antecedentes, contexto clínico inicial..." /></div>
            <div><button className="btn" type="submit">Criar paciente</button></div>
          </form>
        </section>
        <section className="stack">
          <h2 style={{ margin: 0 }}>Pacientes da turma</h2>
          {(patients || []).length ? (patients || []).map((p: any) => <Link className="card" key={p.id} href={`/professor/courses/${courseId}/cases/${p.id}`}><div className="row-between"><div><div className="eyebrow">{p.code}</div><h3 style={{ margin: "4px 0" }}>{p.display_name}</h3></div><span className="badge">{p.episodes?.length || 0} episódio(s)</span></div><p className="muted">{p.baseline_summary}</p><div className="small muted">{p.assignments?.length || 0} atribuição(ões)</div></Link>) : <div className="empty">Nenhum paciente criado.</div>}
        </section>
      </div>
    </AppShell>
  );
}
