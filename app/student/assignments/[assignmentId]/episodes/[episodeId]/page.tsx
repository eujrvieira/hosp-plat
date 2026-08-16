import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmissionEditor } from "@/components/SubmissionEditor";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { saveSubmission } from "../../actions";

export default async function StudentEpisodePage({ params }: { params: Promise<{ assignmentId: string; episodeId: string }> }) {
  const { assignmentId, episodeId } = await params;
  const { supabase, user } = await requireUser();
  const [{data:assignment},{data:profile}] = await Promise.all([
    supabase.from("case_assignments").select("id,patient_id,patient:simulated_patients(code,display_name)").eq("id",assignmentId).maybeSingle(),
    supabase.from("profiles").select("full_name,email").eq("id",user.id).single(),
  ]);
  if(!assignment) return <AppShell userName={profile?.full_name||profile?.email}><div className="alert">AtribuiÃ§Ã£o indisponÃ­vel.</div></AppShell>;
  const {data:episode}=await supabase.from("case_episodes").select(`
    id,week_no,title,summary,release_at,due_at,is_final,branch_key,
    vital_signs(*),lab_results(*),clinical_notes(*),clinical_events(*),
    prescriptions(id,prescription_items(*))
  `).eq("id",episodeId).eq("patient_id",assignment.patient_id).maybeSingle();
  if(!episode) return <AppShell userName={profile?.full_name||profile?.email}><div className="alert">Este episÃ³dio ainda nÃ£o estÃ¡ liberado para vocÃª.</div></AppShell>;
  const {data:submission}=await supabase.from("student_submissions").select("id,status,summary,version_no,submitted_at,problems:med_related_problems(id,sort_order,category,description,evidence),interventions:pharm_interventions(id,problem_id,recommendation,priority,target),monitoring:monitoring_plans(id,problem_id,parameter,target,timeframe),feedback(id,text,released_at),scores(id,total_points)").eq("assignment_id",assignmentId).eq("episode_id",episodeId).order("version_no",{ascending:false}).limit(1).maybeSingle();
  const problems=[...(submission?.problems||[])].sort((a:any,b:any)=>a.sort_order-b.sort_order);
  const indexByProblem=new Map(problems.map((p:any,i:number)=>[p.id,i]));
  const interventions=(submission?.interventions||[]).map((i:any)=>({problemIndex:indexByProblem.get(i.problem_id)??0,recommendation:i.recommendation,priority:i.priority,target:i.target||""}));
  const monitoring=(submission?.monitoring||[]).map((m:any)=>({problemIndex:indexByProblem.get(m.problem_id)??0,parameter:m.parameter,target:m.target||"",timeframe:m.timeframe||""}));
  const rxItems=(episode.prescriptions||[]).flatMap((r:any)=>r.prescription_items||[]);
  const locked=!!submission && !["draft","reopened"].includes(submission.status);
  return (
    <AppShell userName={profile?.full_name||profile?.email}>
      <section className="hero"><div><div className="eyebrow">Semana {episode.week_no} Â· {(assignment.patient as any)?.display_name}</div><h1>{episode.title}</h1><p>{episode.summary}</p></div><Link className="btn btn-secondary" href={`/student/assignments/${assignmentId}`}>Voltar ao caso</Link></section>
      <div className="row" style={{marginBottom:20}}><span className="badge">Liberado {formatDateTime(episode.release_at)}</span><span className="badge">Prazo {formatDateTime(episode.due_at)}</span>{submission ? <StatusBadge value={submission.status}/> : null}</div>
      <div className="grid grid-2" style={{marginBottom:24}}>
        <section className="card"><h2>Sinais vitais</h2>{(episode.vital_signs||[]).length?<div className="table-wrap"><table><thead><tr><th>Hora</th><th>FC</th><th>FR</th><th>PA</th><th>SpOâ‚‚</th><th>T</th></tr></thead><tbody>{(episode.vital_signs||[]).map((v:any)=><tr key={v.id}><td>{formatDateTime(v.measured_at)}</td><td>{v.heart_rate??"â€”"}</td><td>{v.respiratory_rate??"â€”"}</td><td>{v.systolic_bp??"â€”"}/{v.diastolic_bp??"â€”"}</td><td>{v.spo2??"â€”"}%</td><td>{v.temperature_c??"â€”"}Â°C</td></tr>)}</tbody></table></div>:<div className="empty">Sem registros nesta semana.</div>}</section>
        <section className="card"><h2>Exames laboratoriais</h2>{(episode.lab_results||[]).length?<div className="table-wrap"><table><thead><tr><th>Exame</th><th>Resultado</th><th>ReferÃªncia</th></tr></thead><tbody>{(episode.lab_results||[]).map((l:any)=><tr key={l.id}><td>{l.test_name}</td><td><strong>{l.value_text}</strong> {l.unit}</td><td>{l.reference_range||"â€”"}</td></tr>)}</tbody></table></div>:<div className="empty">Sem exames nesta semana.</div>}</section>
      </div>
      <div className="grid grid-2" style={{marginBottom:24}}>
        <section className="card"><h2>PrescriÃ§Ã£o</h2>{rxItems.length?<div className="stack">{rxItems.map((i:any)=><div className="card card-subtle" key={i.id}><strong>{i.drug}</strong><div>{i.concentration} Â· {i.dose} Â· {i.route} Â· {i.frequency}</div><div className="small muted">{i.indication||"Sem indicaÃ§Ã£o registrada"}</div></div>)}</div>:<div className="empty">Sem itens prescritos.</div>}</section>
        <section className="card"><h2>EvoluÃ§Ãµes e eventos</h2><div className="timeline">{[...(episode.clinical_notes||[]).map((n:any)=>({id:n.id,at:n.note_at,title:`${n.profession} Â· ${n.note_type}`,text:n.text})),...(episode.clinical_events||[]).map((e:any)=>({id:e.id,at:e.event_at,title:e.title,text:e.description}))].sort((a:any,b:any)=>new Date(a.at).getTime()-new Date(b.at).getTime()).map((n:any)=><div className="timeline-item" key={n.id}><div className="timeline-time">{formatDateTime(n.at)}</div><div className="timeline-content"><h4>{n.title}</h4><div>{n.text}</div></div></div>)}</div></section>
      </div>
      <section className="card"><div className="row-between"><h2>AvaliaÃ§Ã£o farmacÃªutica</h2>{submission?<StatusBadge value={submission.status}/>:null}</div>
        <SubmissionEditor action={saveSubmission.bind(null,assignmentId,episodeId)} initialSummary={submission?.summary||""} initialProblems={problems.map((p:any)=>({category:p.category,description:p.description,evidence:p.evidence}))} initialInterventions={interventions} initialMonitoring={monitoring} locked={locked}/>
        {submission?.feedback?.length ? <><div className="divider"/><div className="note"><strong>Feedback docente:</strong> {submission.feedback[0].text}</div></> : null}
      </section>
    </AppShell>
  );
}


