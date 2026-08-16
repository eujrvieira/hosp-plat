"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const payloadSchema = z.object({
  problems: z.array(z.object({ category:z.string().min(1), description:z.string().min(1), evidence:z.string().min(1) })).min(1),
  interventions: z.array(z.object({ problemIndex:z.number().int().min(0), recommendation:z.string().min(1), priority:z.enum(["low","moderate","high","critical"]), target:z.string() })),
  monitoring: z.array(z.object({ problemIndex:z.number().int().min(0), parameter:z.string().min(1), target:z.string(), timeframe:z.string() })),
});

export async function saveSubmission(assignmentId: string, episodeId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const summary = String(formData.get("summary") || "").trim();
  const intent = String(formData.get("intent") || "save");
  const raw = String(formData.get("payload") || "{}");
  const parsed = payloadSchema.safeParse(JSON.parse(raw));
  if (!summary || !parsed.success) throw new Error("Preencha a síntese, os problemas e os parâmetros obrigatórios.");

  const { data: assignment } = await supabase.from("case_assignments").select("id,course_id").eq("id", assignmentId).maybeSingle();
  if (!assignment) throw new Error("Atribuição não encontrada.");

  const { data: existing } = await supabase.from("student_submissions").select("id,status,version_no").eq("assignment_id", assignmentId).eq("episode_id", episodeId).order("version_no", {ascending:false}).limit(1).maybeSingle();
  if (existing && !["draft","reopened"].includes(existing.status)) throw new Error("A versão enviada está bloqueada.");

  let submissionId = existing?.id;
  if (!submissionId) {
    const { data, error } = await supabase.from("student_submissions").insert({ assignment_id:assignmentId, episode_id:episodeId, version_no:1, status:"draft", summary }).select("id").single();
    if (error || !data) throw new Error(error?.message || "Falha ao criar rascunho.");
    submissionId = data.id;
  } else {
    const { error } = await supabase.from("student_submissions").update({ summary }).eq("id", submissionId);
    if (error) throw new Error(error.message);
    await supabase.from("monitoring_plans").delete().eq("submission_id", submissionId);
    await supabase.from("pharm_interventions").delete().eq("submission_id", submissionId);
    await supabase.from("med_related_problems").delete().eq("submission_id", submissionId);
  }

  const problemRows = parsed.data.problems.map((p,idx)=>({submission_id:submissionId,sort_order:idx+1,...p}));
  const { data: insertedProblems, error: problemError } = await supabase.from("med_related_problems").insert(problemRows).select("id,sort_order").order("sort_order");
  if (problemError || !insertedProblems) throw new Error(problemError?.message || "Falha ao salvar problemas.");

  const problemId = (index:number) => insertedProblems[index]?.id;
  const interventionRows = parsed.data.interventions.filter(i=>problemId(i.problemIndex)).map(i=>({submission_id:submissionId,problem_id:problemId(i.problemIndex),recommendation:i.recommendation,priority:i.priority,target:i.target || null}));
  if (interventionRows.length) {
    const r = await supabase.from("pharm_interventions").insert(interventionRows);
    if (r.error) throw new Error(r.error.message);
  }
  const monitoringRows = parsed.data.monitoring.filter(i=>problemId(i.problemIndex)).map(i=>({submission_id:submissionId,problem_id:problemId(i.problemIndex),parameter:i.parameter,target:i.target || null,timeframe:i.timeframe || null}));
  if (monitoringRows.length) {
    const r = await supabase.from("monitoring_plans").insert(monitoringRows);
    if (r.error) throw new Error(r.error.message);
  }

  if (intent === "submit") {
    const { data: groupMembers } = await supabase.rpc("submission_author_snapshot", { p_assignment_id: assignmentId });
    const { error } = await supabase.from("student_submissions").update({ status:"submitted",submitted_at:new Date().toISOString(),locked_at:new Date().toISOString(),author_snapshot:groupMembers || [] }).eq("id", submissionId);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/student/assignments/${assignmentId}/episodes/${episodeId}`);
  revalidatePath(`/student/assignments/${assignmentId}`);
}
