import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Keep this in sync with the avatars array in profile/[id]/page.tsx
const avatars = [
  "/avatars/jess.png",
  "/avatars/laffite.png",
  "/avatars/malley.png",
  "/avatars/morgan.png",
  "/avatars/read.png",
];

Deno.serve(async (req) => {

  // ---------------------------------
  // HANDLE CORS PREFLIGHT REQUEST
  // ---------------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { email, password, username } = await req.json();

    // ---------------------------------
    // GET CLIENT IP
    // ---------------------------------
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    // Admin client for DB operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Anon client for auth signup (triggers confirmation email)
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // ---------------------------------
    // 1. CHECK USERNAME FIRST
    // ---------------------------------
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Username already taken" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---------------------------------
    // 2. CREATE AUTH USER via signUp (triggers confirmation email)
    // ---------------------------------
    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Auth creation failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---------------------------------
    // 3. CREATE PROFILE
    // ---------------------------------
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        username,
        email,
        coins: 0,
        avatar: randomAvatar,
        signup_ip: clientIp,
      });

    // ---------------------------------
    // 4. ROLLBACK IF PROFILE FAILS
    // ---------------------------------
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return new Response(
        JSON.stringify({ error: "Profile creation failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---------------------------------
    // SUCCESS
    // ---------------------------------
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});