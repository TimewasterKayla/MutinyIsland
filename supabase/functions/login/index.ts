import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const { username, password } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // service role so we can look up email
  )

  // Look up email by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .single()

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Username not found' }), { status: 400 })
  }

  // Get email from auth.users using the id
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id)

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 400 })
  }

  // Sign in with the retrieved email + supplied password
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.user.email!,
    password,
  })

  if (signInError || !signInData.session) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), { status: 401 })
  }

  return new Response(JSON.stringify({ session: signInData.session }), { status: 200 })
})