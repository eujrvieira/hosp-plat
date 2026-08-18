import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = ''

const { data, error } = await supabase.auth.admin.updateUserById(
  userId,
  {
    password: ''
  }
)

if (error) {
  console.error(error)
  process.exit(1)
}

console.log('Senha alterada com sucesso para:', data.user.email)