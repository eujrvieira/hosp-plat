"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function assertStaff(courseId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase
    .from("course_memberships").select("role,status").eq("course_id", courseId).eq("user_id", auth.user.id)
    .in("role", ["instructor", "assistant"]).eq("status", "active").maybeSingle();
  if (!membership) throw new Error("Sem permissão para gerenciar esta turma.");
  return { supabase, user: auth.user };
}

export async function inviteMember(courseId: string, formData: FormData) {
  const { supabase, user } = await assertStaff(courseId);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "student");
  if (!email || !["student", "assistant", "instructor"].includes(role)) return;

  const admin = createAdminClient();
  const { data: existingProfile } = await admin.from("profiles").select("id,email").eq("email", email).maybeSingle();
  let userId = existingProfile?.id;
  let newInvite = false;

  if (!userId) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      data: { full_name: fullName || email.split("@")[0] },
    });
    if (error || !data.user) throw new Error(error?.message || "Falha ao criar convite.");
    userId = data.user.id;
    newInvite = true;
  }

  await admin.from("profiles").upsert({ id: userId, email, full_name: fullName || null }, { onConflict: "id" });
  const { error: membershipError } = await admin.from("course_memberships").upsert({
    course_id: courseId,
    user_id: userId,
    role,
    status: newInvite ? "invited" : "active",
    joined_at: newInvite ? null : new Date().toISOString(),
  }, { onConflict: "course_id,user_id" });
  if (membershipError) throw new Error(membershipError.message);

  await admin.from("invitations").insert({
    course_id: courseId, email, role, invited_by: user.id, status: newInvite ? "sent" : "accepted"
  });
  revalidatePath(`/professor/courses/${courseId}/users`);
}

export async function setMembershipStatus(courseId: string, membershipId: string, status: "active" | "suspended" | "archived") {
  await assertStaff(courseId);
  const admin = createAdminClient();
  await admin.from("course_memberships").update({ status }).eq("id", membershipId).eq("course_id", courseId);
  revalidatePath(`/professor/courses/${courseId}/users`);
}

export async function createGroup(courseId: string, formData: FormData) {
  const { supabase } = await assertStaff(courseId);
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await supabase.from("student_groups").insert({ course_id: courseId, name });
  revalidatePath(`/professor/courses/${courseId}/users`);
}

export async function addStudentToGroup(courseId: string, formData: FormData) {
  const { supabase } = await assertStaff(courseId);
  const groupId = String(formData.get("group_id") || "");
  const userId = String(formData.get("user_id") || "");
  if (!groupId || !userId) return;
  await supabase.from("group_members").upsert({ group_id: groupId, user_id: userId }, { onConflict: "group_id,user_id" });
  revalidatePath(`/professor/courses/${courseId}/users`);
}

export async function removeStudentFromGroup(courseId: string, groupId: string, userId: string) {
  const { supabase } = await assertStaff(courseId);
  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  revalidatePath(`/professor/courses/${courseId}/users`);
}
