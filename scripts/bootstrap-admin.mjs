import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2]?.trim().toLowerCase();

if (!url || !serviceRole) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email) {
  console.error("Uso: node scripts/bootstrap-admin.mjs seu-email@dominio.com");
  process.exit(1);
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profile, error } = await admin.from("profiles").select("id,email,full_name").eq("email", email).maybeSingle();
if (error) throw error;
if (!profile) {
  console.error("Usuário não encontrado. Crie primeiro a conta no Supabase Auth e tente novamente.");
  process.exit(1);
}
const { error: insertError } = await admin.from("platform_admins").upsert({ user_id: profile.id });
if (insertError) throw insertError;
console.log(`OK: ${profile.email} agora pode criar turmas.`);
