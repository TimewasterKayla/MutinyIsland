import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_LOGIN_IPS = 5

Deno.serve(async (req) => {

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { username, password } = await req.json()

  // ---------------------------------
  // GET CLIENT IP
  // ---------------------------------
  // Supabase Edge Functions run behind a proxy that sets x-forwarded-for.
  // It can contain a comma-separated list (client, proxy1, proxy2...);
  // the first entry is the original client.
  const forwardedFor = req.headers.get('x-forwarded-for')
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .single()

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Username not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id)

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ---------------------------------
  // CHECK EMAIL IS CONFIRMED
  // ---------------------------------
  if (!userData.user.email_confirmed_at) {
    return new Response(JSON.stringify({ error: 'Please confirm your email before logging in' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.user.email!,
    password,
  })

  if (signInError || !signInData.session) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ---------------------------------
  // RECORD LOGIN IP (best-effort — never blocks login on failure)
  // ---------------------------------
  if (clientIp) {
    try {
      // Upsert: if this IP is already on file for this user, just bump
      // last_used_at. Otherwise insert a new row.
      await supabase
        .from('login_ips')
        .upsert(
          { user_id: profile.id, ip_address: clientIp, last_used_at: new Date().toISOString() },
          { onConflict: 'user_id,ip_address' }
        )

      // Trim to the MAX_LOGIN_IPS most recent distinct IPs for this user.
      const { data: ipRows } = await supabase
        .from('login_ips')
        .select('id, last_used_at')
        .eq('user_id', profile.id)
        .order('last_used_at', { ascending: false })

      if (ipRows && ipRows.length > MAX_LOGIN_IPS) {
        const staleIds = ipRows.slice(MAX_LOGIN_IPS).map((r) => r.id)
        await supabase.from('login_ips').delete().in('id', staleIds)
      }
    } catch (err) {
      // Don't fail the login just because IP logging hiccuped.
      console.error('login_ips tracking failed:', err)
    }
  }

  return new Response(JSON.stringify({ session: signInData.session }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})