"use client";

import { useMemo, useState } from "react";

type Problem = { category: string; description: string; evidence: string };
type Intervention = { problemIndex: number; recommendation: string; priority: "low"|"moderate"|"high"|"critical"; target: string };
type Monitoring = { problemIndex: number; parameter: string; target: string; timeframe: string };

export function SubmissionEditor({
  action,
  initialSummary = "",
  initialProblems = [],
  initialInterventions = [],
  initialMonitoring = [],
  locked = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialSummary?: string;
  initialProblems?: Problem[];
  initialInterventions?: Intervention[];
  initialMonitoring?: Monitoring[];
  locked?: boolean;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [problems, setProblems] = useState<Problem[]>(initialProblems.length ? initialProblems : [{category:"",description:"",evidence:""}]);
  const [interventions, setInterventions] = useState<Intervention[]>(initialInterventions.length ? initialInterventions : [{problemIndex:0,recommendation:"",priority:"moderate",target:""}]);
  const [monitoring, setMonitoring] = useState<Monitoring[]>(initialMonitoring.length ? initialMonitoring : [{problemIndex:0,parameter:"",target:"",timeframe:""}]);
  const payload = useMemo(() => JSON.stringify({ problems, interventions, monitoring }), [problems, interventions, monitoring]);

  function updateProblem(i:number, key:keyof Problem, value:string) {
    setProblems(prev => prev.map((p,idx)=> idx===i ? {...p,[key]:value}:p));
  }
  function updateIntervention(i:number, key:keyof Intervention, value:string|number) {
    setInterventions(prev => prev.map((p,idx)=> idx===i ? {...p,[key]:value}:p));
  }
  function updateMonitoring(i:number, key:keyof Monitoring, value:string|number) {
    setMonitoring(prev => prev.map((p,idx)=> idx===i ? {...p,[key]:value}:p));
  }

  function removeProblem(index:number) {
    setProblems(prev => prev.filter((_,idx)=>idx!==index));
    setInterventions(prev => prev
      .filter(item => item.problemIndex !== index)
      .map(item => ({...item, problemIndex: item.problemIndex > index ? item.problemIndex - 1 : item.problemIndex})));
    setMonitoring(prev => prev
      .filter(item => item.problemIndex !== index)
      .map(item => ({...item, problemIndex: item.problemIndex > index ? item.problemIndex - 1 : item.problemIndex})));
  }

  return (
    <form action={action} className="stack">
      <input type="hidden" name="payload" value={payload} />
      <div className="field">
        <label>Síntese farmacêutica</label>
        <textarea className="textarea" name="summary" value={summary} onChange={e=>setSummary(e.target.value)} disabled={locked} required />
      </div>

      <div className="divider" />
      <div className="row-between"><h3 style={{margin:0}}>Problemas relacionados a medicamentos</h3>{!locked ? <button type="button" className="btn btn-secondary btn-small" onClick={()=>setProblems(p=>[...p,{category:"",description:"",evidence:""}])}>Adicionar problema</button> : null}</div>
      {problems.map((p,i)=><div className="card card-subtle" key={i}>
        <div className="row-between"><strong>Problema {i+1}</strong>{!locked && problems.length>1 ? <button type="button" className="btn btn-secondary btn-small" onClick={()=>removeProblem(i)}>Remover</button>:null}</div>
        <div className="form-grid" style={{marginTop:12}}>
          <div className="field"><label>Categoria</label><select className="select" value={p.category} onChange={e=>updateProblem(i,"category",e.target.value)} disabled={locked} required><option value="">Selecione</option><option value="necessidade">Necessidade</option><option value="efetividade">Efetividade</option><option value="seguranca">Segurança</option><option value="adesao">Adesão</option><option value="logistica">Logística</option><option value="outro">Outro</option></select></div>
          <div className="field"><label>Descrição</label><input className="input" value={p.description} onChange={e=>updateProblem(i,"description",e.target.value)} disabled={locked} required /></div>
          <div className="field span-2"><label>Evidências do caso</label><textarea className="textarea" value={p.evidence} onChange={e=>updateProblem(i,"evidence",e.target.value)} disabled={locked} required /></div>
        </div>
      </div>)}

      <div className="divider" />
      <div className="row-between"><h3 style={{margin:0}}>Intervenções farmacêuticas</h3>{!locked ? <button type="button" className="btn btn-secondary btn-small" onClick={()=>setInterventions(p=>[...p,{problemIndex:0,recommendation:"",priority:"moderate",target:""}])}>Adicionar intervenção</button> : null}</div>
      {interventions.map((it,i)=><div className="card card-subtle" key={i}><div className="form-grid">
        <div className="field"><label>Problema relacionado</label><select className="select" value={it.problemIndex} onChange={e=>updateIntervention(i,"problemIndex",Number(e.target.value))} disabled={locked}>{problems.map((_,idx)=><option key={idx} value={idx}>Problema {idx+1}</option>)}</select></div>
        <div className="field"><label>Prioridade</label><select className="select" value={it.priority} onChange={e=>updateIntervention(i,"priority",e.target.value)} disabled={locked}><option value="low">Baixa</option><option value="moderate">Moderada</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div>
        <div className="field"><label>Profissional-alvo</label><input className="input" value={it.target} onChange={e=>updateIntervention(i,"target",e.target.value)} disabled={locked} placeholder="Médico, enfermagem, paciente..." /></div>
        <div className="field span-2"><label>Recomendação</label><textarea className="textarea" value={it.recommendation} onChange={e=>updateIntervention(i,"recommendation",e.target.value)} disabled={locked} required /></div>
      </div>{!locked && interventions.length>1 ? <button type="button" className="btn btn-secondary btn-small" onClick={()=>setInterventions(prev=>prev.filter((_,idx)=>idx!==i))}>Remover intervenção</button>:null}</div>)}

      <div className="divider" />
      <div className="row-between"><h3 style={{margin:0}}>Plano de monitoramento</h3>{!locked ? <button type="button" className="btn btn-secondary btn-small" onClick={()=>setMonitoring(p=>[...p,{problemIndex:0,parameter:"",target:"",timeframe:""}])}>Adicionar parâmetro</button> : null}</div>
      {monitoring.map((m,i)=><div className="card card-subtle" key={i}><div className="form-grid">
        <div className="field"><label>Problema relacionado</label><select className="select" value={m.problemIndex} onChange={e=>updateMonitoring(i,"problemIndex",Number(e.target.value))} disabled={locked}>{problems.map((_,idx)=><option key={idx} value={idx}>Problema {idx+1}</option>)}</select></div>
        <div className="field"><label>Parâmetro</label><input className="input" value={m.parameter} onChange={e=>updateMonitoring(i,"parameter",e.target.value)} disabled={locked} required /></div>
        <div className="field"><label>Meta</label><input className="input" value={m.target} onChange={e=>updateMonitoring(i,"target",e.target.value)} disabled={locked} /></div>
        <div className="field"><label>Prazo</label><input className="input" value={m.timeframe} onChange={e=>updateMonitoring(i,"timeframe",e.target.value)} disabled={locked} placeholder="24 h, próxima semana..." /></div>
      </div>{!locked && monitoring.length>1 ? <button type="button" className="btn btn-secondary btn-small" onClick={()=>setMonitoring(prev=>prev.filter((_,idx)=>idx!==i))}>Remover parâmetro</button>:null}</div>)}

      {!locked ? <div className="row"><button className="btn btn-secondary" name="intent" value="save" type="submit">Salvar rascunho</button><button className="btn" name="intent" value="submit" type="submit">Enviar semana</button></div> : <div className="note">Esta versão já foi enviada e está bloqueada para edição.</div>}
    </form>
  );
}
