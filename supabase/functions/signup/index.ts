import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const { email, password, username } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // -----------------------------
    // 1. CHECK USERNAME FIRST
    // -----------------------------
    const { data: existing } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Username already taken' }),
        { status: 400 }
      )
    }

    // -----------------------------
    // 2. CREATE AUTH USER
    // -----------------------------
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: authError?.message }),
        { status: 400 }
      )
    }

    // -----------------------------
    // 3. CREATE PROFILE
    // -----------------------------
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        username,
        email,
        coins: 0,
      })

    // -----------------------------
    // 4. ROLLBACK IF PROFILE FAILS
    // -----------------------------
    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.user.id)

      return new Response(
        JSON.stringify({ error: 'Profile creation failed' }),
        { status: 400 }
      )
    }

    // -----------------------------
    // SUCCESS
    // -----------------------------
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500 }
    )
  }
})