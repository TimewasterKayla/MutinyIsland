import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------------------------------
    // 1. CHECK USERNAME FIRST
    // ---------------------------------
    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: "Username already taken",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ---------------------------------
    // 2. CREATE AUTH USER (email_confirm: false → sends confirmation email)
    // ---------------------------------
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

    if (authError || !authUser.user) {
      return new Response(
        JSON.stringify({
          error: authError?.message || "Auth creation failed",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ---------------------------------
    // 3. CREATE PROFILE
    // ---------------------------------
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.user.id,
        username,
        email,
        coins: 0,
      });

    // ---------------------------------
    // 4. ROLLBACK IF PROFILE FAILS
    // ---------------------------------
    if (profileError) {
      await supabase.auth.admin.deleteUser(
        authUser.user.id
      );

      return new Response(
        JSON.stringify({
          error: "Profile creation failed",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ---------------------------------
    // SUCCESS
    // ---------------------------------
    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});