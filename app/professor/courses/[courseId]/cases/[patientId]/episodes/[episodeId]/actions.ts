"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function staff(courseId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase.from("course_memberships").select("role").eq("course_id", courseId).eq("user_id", auth.user.id).eq("status", "active").in("role", ["instructor", "assistant"]).maybeSingle();
  if (!membership) throw new Error("Sem permissão.");
  return supabase;
}

function path(courseId: string, patientId: string, episodeId: string) {
  return `/professor/courses/${courseId}/cases/${patientId}/episodes/${episodeId}`;
}

export async function addVitalSign(courseId: string, patientId: string, episodeId: string, formData: FormData) {
  const supabase = await staff(courseId);
  const row = {
    episode_id: episodeId,
    measured_at: new Date(String(formData.get("measured_at"))).toISOString(),
    heart_rate: Number(formData.get("heart_rate") || 0) || null,
    respiratory_rate: Number(formData.get("respiratory_rate") || 0) || null,
    systolic_bp: Number(formData.get("systolic_bp") || 0) || null,
    diastolic_bp: Number(formData.get("diastolic_bp") || 0) || null,
    spo2: Number(formData.get("spo2") || 0) || null,
    temperature_c: Number(formData.get("temperature_c") || 0) || null,
    pain_score: Number(formData.get("pain_score") || 0) || null,
  };
  await supabase.from("vital_signs").insert(row);
  revalidatePath(path(courseId,patientId,episodeId));
}

export async function addLabResult(courseId: string, patientId: string, episodeId: string, formData: FormData) {
  const supabase = await staff(courseId);
  await supabase.from("lab_results").insert({
    episode_id: episodeId,
    collected_at: new Date(String(formData.get("collected_at"))).toISOString(),
    test_name: String(formData.get("test_name") || "").trim(),
    value_text: String(formData.get("value_text") || "").trim(),
    unit: String(formData.get("unit") || "").trim() || null,
    reference_range: String(formData.get("reference_range") || "").trim() || null,
    flag: String(formData.get("flag") || "normal"),
  });
  revalidatePath(path(courseId,patientId,episodeId));
}

export async function addPrescriptionItem(courseId: string, patientId: string, episodeId: string, formData: FormData) {
  const supabase = await staff(courseId);
  let { data: rx } = await supabase.from("prescriptions").select("id").eq("episode_id", episodeId).eq("status", "active").maybeSingle();
  if (!rx) {
    const created = await supabase.from("prescriptions").insert({ episode_id: episodeId, prescribed_at: new Date().toISOString(), status: "active", prescriber: "Equipe assistencial" }).select("id").single();
    if (created.error || !created.data) throw new Error(created.error?.message || "Erro ao criar prescrição");
    rx = created.data;
  }
  await supabase.from("prescription_items").insert({
    prescription_id: rx.id,
    drug: String(formData.get("drug") || "").trim(),
    concentration: String(formData.get("concentration") || "").trim() || null,
    dose: String(formData.get("dose") || "").trim(),
    route: String(formData.get("route") || "").trim(),
    frequency: String(formData.get("frequency") || "").trim(),
    duration: String(formData.get("duration") || "").trim() || null,
    indication: String(formData.get("indication") || "").trim() || null,
  });
  revalidatePath(path(courseId,patientId,episodeId));
}

export async function addClinicalNote(courseId: string, patientId: string, episodeId: string, formData: FormData) {
  const supabase = await staff(courseId);
  await supabase.from("clinical_notes").insert({
    episode_id: episodeId,
    note_at: new Date(String(formData.get("note_at"))).toISOString(),
    profession: String(formData.get("profession") || "").trim(),
    note_type: String(formData.get("note_type") || "Evolução").trim(),
    text: String(formData.get("text") || "").trim(),
  });
  revalidatePath(path(courseId,patientId,episodeId));
}

export async function addClinicalEvent(courseId: string, patientId: string, episodeId: string, formData: FormData) {
  const supabase = await staff(courseId);
  await supabase.from("clinical_events").insert({
    episode_id: episodeId,
    event_at: new Date(String(formData.get("event_at"))).toISOString(),
    category: String(formData.get("category") || "Intercorrência").trim(),
    severity: String(formData.get("severity") || "moderate"),
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
  });
  revalidatePath(path(courseId,patientId,episodeId));
}
