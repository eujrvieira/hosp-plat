import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
const db = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

const teacherEmail = process.env.DEMO_TEACHER_EMAIL || "professor.demo@example.com";
const studentEmail = process.env.DEMO_STUDENT_EMAIL || "aluno.demo@example.com";
const password = process.env.DEMO_PASSWORD || "Troque-Esta-Senha-123!";

async function ensureUser(email, fullName) {
  const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw error || new Error("Falha ao criar usuário");
  return data.user.id;
}

const teacherId = await ensureUser(teacherEmail, "Professor Demo");
const studentId = await ensureUser(studentEmail, "Aluno Demo");
await db.from("platform_admins").upsert({ user_id: teacherId });

let { data: course } = await db.from("courses").select("id").eq("name", "Farmácia Hospitalar — Demo").maybeSingle();
if (!course) {
  const created = await db.from("courses").insert({ name: "Farmácia Hospitalar — Demo", term: "DEMO", owner_id: teacherId, status: "active" }).select("id").single();
  if (created.error) throw created.error;
  course = created.data;
}
await db.from("course_memberships").upsert({ course_id: course.id, user_id: studentId, role: "student", status: "active", joined_at: new Date().toISOString() }, { onConflict: "course_id,user_id" });

let { data: group } = await db.from("student_groups").select("id").eq("course_id", course.id).eq("name", "Grupo Demo").maybeSingle();
if (!group) {
  const created = await db.from("student_groups").insert({ course_id: course.id, name: "Grupo Demo" }).select("id").single();
  if (created.error) throw created.error;
  group = created.data;
}
await db.from("group_members").upsert({ group_id: group.id, user_id: studentId }, { onConflict: "group_id,user_id" });

let { data: patient } = await db.from("simulated_patients").select("id").eq("course_id", course.id).eq("code", "SIM-DEMO-001").maybeSingle();
if (!patient) {
  const t = await db.from("case_templates").insert({ owner_id: teacherId, title: "Sepse de foco pulmonar — Demo", description: "Caso demonstrativo" }).select("id").single();
  if (t.error) throw t.error;
  const p = await db.from("simulated_patients").insert({
    course_id: course.id,
    case_template_id: t.data.id,
    code: "SIM-DEMO-001",
    display_name: "Paciente Aurora",
    age: 67,
    sex: "F",
    weight_kg: 62,
    height_cm: 158,
    baseline_summary: "Paciente fictícia, admitida com febre, dispneia e hipótese de pneumonia comunitária. Evolução longitudinal destinada exclusivamente ao ensino."
  }).select("id").single();
  if (p.error) throw p.error;
  patient = p.data;
}

let { data: assignment } = await db.from("case_assignments").select("id").eq("course_id", course.id).eq("patient_id", patient.id).eq("group_id", group.id).maybeSingle();
if (!assignment) {
  const a = await db.from("case_assignments").insert({ course_id: course.id, patient_id: patient.id, group_id: group.id, current_branch_key: "main", state: "active", started_at: new Date().toISOString() }).select("id").single();
  if (a.error) throw a.error;
  assignment = a.data;
}

let { data: episode } = await db.from("case_episodes").select("id").eq("patient_id", patient.id).eq("week_no", 1).eq("branch_key", "main").maybeSingle();
if (!episode) {
  const e = await db.from("case_episodes").insert({
    patient_id: patient.id,
    week_no: 1,
    branch_key: "main",
    title: "Admissão hospitalar",
    summary: "Nas primeiras horas de internação, a paciente apresenta febre, taquicardia e necessidade de oxigênio suplementar.",
    release_at: new Date(Date.now() - 3600_000).toISOString(),
    due_at: new Date(Date.now() + 7 * 86400_000).toISOString()
  }).select("id").single();
  if (e.error) throw e.error;
  episode = e.data;
  await db.from("episode_teacher_notes").insert({ episode_id: episode.id, note: "Nota oculta de demonstração: avaliar ajuste de antimicrobiano após função renal." });
  await db.from("vital_signs").insert({ episode_id: episode.id, measured_at: new Date().toISOString(), heart_rate: 112, respiratory_rate: 26, systolic_bp: 102, diastolic_bp: 64, spo2: 92, temperature_c: 38.6, pain_score: 2 });
  await db.from("lab_results").insert([
    { episode_id: episode.id, collected_at: new Date().toISOString(), test_name: "Creatinina", value_text: "1,8", unit: "mg/dL", reference_range: "0,6–1,2", flag: "high" },
    { episode_id: episode.id, collected_at: new Date().toISOString(), test_name: "Leucócitos", value_text: "18.400", unit: "/mm³", reference_range: "4.000–11.000", flag: "high" }
  ]);
  const rx = await db.from("prescriptions").insert({ episode_id: episode.id, prescribed_at: new Date().toISOString(), prescriber: "Equipe médica", status: "active" }).select("id").single();
  if (rx.error) throw rx.error;
  await db.from("prescription_items").insert([
    { prescription_id: rx.data.id, drug: "Ceftriaxona", concentration: "1 g", dose: "2 g", route: "IV", frequency: "1x/dia", indication: "Pneumonia" },
    { prescription_id: rx.data.id, drug: "Azitromicina", concentration: "500 mg", dose: "500 mg", route: "IV", frequency: "1x/dia", indication: "Pneumonia" }
  ]);
  await db.from("clinical_notes").insert({ episode_id: episode.id, note_at: new Date().toISOString(), profession: "Medicina", note_type: "Admissão", text: "Iniciada antibioticoterapia empírica e oxigenoterapia. Coletadas culturas antes do antimicrobiano." });
}

console.log("Demo criada.");
console.log(`Professor: ${teacherEmail}`);
console.log(`Aluno: ${studentEmail}`);
console.log(`Senha demo: ${password}`);
