import { createClient } from "@supabase/supabase-js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { postId, pin } = await req.json();
    if (!postId || typeof pin !== "boolean") {
      return new Response(JSON.stringify({ error: "postId and pin (boolean) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ---------------------------------
    // VERIFY CALLER IS AUTHENTICATED + ADMIN
    // ---------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Validate the caller's JWT and get their user id
    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (profileError || !callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ---------------------------------
    // ENFORCE MAX 5 PINNED POSTS (also enforced by DB trigger as a backstop)
    // ---------------------------------
    if (pin) {
      const { count, error: countError } = await supabaseAdmin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("is_pinned", true);
      if (countError) {
        return new Response(JSON.stringify({ error: "Failed to check pinned count" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((count ?? 0) >= 5) {
        return new Response(JSON.stringify({ error: "Maximum of 5 pinned posts reached. Unpin one first." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // ---------------------------------
    // APPLY PIN / UNPIN
    // ---------------------------------
    const { error: updateError } = await supabaseAdmin
      .from("posts")
      .update({
        is_pinned: pin,
        pinned_at: pin ? new Date().toISOString() : null,
      })
      .eq("id", postId);
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, pinned: pin }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});