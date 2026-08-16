import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function requireCourseStaff(courseId: string) {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .in("role", ["instructor", "assistant"])
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/dashboard");
  return { supabase, user, membership };
}
