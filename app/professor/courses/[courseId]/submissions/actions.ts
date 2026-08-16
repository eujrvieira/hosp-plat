"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function staff(courseId:string){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user) redirect("/login");
  const {data:m}=await supabase.from("course_memberships").select("role").eq("course_id",courseId).eq("user_id",auth.user.id).eq("status","active").in("role",["instructor","assistant"]).maybeSingle();
  if(!m) throw new Error("Sem permissão.");
  return {supabase,user:auth.user};
}

export async function gradeSubmission(courseId:string, submissionId:string, formData:FormData){
  const {supabase,user}=await staff(courseId);
  const totalPoints=Number(formData.get("total_points")||0);
  const text=String(formData.get("feedback")||"").trim();
  const releaseNow=formData.get("release_now")==="on";
  const {data:score,error}=await supabase.from("scores").upsert({submission_id:submissionId,total_points:totalPoints,graded_by:user.id,graded_at:new Date().toISOString()},{onConflict:"submission_id"}).select("id").single();
  if(error||!score) throw new Error(error?.message||"Falha ao salvar nota.");
  const {data:existingFeedback}=await supabase.from("feedback").select("id").eq("submission_id",submissionId).maybeSingle();
  if(existingFeedback){
    await supabase.from("feedback").update({text,released_at:releaseNow?new Date().toISOString():null,author_id:user.id}).eq("id",existingFeedback.id);
  }else{
    await supabase.from("feedback").insert({submission_id:submissionId,text,released_at:releaseNow?new Date().toISOString():null,author_id:user.id});
  }
  await supabase.from("student_submissions").update({status:"graded"}).eq("id",submissionId);
  revalidatePath(`/professor/courses/${courseId}/submissions`);
  revalidatePath(`/professor/courses/${courseId}/submissions/${submissionId}`);
}

export async function reopenSubmission(courseId:string, submissionId:string){
  const {supabase}=await staff(courseId);
  await supabase.from("student_submissions").update({status:"reopened",locked_at:null}).eq("id",submissionId);
  revalidatePath(`/professor/courses/${courseId}/submissions/${submissionId}`);
}
