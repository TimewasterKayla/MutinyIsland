"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  username: string
  avatar: string | null
  rank: string | null
  crowns: number
  login_streak: number
  cc_seasons_won: number
  cc_votes_received: number
  cc_challenges_won: number
}

type PlayerSection =
  | "crowns"
  | "wins"
  | "ranks"
  | "streak"
  | "castaway_cove"

// ─── Constants ────────────────────────────────────────────────────────────────

const RANK_LIST = [
  "Peasant",
  "Villager",
  "Merchant",
  "Banker",
  "Squire",
  "Knight",
  "Lord",
  "Baron",
  "Count",
  "Duke",
  "Archduke",
  "Royalty",
  "Legend",
]

const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" }

const ROW_BG: Record<number, string> = {
  0: "bg-yellow-500/10",
  1: "bg-zinc-400/10",
  2: "bg-amber-700/10",
}

const VALUE_COLOR: Record<number, string> = {
  0: "text-yellow-400",
  1: "text-zinc-300",
  2: "text-amber-600",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Avatar({ src, username }: { src: string | null; username: string }) {
  return src ? (
    <img
      src={src}
      alt={username}
      className="w-8 h-8 rounded-full object-cover border border-white/10"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 border border-white/10">
      {username?.[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-6 h-4 rounded bg-zinc-700" />
      <div className="w-8 h-8 rounded-full bg-zinc-700" />
      <div className="flex-1 h-4 rounded bg-zinc-700" />
      <div className="w-12 h-4 rounded bg-zinc-700" />
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="px-4 py-10 text-center text-zinc-500 text-sm">
      No {label} data yet. Be the first on the board!
    </div>
  )
}

// ─── Leaderboard Table ────────────────────────────────────────────────────────

interface LeaderboardTableProps {
  players: Profile[]
  valueKey: keyof Profile
  valueLabel: string
  loading: boolean
  formatValue?: (v: number) => string
}

function LeaderboardTable({
  players,
  valueKey,
  valueLabel,
  loading,
  formatValue,
}: LeaderboardTableProps) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden bg-zinc-900/60">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-white/3">
        <span className="w-6 text-xs font-mono text-white font-semibold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>#</span>
        <span className="flex-1 text-xs uppercase tracking-widest text-white font-semibold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>Player</span>
        <span className="text-xs uppercase tracking-widest text-white font-semibold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{valueLabel}</span>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
      ) : players.length === 0 ? (
        <EmptyState label={valueLabel.toLowerCase()} />
      ) : (
        players.map((p, i) => {
          const val = p[valueKey] as number
          const podium = i <= 2
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${
                podium ? ROW_BG[i] : ""
              }`}
            >
              <span className={`w-6 text-sm font-mono font-bold ${podium ? VALUE_COLOR[i] : "text-zinc-400"}`}>
                {MEDAL[i] ?? i + 1}
              </span>
              <Avatar src={p.avatar} username={p.username} />
              <span
                className="flex-1 text-sm text-white font-medium truncate hover:underline cursor-pointer"
                onClick={() => router.push(`/profile/${p.username}`)}
              >
                {p.username}
              </span>
              <span className={`text-sm font-semibold tabular-nums ${podium ? VALUE_COLOR[i] : "text-zinc-300"}`}>
                {formatValue ? formatValue(val) : val.toLocaleString()}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Rank Distribution ────────────────────────────────────────────────────────

function RankDistribution({ players, loading }: { players: Profile[]; loading: boolean }) {
  const counts: Record<string, number> = {}
  for (const p of players) {
    const r = p.rank ?? "Peasant"
    counts[r] = (counts[r] ?? 0) + 1
  }
  const total = players.length || 1

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden bg-zinc-900/60">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-white/3">
        <span className="flex-1 text-xs uppercase tracking-widest text-white font-semibold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>Rank</span>
        <span className="text-xs uppercase tracking-widest text-white font-semibold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>Players</span>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)
      ) : RANK_LIST.length === 0 ? (
        <EmptyState label="ranks" />
      ) : (
        RANK_LIST.map((rank) => {
          const count = counts[rank] ?? 0
          const pct = Math.round((count / total) * 100)
          return (
            <div
              key={rank}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
            >
              <span className="flex-1 text-sm text-white font-medium">{rank}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-300 tabular-nums w-8 text-right">
                  {count}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Section Button ───────────────────────────────────────────────────────────

function SectionBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
          : "bg-zinc-800/70 text-zinc-400 hover:text-white hover:bg-zinc-700/70"
      }`}
    >
      {children}
    </button>
  )
}

// ─── Players Tab ──────────────────────────────────────────────────────────────

function PlayersTab() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<PlayerSection>("crowns")

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, username, avatar, rank, crowns, login_streak, cc_seasons_won, cc_votes_received, cc_challenges_won"
        )
        .limit(100)
      setPlayers((data as Profile[]) ?? [])
      setLoading(false)
    }
    fetchAll()
  }, [])

  const sorted = (key: keyof Profile) =>
    [...players].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 50)

  const sections: { key: PlayerSection; label: string }[] = [
    { key: "crowns", label: "👑 Crowns" },
    { key: "wins", label: "🏆 Overall Wins" },
    { key: "ranks", label: "🎖️ Ranks" },
    { key: "streak", label: "🔥 Login Streak" },
    { key: "castaway_cove", label: "🏝️ Castaway Cove" },
  ]

  return (
    <div className="space-y-6">
      {/* Section nav — centered */}
      <div className="flex flex-wrap justify-center gap-2">
        {sections.map((s) => (
          <SectionBtn key={s.key} active={section === s.key} onClick={() => setSection(s.key)}>
            {s.label}
          </SectionBtn>
        ))}
      </div>

      {section === "crowns" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white text-center">👑 Crowns Leaderboard 👑</h2>
          <p className="text-sm text-zinc-500 text-center">Players ranked by total crowns earned.</p>
          <LeaderboardTable players={sorted("crowns")} valueKey="crowns" valueLabel="Crowns" loading={loading} />
        </div>
      )}

      {section === "wins" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white text-center">🏆 Overall Wins Leaderboard 🏆</h2>
          <p className="text-sm text-zinc-500 text-center">Total game wins across all titles.</p>
          <LeaderboardTable players={sorted("cc_seasons_won")} valueKey="cc_seasons_won" valueLabel="Wins" loading={loading} />
        </div>
      )}

      {section === "ranks" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white text-center">🎖️ Rank Distribution 🎖️</h2>
          <p className="text-sm text-zinc-500 text-center">How many players are in each rank tier.</p>
          <RankDistribution players={players} loading={loading} />
        </div>
      )}

      {section === "streak" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white text-center">🔥 Login Streak Leaderboard 🔥</h2>
          <p className="text-sm text-zinc-500 text-center">Players with the longest active daily login streaks.</p>
          <LeaderboardTable players={sorted("login_streak")} valueKey="login_streak" valueLabel="Days" loading={loading} />
        </div>
      )}

      {section === "castaway_cove" && (
        <CastawayCoveSection players={players} loading={loading} sorted={sorted} />
      )}
    </div>
  )
}

// ─── Castaway Cove Section ────────────────────────────────────────────────────

type CCSub = "seasons" | "votes" | "challenges"

function CastawayCoveSection({
  players,
  loading,
  sorted,
}: {
  players: Profile[]
  loading: boolean
  sorted: (key: keyof Profile) => Profile[]
}) {
  const [sub, setSub] = useState<CCSub>("seasons")

  const subs: { key: CCSub; label: string }[] = [
    { key: "seasons", label: "Seasons Won" },
    { key: "votes", label: "Votes Received" },
    { key: "challenges", label: "Challenges Won" },
  ]

  const config: Record<CCSub, { valueKey: keyof Profile; valueLabel: string; desc: string; title: string }> = {
    seasons: {
      valueKey: "cc_seasons_won",
      valueLabel: "Seasons",
      desc: "Players who have survived to win the most Castaway Cove seasons.",
      title: "🏝️ Seasons Won 🏝️",
    },
    votes: {
      valueKey: "cc_votes_received",
      valueLabel: "Votes",
      desc: "Players who have received the most votes across all Castaway Cove games.",
      title: "🏝️ Votes Received 🏝️",
    },
    challenges: {
      valueKey: "cc_challenges_won",
      valueLabel: "Challenges",
      desc: "Players who have won the most individual challenges in Castaway Cove.",
      title: "🏝️ Challenges Won 🏝️",
    },
  }

  const { valueKey, valueLabel, desc, title } = config[sub]

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">🏝️ Castaway Cove Leaderboards 🏝️</h2>
        <p className="text-sm text-zinc-500">Stats from all Castaway Cove seasons.</p>
      </div>

      <div className="flex justify-center">
        <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-xl w-fit">
          {subs.map((s) => (
            <button
              key={s.key}
              onClick={() => setSub(s.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                sub === s.key ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white text-center">{title}</h3>
        <p className="text-sm text-zinc-500 text-center">{desc}</p>
        <LeaderboardTable players={sorted(valueKey)} valueKey={valueKey} valueLabel={valueLabel} loading={loading} />
      </div>
    </div>
  )
}

// ─── Guilds Tab ───────────────────────────────────────────────────────────────

function GuildsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <span className="text-5xl">⚔️</span>
      <h2 className="text-xl font-semibold text-white">Guild Leaderboards Coming Soon</h2>
      <p className="text-sm text-zinc-500 max-w-sm">
        Guild rankings, wars, and stats are on the way. Form your crew and get ready.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "players" | "guilds"

export default function LeaderboardsPage() {
  const [tab, setTab] = useState<Tab>("players")

  useEffect(() => {
    return () => {
      const audio = (window as any).__leaderboardAudio
      if (audio) {
        audio.pause()
        audio.src = ""
        delete (window as any).__leaderboardAudio
      }
    }
  }, [])

  return (
    <main
      className="min-h-screen text-white"
      style={{
        backgroundImage: "url('/throneroom.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="min-h-screen bg-black/50">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
          <div className="mb-8 text-center">
            <h1
              className="text-5xl font-bold tracking-tight"
              style={{
                fontFamily: "Survivant, serif",
                textShadow: "0 2px 8px rgba(0,0,0,1), 0 1px 2px rgba(0,0,0,1)",
              }}
            >
              Leaderboards
            </h1>
          </div>

          <div className="bg-zinc-900/90 rounded-2xl p-6 md:p-8 shadow-2xl">
            <div className="flex justify-center gap-2 mb-8">
              {(["players", "guilds"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer ${
                    tab === t
                      ? "bg-white text-black shadow"
                      : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                  }`}
                >
                  {t === "players" ? "👤 Players" : "⚔️ Guilds"}
                </button>
              ))}
            </div>

            {tab === "players" ? <PlayersTab /> : <GuildsTab />}
          </div>
        </div>
      </div>
    </main>
  )
}