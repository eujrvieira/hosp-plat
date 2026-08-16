"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCourse(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard?error=Sem+permiss%C3%A3o+para+criar+turmas");

  const name = String(formData.get("name") || "").trim();
  const term = String(formData.get("term") || "").trim();
  const startDate = String(formData.get("start_date") || "") || null;
  const endDate = String(formData.get("end_date") || "") || null;
  if (!name || !term) redirect("/dashboard?error=Nome+e+per%C3%ADodo+s%C3%A3o+obrigat%C3%B3rios");

  const { data, error } = await supabase
    .from("courses")
    .insert({ name, term, start_date: startDate, end_date: endDate, owner_id: auth.user.id, status: "active" })
    .select("id")
    .single();

  if (error || !data) redirect(`/dashboard?error=${encodeURIComponent(error?.message || "Erro ao criar turma")}`);
  revalidatePath("/dashboard");
  redirect(`/professor/courses/${data.id}`);
}
