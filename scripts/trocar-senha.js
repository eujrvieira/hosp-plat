import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = '9896a62a-1ea5-4351-818b-148571452152'

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