"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function staff(courseId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("course_memberships").select("role").eq("course_id", courseId).eq("user_id", auth.user.id).eq("status", "active").in("role", ["instructor", "assistant"]).maybeSingle();
  if (!membership) throw new Error("Sem permissão.");
  return { supabase, user: auth.user };
}

export async function createPatient(courseId: string, formData: FormData) {
  const { supabase, user } = await staff(courseId);
  const code = String(formData.get("code") || "").trim();
  const displayName = String(formData.get("display_name") || "").trim();
  const age = Number(formData.get("age") || 0) || null;
  const sex = String(formData.get("sex") || "").trim() || null;
  const weightKg = Number(formData.get("weight_kg") || 0) || null;
  const heightCm = Number(formData.get("height_cm") || 0) || null;
  const baselineSummary = String(formData.get("baseline_summary") || "").trim();
  if (!code || !displayName || !baselineSummary) return;

  const { data: template, error: templateError } = await supabase.from("case_templates").insert({
    owner_id: user.id,
    title: `${displayName} — ${code}`,
    description: baselineSummary,
  }).select("id").single();
  if (templateError || !template) throw new Error(templateError?.message || "Erro ao criar template.");

  const { data: patient, error } = await supabase.from("simulated_patients").insert({
    course_id: courseId,
    case_template_id: template.id,
    code,
    display_name: displayName,
    age,
    sex,
    weight_kg: weightKg,
    height_cm: heightCm,
    baseline_summary: baselineSummary,
  }).select("id").single();
  if (error || !patient) throw new Error(error?.message || "Erro ao criar paciente.");
  revalidatePath(`/professor/courses/${courseId}/cases`);
  redirect(`/professor/courses/${courseId}/cases/${patient.id}`);
}

export async function createEpisode(
  courseId: string,
  patientId: string,
  formData: FormData
) {
  // Primeiro confirma que o usuário logado é professor/assistente da turma
  await staff(courseId);

  // Cliente administrativo: usado somente no servidor
  const admin = createAdminClient();

  // Confirma que o paciente realmente pertence à turma informada
  const { data: patient, error: patientError } = await admin
    .from("simulated_patients")
    .select("id, course_id")
    .eq("id", patientId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (patientError || !patient) {
    throw new Error("Paciente não pertence a esta turma.");
  }

  const weekNo = Number(formData.get("week_no"));
  const title = String(formData.get("title") || "").trim();
  const branchKey =
    String(formData.get("branch_key") || "main").trim() || "main";
  const summary = String(formData.get("summary") || "").trim();
  const teacherOnlyNotes =
    String(formData.get("teacher_only_notes") || "").trim() || null;
  const releaseAtRaw = String(formData.get("release_at") || "");
  const dueAtRaw = String(formData.get("due_at") || "");
  const isFinal = formData.get("is_final") === "on";

  if (!weekNo || !title || !summary || !releaseAtRaw) {
    throw new Error("Preencha os campos obrigatórios do episódio.");
  }

  const { data, error } = await admin
    .from("case_episodes")
    .insert({
      patient_id: patientId,
      week_no: weekNo,
      title,
      branch_key: branchKey,
      summary,
      release_at: new Date(releaseAtRaw).toISOString(),
      due_at: dueAtRaw
        ? new Date(dueAtRaw).toISOString()
        : null,
      is_final: isFinal,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Erro ao criar episódio.");
  }

  if (teacherOnlyNotes) {
    const { error: noteError } = await admin
      .from("episode_teacher_notes")
      .insert({
        episode_id: data.id,
        note: teacherOnlyNotes,
      });

    if (noteError) {
      throw new Error(noteError.message);
    }
  }

  revalidatePath(
    `/professor/courses/${courseId}/cases/${patientId}`
  );

  redirect(
    `/professor/courses/${courseId}/cases/${patientId}/episodes/${data.id}`
  );
}

export async function assignPatient(courseId: string, patientId: string, formData: FormData) {
  const { supabase } = await staff(courseId);
  const mode = String(formData.get("mode") || "group");
  const targetId = String(formData.get("target_id") || "");
  const branch = String(formData.get("branch_key") || "main").trim() || "main";
  if (!targetId) return;
  const row: any = { course_id: courseId, patient_id: patientId, current_branch_key: branch, state: "active", started_at: new Date().toISOString(), group_id: null, student_id: null };
  if (mode === "group") row.group_id = targetId; else row.student_id = targetId;
  const { error } = await supabase.from("case_assignments").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath(`/professor/courses/${courseId}/cases/${patientId}`);
}

export async function setAssignmentBranch(courseId: string, patientId: string, assignmentId: string, formData: FormData) {
  const { supabase } = await staff(courseId);
  const branchKey = String(formData.get("branch_key") || "main").trim() || "main";
  await supabase.from("case_assignments").update({ current_branch_key: branchKey }).eq("id", assignmentId).eq("course_id", courseId);
  revalidatePath(`/professor/courses/${courseId}/cases/${patientId}`);
}

export async function completeAssignment(courseId: string, patientId: string, assignmentId: string) {
  const { supabase } = await staff(courseId);
  await supabase.from("case_assignments").update({ state: "completed", completed_at: new Date().toISOString() }).eq("id", assignmentId).eq("course_id", courseId);
  revalidatePath(`/professor/courses/${courseId}/cases/${patientId}`);
}
