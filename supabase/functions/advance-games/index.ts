import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ChallengeResult = {
  day: number;
  immunity_winner: string;
  reward_winner: string;
  individual_immunity?: string;
  voted_off?: string;
};

type Lobby = {
  id: string;
  status: string | null;
  started_at: string | null;
  current_day: number | null;
  day_ends_at: string | null;
  tribe_assignments: Record<string, string> | null;
  challenge_results: ChallengeResult[] | null;
  voted_off: string[] | null;
  is_finale: boolean | null;
  finished_at: string | null;
  winner_id: string | null;
  day_duration_ms: number | null;
  voted_off_days: number[] | null;
};

type VoteRow = {
  voter_id: string;
  target_id: string;
  day: number;
};

type DbClient = SupabaseClient<any>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-advance-games-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PLAYERS = 18;
const DAY_DURATION_MS = 5 * 60 * 1000;
const MERGE_AT = 10;
const TRIBE_1 = "malolo";
const TRIBE_2 = "kaliki";
const TRIBE_RARO = "raro";
const MAX_ADVANCES_PER_RUN = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTribeKey(key?: string | null): string {
  const normalized = (key ?? "").toLowerCase().replace(/\s*tribe\s*$/i, "").trim();
  if (normalized === "malolo") return TRIBE_1;
  if (normalized === "kaliki") return TRIBE_2;
  if (normalized === "raro") return TRIBE_RARO;
  return normalized;
}

function getDayDurationMs(lobby: Lobby): number {
  const duration = Number(lobby.day_duration_ms);
  return Number.isFinite(duration) && duration > 0 ? duration : DAY_DURATION_MS;
}

function addMs(dateIso: string, ms: number): string {
  return new Date(new Date(dateIso).getTime() + ms).toISOString();
}

function randomItem<T>(items: T[]): T | null {
  return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
}

async function resolveFinale(supabase: DbClient, lobby: Lobby, now: Date) {
  const assignments = lobby.tribe_assignments ?? {};
  const votedOff = lobby.voted_off ?? [];
  const activeIds = Object.keys(assignments).filter(uid => !votedOff.includes(uid));

  const { data: finaleVotes } = await supabase
    .from("votes")
    .select("voter_id, target_id, day")
    .eq("lobby_id", lobby.id)
    .eq("day", 9999);

  const counts: Record<string, number> = {};
  ((finaleVotes ?? []) as VoteRow[]).forEach(v => {
    if (!activeIds.includes(v.target_id)) return;
    counts[v.target_id] = (counts[v.target_id] || 0) + 1;
  });

  let winner: string | null = null;
  if (Object.keys(counts).length === 0 || activeIds.length === 0) {
    winner = randomItem(activeIds);
  } else {
    const maxVotes = Math.max(...Object.values(counts));
    const tied = Object.keys(counts).filter(uid => counts[uid] === maxVotes);
    winner = randomItem(tied);
  }

  if (!winner) return { advanced: false, finished: false };

  const runnerUp = activeIds.find(uid => uid !== winner) ?? null;
  const placementWrites = [
    supabase
      .from("lobby_players")
      .update({ placement: 1, in_game: false })
      .eq("lobby_id", lobby.id)
      .eq("user_id", winner),
  ];

  if (runnerUp) {
    placementWrites.push(
      supabase
        .from("lobby_players")
        .update({ placement: 2, in_game: false })
        .eq("lobby_id", lobby.id)
        .eq("user_id", runnerUp),
    );
  }

  await Promise.all(placementWrites);

  const { error } = await supabase
    .from("lobbies")
    .update({
      finished_at: now.toISOString(),
      winner_id: winner,
      status: "finished",
    })
    .eq("id", lobby.id)
    .is("finished_at", null);

  if (error) throw error;
  return { advanced: true, finished: true };
}

async function advanceDay(supabase: DbClient, lobby: Lobby) {
  if (!lobby.day_ends_at) return { advanced: false, finished: false };

  const durationMs = getDayDurationMs(lobby);
  const currentDay = lobby.current_day ?? 1;
  const newDay = currentDay + 1;
  const prevDay = newDay - 1;
  let newResults = [...(lobby.challenge_results ?? [])];
  let newVotedOff = [...(lobby.voted_off ?? [])];
  let newVotedOffDays = [...(lobby.voted_off_days ?? [])];
  const assignments = lobby.tribe_assignments ?? {};

  const { data: dayVotes } = await supabase
    .from("votes")
    .select("voter_id, target_id, day")
    .eq("lobby_id", lobby.id)
    .eq("day", prevDay);

  const voteChallengeResult = newResults.find(r => r.day === prevDay - 1) ?? null;
  const prevDayImmune = voteChallengeResult?.individual_immunity ?? null;

  if (prevDay >= 2) {
    const activeThenIds = Object.keys(assignments).filter(uid => !newVotedOff.includes(uid));
    const activeThenIdSet = new Set(activeThenIds);
    const isMergedThen = activeThenIds.length <= MERGE_AT;
    const immunityWinnerTribe = normalizeTribeKey(voteChallengeResult?.immunity_winner);

    const getEligibleEliminationPool = () => {
      if (isMergedThen) return activeThenIds.filter(uid => uid !== prevDayImmune);
      if (!immunityWinnerTribe) return [];

      const activeTribes = [...new Set(activeThenIds.map(uid => normalizeTribeKey(assignments[uid])).filter(Boolean))];
      if (!activeTribes.includes(immunityWinnerTribe)) return [];

      const losingTribes = activeTribes.filter(tribe => tribe !== immunityWinnerTribe);
      return activeThenIds.filter(uid => losingTribes.includes(normalizeTribeKey(assignments[uid])));
    };

    let eliminated: string | null = null;
    if (dayVotes && dayVotes.length > 0) {
      const counts: Record<string, number> = {};
      ((dayVotes ?? []) as VoteRow[]).forEach(v => {
        if (prevDayImmune && v.target_id === prevDayImmune) return;
        if (!activeThenIdSet.has(v.target_id)) return;
        if (!activeThenIdSet.has(v.voter_id)) return;

        if (!isMergedThen) {
          const voterTribe = normalizeTribeKey(assignments[v.voter_id]);
          const targetTribe = normalizeTribeKey(assignments[v.target_id]);
          if (!voterTribe || voterTribe !== targetTribe) return;
          if (immunityWinnerTribe && targetTribe === immunityWinnerTribe) return;
        }

        counts[v.target_id] = (counts[v.target_id] || 0) + 1;
      });

      if (Object.keys(counts).length > 0) {
        const maxVotes = Math.max(...Object.values(counts));
        const tied = Object.keys(counts).filter(uid => counts[uid] === maxVotes);
        eliminated = randomItem(tied);
      }
    }

    if (!eliminated) {
      const pool = getEligibleEliminationPool();
      eliminated = randomItem(pool);
    }

    if (eliminated && !newVotedOff.includes(eliminated)) {
      newVotedOff = [...newVotedOff, eliminated];
      newVotedOffDays = [...newVotedOffDays, prevDay];
      let recordedBootDay = false;
      newResults = newResults.map(result => {
        if (result.day !== prevDay) return result;
        recordedBootDay = true;
        return { ...result, voted_off: eliminated };
      });
      if (!recordedBootDay) {
        newResults = [...newResults, { day: prevDay, immunity_winner: "", reward_winner: "", voted_off: eliminated }];
      }

      const placement = MAX_PLAYERS - (newVotedOff.length - 1);
      await supabase
        .from("lobby_players")
        .update({ placement, in_game: false })
        .eq("lobby_id", lobby.id)
        .eq("user_id", eliminated);
    }
  }

  const activeAfterElim = Object.keys(assignments).filter(uid => !newVotedOff.includes(uid));
  let newAssignments = assignments;
  if (activeAfterElim.length <= MERGE_AT) {
    newAssignments = { ...newAssignments };
    activeAfterElim.forEach(uid => {
      newAssignments[uid] = TRIBE_RARO;
    });
  }

  const alreadyHasResult = newResults.some(r => r.day === prevDay && !!r.immunity_winner);
  if (!alreadyHasResult && prevDay >= 1) {
    const existingResultForDay = newResults.find(r => r.day === prevDay);
    const activeChallengeIds = Object.keys(newAssignments).filter(uid => !newVotedOff.includes(uid));
    const isMergedChallenge = activeChallengeIds.length <= MERGE_AT;

    let generatedResult: ChallengeResult | null = null;
    if (isMergedChallenge) {
      const immunePlayer = randomItem(activeChallengeIds);
      if (immunePlayer) {
        generatedResult = {
          day: prevDay,
          immunity_winner: immunePlayer,
          reward_winner: immunePlayer,
          individual_immunity: immunePlayer,
        };
      }
    } else {
      const remaining = activeChallengeIds.map(uid => normalizeTribeKey(newAssignments[uid]));
      const uniqueTribes = [...new Set(remaining.filter(Boolean))];
      if (uniqueTribes.length >= 2) {
        const immunityWinner = randomItem(uniqueTribes);
        const rewardWinner = randomItem(uniqueTribes);
        if (immunityWinner && rewardWinner) {
          generatedResult = { day: prevDay, immunity_winner: immunityWinner, reward_winner: rewardWinner };
        }
      }
    }

    if (generatedResult) {
      newResults = existingResultForDay
        ? newResults.map(result => result.day === prevDay ? { ...generatedResult, voted_off: result.voted_off } : result)
        : [...newResults, generatedResult];
    }
  }

  const enterFinale = activeAfterElim.length <= 2;
  const nextEndsAt = addMs(lobby.day_ends_at, durationMs);

  const { error } = await supabase
    .from("lobbies")
    .update({
      current_day: newDay,
      day_ends_at: nextEndsAt,
      challenge_results: newResults,
      voted_off: newVotedOff,
      voted_off_days: newVotedOffDays,
      tribe_assignments: newAssignments,
      ...(enterFinale ? { is_finale: true } : {}),
    })
    .eq("id", lobby.id)
    .eq("current_day", currentDay)
    .eq("day_ends_at", lobby.day_ends_at);

  if (error) throw error;
  return { advanced: true, finished: false };
}

async function processLobby(supabase: DbClient, lobbyId: string, now = new Date()) {
  const events: string[] = [];

  for (let i = 0; i < MAX_ADVANCES_PER_RUN; i++) {
    const { data: lobby, error } = await supabase
      .from("lobbies")
      .select("*")
      .eq("id", lobbyId)
      .maybeSingle();

    if (error) throw error;
    if (!lobby) return { lobbyId, events, advanced: events.length };

    const current = lobby as Lobby;
    if (!current.started_at || current.finished_at || !current.day_ends_at) {
      return { lobbyId, events, advanced: events.length };
    }

    if (new Date(current.day_ends_at).getTime() > now.getTime()) {
      return { lobbyId, events, advanced: events.length };
    }

    if (current.is_finale) {
      const result = await resolveFinale(supabase, current, now);
      if (result.finished) events.push("finished finale");
      return { lobbyId, events, advanced: events.length };
    }

    const result = await advanceDay(supabase, current);
    if (!result.advanced) return { lobbyId, events, advanced: events.length };
    events.push(`advanced to day ${(current.current_day ?? 1) + 1}`);
  }

  return { lobbyId, events, advanced: events.length, capped: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("ADVANCE_GAMES_SECRET");
  if (secret && req.headers.get("x-advance-games-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient<any>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = new Date();

    const lobbyIds = typeof body?.lobbyId === "string"
      ? [body.lobbyId]
      : ((await supabase
        .from("lobbies")
        .select("id")
        .not("started_at", "is", null)
        .is("finished_at", null)
        .lte("day_ends_at", now.toISOString())).data ?? []).map((row: { id: string }) => row.id);

    const results = [];
    for (const lobbyId of lobbyIds) {
      results.push(await processLobby(supabase, lobbyId, now));
    }

    return json({ ok: true, checked: lobbyIds.length, results });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
