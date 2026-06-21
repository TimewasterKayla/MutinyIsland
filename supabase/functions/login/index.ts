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
  console.log('[login_ips debug] raw x-forwarded-for header:', forwardedFor)
  console.log('[login_ips debug] parsed clientIp:', clientIp)

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
  console.log('[login_ips debug] entering IP tracking block, clientIp is:', clientIp, 'profile.id:', profile.id)

  // TEMP: confirm the service role key is actually present and well-formed
  const keyUsed = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  console.log('[login_ips debug] service key length:', keyUsed.length, 'starts with:', keyUsed.slice(0, 12))
  // Decode the JWT payload (middle segment) to see the "role" claim — no signature verification needed for this debug check
  try {
    const payloadSegment = keyUsed.split('.')[1]
    const decoded = JSON.parse(atob(payloadSegment))
    console.log('[login_ips debug] JWT role claim:', decoded.role, 'ref:', decoded.ref)
  } catch (e) {
    console.log('[login_ips debug] could not decode key payload:', e)
  }

  if (clientIp) {
    try {
      // Upsert: if this IP is already on file for this user, just bump
      // last_used_at. Otherwise insert a new row.
      const { data: upsertData, error: upsertError } = await supabase
        .from('login_ips')
        .upsert(
          { user_id: profile.id, ip_address: clientIp, last_used_at: new Date().toISOString() },
          { onConflict: 'user_id,ip_address' }
        )
        .select()

      console.log('[login_ips debug] upsert data:', JSON.stringify(upsertData))
      console.log('[login_ips debug] upsert error:', JSON.stringify(upsertError))

      // Trim to the MAX_LOGIN_IPS most recent distinct IPs for this user.
      const { data: ipRows, error: selectError } = await supabase
        .from('login_ips')
        .select('id, last_used_at')
        .eq('user_id', profile.id)
        .order('last_used_at', { ascending: false })

      console.log('[login_ips debug] ipRows after upsert:', JSON.stringify(ipRows))
      console.log('[login_ips debug] select error:', JSON.stringify(selectError))

      if (ipRows && ipRows.length > MAX_LOGIN_IPS) {
        const staleIds = ipRows.slice(MAX_LOGIN_IPS).map((r) => r.id)
        const { error: deleteError } = await supabase.from('login_ips').delete().in('id', staleIds)
        console.log('[login_ips debug] delete error:', JSON.stringify(deleteError))
      }
    } catch (err) {
      // Don't fail the login just because IP logging hiccuped.
      console.error('[login_ips debug] thrown exception:', err)
    }
  } else {
    console.log('[login_ips debug] skipped — clientIp was falsy')
  }

  return new Response(JSON.stringify({ session: signInData.session }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})