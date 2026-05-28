'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type Player = {
  id: string
  user_id: string
  username: string
  avatar_url?: string
}

type Message = {
  id: string
  content: string
  sender_id: string
  username?: string
  created_at?: string
  topic?: string
}

type Tab = 'Players' | 'Camp' | 'Challenge Beach' | 'Tiki Court' | 'Summary'
type CampSubPage = 'Malolo Tribe' | 'Kaliki Tribe' | 'Jungle' | 'Water Well'

type ChallengeResult = {
  day: number
  immunity_winner: 'malolo' | 'kaliki' | 'raro' | string  // string = user_id for individual immunity post-merge
  reward_winner: 'malolo' | 'kaliki' | 'raro' | string
  individual_immunity?: string  // user_id of immune player post-merge
}

type VoteRecord = {
  day: number
  voted_off: string
  username: string
  vote_counts: Record<string, number>
  rocks_drawn?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PLAYERS = 18
const DAY_DURATION_MS = 5 * 60 * 1000
const MERGE_AT = 10

const TRIBE_1    = 'malolo'
const TRIBE_2    = 'kaliki'
const TRIBE_RARO = 'raro'

const TRIBE_1_NAME    = 'Malolo'
const TRIBE_2_NAME    = 'Kaliki'
const TRIBE_RARO_NAME = 'Raro'

const WOOD_GRAIN = `
  repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px),
  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.015) 5px, rgba(0,0,0,0.015) 6px)
`
const WOOD_GRAIN_DARK = `
  repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px),
  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
  const s = (totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── ChatPanel (top-level so it's never recreated on parent re-render) ───────

type ChatPanelProps = {
  tribeKey: string
  canChat: boolean
  messages: Message[]
  text: string
  setText: (v: string) => void
  onSend: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  getMessageDay: (createdAt?: string) => number
  onlineUserIds: Set<string>
  onClickUsername: (username: string) => void
}

function ChatPanel({ tribeKey, canChat, messages, text, setText, onSend, scrollRef, getMessageDay, onlineUserIds, onClickUsername }: ChatPanelProps) {
  const tribeMessages = messages.filter(m => m.topic === tribeKey)
  return (
    <div className="bg-[#b8955a]/50 rounded-xl p-3 flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
        {tribeMessages.map(m => {
          const isOnline = onlineUserIds.has(m.sender_id)
          return (
            <div key={m.id} className="bg-[#b8955a] p-3 rounded">
              <div className="flex justify-between mb-1">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isOnline ? '#22c55e' : '#ef4444', boxShadow: isOnline ? '0 0 4px #22c55e' : 'none' }}
                  />
                  <span
                    className="text-yellow-800 font-bold text-sm cursor-pointer hover:underline"
                    onClick={() => onClickUsername(m.username ?? '')}
                  >
                    {m.username}
                  </span>
                </span>
                <p className="text-xs text-zinc-600">Day {getMessageDay(m.created_at)}</p>
              </div>
              <p className="text-sm">{m.content}</p>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 mt-2 shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={!canChat}
          className="flex-1 bg-[#c8a96e] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
          placeholder={canChat ? 'Type message...' : 'You cannot chat here'}
          onKeyDown={e => { if (e.key === 'Enter') onSend() }}
        />
        <button
          onClick={onSend}
          disabled={!canChat}
          className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer"
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()

  // Core state
  const [lobbyId,         setLobbyId]         = useState<string | null>(null)
  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null)
  const [players,         setPlayers]         = useState<Player[]>([])
  const [messages,        setMessages]        = useState<Message[]>([])
  const [lobbyMessages,   setLobbyMessages]   = useState<Message[]>([])
  const [text,            setText]            = useState('')
  const [lobbyText,       setLobbyText]       = useState('')
  const [voteTarget,      setVoteTarget]      = useState('')
  const [votedName,       setVotedName]       = useState<string | null>(null)
  const [hasVotedToday,   setHasVotedToday]   = useState(false)
  const [lobby,           setLobby]           = useState<any>(null)
  const [isPlayerInLobby, setIsPlayerInLobby] = useState(false)
  const [activeTab,       setActiveTab]       = useState<Tab>('Players')
  const [campPage,        setCampPage]        = useState<CampSubPage>('Malolo Tribe')

  // Presence & UI
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [dotCount,      setDotCount]      = useState(1)
  const [countdown,     setCountdown]     = useState<number>(0)
  const [isPaused,      setIsPaused]      = useState(false)

  // Profile sidebar
  const [rank,     setRank]     = useState<string | null>(null)
  const [coins,    setCoins]    = useState<number | null>(null)
  const [crowns,   setCrowns]   = useState<number | null>(null)
  const [joinedAt, setJoinedAt] = useState<string | null>(null)

  // Vote history
  const [voteHistory, setVoteHistory] = useState<VoteRecord[]>([])

  // Refs
  const chatRef         = useRef<HTMLDivElement>(null)
  const lobbyChatRef    = useRef<HTMLDivElement>(null)
  const lobbyRef        = useRef<any>(null)
  const playersRef      = useRef<Player[]>([])
  const isPausedRef     = useRef(false)
  const pausedAtRef     = useRef<number | null>(null)
  const advancingRef    = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)

  // ─── Derived game state ───────────────────────────────────────────────────

  const gameStarted      = !!lobby?.started_at
  const currentDay       = lobby?.current_day ?? 0
  const tribeAssign      = (lobby?.tribe_assignments ?? {}) as Record<string, string>
  const votedOffIds      = (lobby?.voted_off ?? []) as string[]
  const challengeResults = (lobby?.challenge_results ?? []) as ChallengeResult[]
  const activePlayers    = players.filter(p => !votedOffIds.includes(p.user_id))
  const remainingCount   = activePlayers.length

  const me        = players.find(p => p.user_id === (currentUserId ?? currentUserIdRef.current)) ?? null
  const _uid      = currentUserId ?? currentUserIdRef.current ?? ''
  const iAmActive = players.length > 0 && !!_uid
    ? !votedOffIds.includes(_uid)
    : false
  const myTribe   = _uid ? (tribeAssign[_uid] ?? null) : null
  const isMerged  = gameStarted && remainingCount <= MERGE_AT

  const todayResult = challengeResults.find(r => r.day === currentDay - 1) ?? null
  const losingTribe = todayResult
    ? (todayResult.immunity_winner === TRIBE_1 ? TRIBE_2 : TRIBE_1)
    : null

  // Individual immunity: the user_id stored in today's result post-merge
  const todayIndividualImmune = (isMerged && todayResult?.individual_immunity) ? todayResult.individual_immunity : null
  const iAmImmune = todayIndividualImmune === _uid

  const canAccessTikiCourt = (() => {
    if (!gameStarted || currentDay < 2 || !iAmActive) return false
    if (remainingCount <= 3) return false  // final 3 — no vote
    if (isMerged) return true
    return myTribe === losingTribe
  })()

  // Challenge Beach is locked when <=3 players remain (final tribal, no challenge)
  const canAccessChallengeBeach = gameStarted && remainingCount > 3

  const tabAccessible = (tab: Tab): boolean => {
    if (tab === 'Players') return true
    if (tab === 'Summary') return true
    if (!gameStarted) return false
    if (tab === 'Tiki Court') return canAccessTikiCourt
    if (tab === 'Challenge Beach') return canAccessChallengeBeach
    return true
  }

  const campPages: CampSubPage[] = isMerged
    ? ['Malolo Tribe', 'Jungle', 'Water Well']
    : ['Malolo Tribe', 'Kaliki Tribe', 'Jungle', 'Water Well']

  const tribe1Players  = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_1)
  const tribe2Players  = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_2)
  const raroPlayers    = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_RARO)
  const voteablePlayers = activePlayers.filter(p =>
    p.user_id !== _uid &&
    tribeAssign[p.user_id] === myTribe &&
    p.user_id !== todayIndividualImmune
  )

  function tribeName(key: string): string {
    if (key === TRIBE_1) return TRIBE_1_NAME
    if (key === TRIBE_2) return TRIBE_2_NAME
    if (key === TRIBE_RARO) return TRIBE_RARO_NAME
    return key
  }

  // ─── Keep refs in sync ───────────────────────────────────────────────────

  useEffect(() => { lobbyRef.current = lobby }, [lobby])
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { currentUserIdRef.current = currentUserId }, [currentUserId])

  // ─── PARAMS ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.resolve(params).then(p => setLobbyId(p.id))
  }, [params])

  // ─── INIT ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId) return
    initUser(lobbyId)
    loadLobby(lobbyId)
    loadMessages(lobbyId)
    loadLobbyMessages(lobbyId)

    const interval = setInterval(() => {
      loadPlayers(lobbyId)
      loadMessages(lobbyId)
      loadLobbyMessages(lobbyId)
      loadLobby(lobbyId)
    }, 3000)
    return () => clearInterval(interval)
  }, [lobbyId])

  useEffect(() => {
    if (!lobbyId || !currentUserId) return
    loadPlayers(lobbyId)
  }, [lobbyId, currentUserId])

  // ─── Profile sidebar ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!me) return
    supabase
      .from('profiles')
      .select('rank, coins, crowns, created_at')
      .eq('username', me.username)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setRank(data.rank)
        setCoins(data.coins)
        setCrowns(data.crowns)
        setJoinedAt(data.created_at)
      })
  }, [me?.username])

  // ─── Auto scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (lobbyChatRef.current) lobbyChatRef.current.scrollTop = lobbyChatRef.current.scrollHeight
  }, [lobbyMessages])

  // ─── Presence ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !currentUserId) return
    const channel = supabase.channel(`presence:${lobbyId}`, {
      config: { presence: { key: currentUserId } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>()
        setOnlineUserIds(new Set(Object.keys(state)))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await channel.track({ user_id: currentUserId })
      })
    return () => { supabase.removeChannel(channel) }
  }, [lobbyId, currentUserId])

  // ─── Loading dots ─────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => setDotCount(d => d >= 3 ? 1 : d + 1), 500)
    return () => clearInterval(interval)
  }, [])

  // ─── Countdown timer ─────────────────────────────────────────────────────

  useEffect(() => {
    const tick = () => {
      if (isPausedRef.current) return
      const l = lobbyRef.current
      if (!l?.day_ends_at) { setCountdown(0); return }
      const remaining = new Date(l.day_ends_at).getTime() - Date.now()
      setCountdown(Math.max(0, remaining))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  // ─── Day advancement ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!gameStarted || !lobbyId || !currentUserId) return
    if (countdown > 0) return
    if (isPaused) return
    if (advancingRef.current) return

    advancingRef.current = true
    advanceDay(lobbyId).finally(() => {
      setTimeout(() => { advancingRef.current = false }, 5000)
    })
  }, [countdown, gameStarted, currentUserId, lobbyId, isPaused])

  // ─── Check if already voted today ────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !currentUserId || !currentDay) return
    supabase
      .from('votes')
      .select('id')
      .eq('lobby_id', lobbyId)
      .eq('voter_id', currentUserId)
      .eq('day', currentDay)
      .maybeSingle()
      .then(({ data }) => setHasVotedToday(!!data))
  }, [lobbyId, currentUserId, currentDay])

  // ─── Vote history ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !gameStarted) return
    loadVoteHistory(lobbyId)
  }, [lobbyId, gameStarted, votedOffIds.length])

  // ─── If active tab becomes locked, redirect to Players ───────────────────

  useEffect(() => {
    if (!tabAccessible(activeTab)) setActiveTab('Players')
  }, [gameStarted, canAccessTikiCourt, activeTab])

  // ─── Data loaders ────────────────────────────────────────────────────────

  async function initUser(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsPlayerInLobby(false); return }
    currentUserIdRef.current = user.id
    setCurrentUserId(user.id)
    const { data } = await supabase
      .from('lobby_players').select('id')
      .eq('lobby_id', id).eq('user_id', user.id).maybeSingle()
    setIsPlayerInLobby(!!data)
  }

  async function loadLobby(id: string) {
    const { data } = await supabase.from('lobbies').select('*').eq('id', id).maybeSingle()
    if (data) setLobby(data)
  }

  async function loadPlayers(id: string) {
    const { data, error } = await supabase.from('lobby_players').select('*').eq('lobby_id', id)
    if (error || !data || data.length === 0) { setPlayers([]); return }
    const userIds = data.map(p => p.user_id)
    const { data: profileData } = await supabase
      .from('profiles').select('id, username, avatar').in('id', userIds)
    const profileMap = Object.fromEntries(
      (profileData || []).map(p => [p.id, { username: p.username, avatar: p.avatar }])
    )
    const mapped = data.map(p => ({
      id: p.id,
      user_id: p.user_id,
      username: profileMap[p.user_id]?.username || p.user_id.slice(0, 8),
      avatar_url: profileMap[p.user_id]?.avatar || null,
    }))
    setPlayers(mapped)

    const { data: lobbyData } = await supabase.from('lobbies').select('*').eq('id', id).maybeSingle()
    if (lobbyData && !lobbyData.started_at && mapped.length >= MAX_PLAYERS) {
      await startGame(id, mapped, lobbyData)
    }
  }

  async function resolveUsernames(senderIds: string[]): Promise<Record<string, string>> {
    const { data } = await supabase.from('profiles').select('id, username').in('id', senderIds)
    return Object.fromEntries((data || []).map((p: any) => [p.id, p.username]))
  }

  async function loadMessages(id: string) {
    const { data, error } = await supabase
      .from('messages').select('*').eq('season_id', id)
      .in('topic', [TRIBE_1, TRIBE_2, TRIBE_RARO])
      .order('created_at', { ascending: true })
    if (error || !data || data.length === 0) { setMessages([]); return }
    const senderIds = [...new Set(data.map(m => m.sender_id))]
    const profileMap = await resolveUsernames(senderIds)
    setMessages(data.map(m => ({ ...m, username: profileMap[m.sender_id] || 'Unknown' })))
  }

  async function loadLobbyMessages(id: string) {
    const { data, error } = await supabase
      .from('messages').select('*').eq('season_id', id)
      .eq('topic', 'lobby').order('created_at', { ascending: true })
    if (error || !data || data.length === 0) { setLobbyMessages([]); return }
    const senderIds = [...new Set(data.map(m => m.sender_id))]
    const profileMap = await resolveUsernames(senderIds)
    setLobbyMessages(data.map(m => ({ ...m, username: profileMap[m.sender_id] || 'Unknown' })))
  }

  async function loadVoteHistory(id: string) {
    const { data: allVotes } = await supabase
      .from('votes').select('*').eq('lobby_id', id).order('day', { ascending: true })

    const l = lobbyRef.current
    const votedOffList: string[] = l?.voted_off ?? []

    const allIds = allVotes && allVotes.length > 0
      ? [...new Set([...allVotes.map((v: any) => v.voter_id), ...allVotes.map((v: any) => v.target_id)])]
      : []
    const allPlayerIds = players.map(p => p.user_id)
    const idsToResolve = [...new Set([...allIds, ...allPlayerIds])]

    const { data: profileData } = idsToResolve.length > 0
      ? await supabase.from('profiles').select('id, username').in('id', idsToResolve)
      : { data: [] }
    const nameMap = Object.fromEntries((profileData || []).map((p: any) => [p.id, p.username]))

    // Build a map of day -> votes cast that day
    const votesByDay: Record<number, any[]> = {}
    ;(allVotes ?? []).forEach((v: any) => {
      if (!votesByDay[v.day]) votesByDay[v.day] = []
      votesByDay[v.day].push(v)
    })

    // For each eliminated player, find the actual day their votes were cast.
    // We track used days so two eliminations never share the same day entry.
    const usedDays = new Set<number>()

    const history: VoteRecord[] = votedOffList.map((eliminatedId) => {
      // Find the earliest day that has votes targeting this player
      const candidateDays = Object.keys(votesByDay)
        .map(Number)
        .filter(day => !usedDays.has(day) && votesByDay[day].some((v: any) => v.target_id === eliminatedId))
        .sort((a, b) => a - b)

      if (candidateDays.length > 0) {
        const day = candidateDays[0]
        usedDays.add(day)
        const dayVotes = votesByDay[day]
        const counts: Record<string, number> = {}
        dayVotes.forEach((v: any) => {
          const name = nameMap[v.target_id] || v.target_id.slice(0, 8)
          counts[name] = (counts[name] || 0) + 1
        })
        return {
          day,
          voted_off: eliminatedId,
          username: nameMap[eliminatedId] || eliminatedId.slice(0, 8),
          vote_counts: counts,
          rocks_drawn: false,
        }
      }

      // No votes targeted this player — rocks were drawn
      const unusedDaysWithVotes = Object.keys(votesByDay).map(Number).filter(d => !usedDays.has(d)).sort((a, b) => a - b)
      const day = unusedDaysWithVotes.length > 0 ? unusedDaysWithVotes[0] : (usedDays.size + 2)
      usedDays.add(day)
      return {
        day,
        voted_off: eliminatedId,
        username: nameMap[eliminatedId] || eliminatedId.slice(0, 8),
        vote_counts: {},
        rocks_drawn: true,
      }
    })

    setVoteHistory(history)
  }

  // ─── Game logic ──────────────────────────────────────────────────────────

  async function startGame(id: string, allPlayers: Player[], lobbyData: any) {
    const { data: check } = await supabase.from('lobbies').select('started_at').eq('id', id).maybeSingle()
    if (check?.started_at) return

    const shuffled = shuffleArray(allPlayers.map(p => p.user_id))
    const tribeAssignments: Record<string, string> = {}
    shuffled.forEach((uid, i) => {
      tribeAssignments[uid] = i < MAX_PLAYERS / 2 ? TRIBE_1 : TRIBE_2
    })

    const now = new Date()
    const dayEndsAt = new Date(now.getTime() + DAY_DURATION_MS)

    await supabase.from('lobbies').update({
      started_at: now.toISOString(),
      current_day: 1,
      day_ends_at: dayEndsAt.toISOString(),
      tribe_assignments: tribeAssignments,
      challenge_results: [],
      voted_off: [],
      status: 'active',
    }).eq('id', id)

    loadLobby(id)
  }

  async function advanceDay(id: string) {
    const l = lobbyRef.current
    if (!l) return
    if (l.day_ends_at && new Date(l.day_ends_at).getTime() > Date.now() + 10000) return

    const newDay = (l.current_day ?? 1) + 1
    const dayEndsAt = new Date(Date.now() + DAY_DURATION_MS)

    const prevDay = newDay - 1
    const existingResults: ChallengeResult[] = l.challenge_results ?? []
    const alreadyHasResult = existingResults.some(r => r.day === prevDay)

    let newResults = existingResults
    if (!alreadyHasResult && prevDay >= 1) {
      const remaining = Object.entries(l.tribe_assignments ?? {})
        .filter(([uid]) => !(l.voted_off ?? []).includes(uid))
        .map(([, tribe]) => tribe)
      const uniqueTribes = [...new Set(remaining)]

      const activeThenIds = Object.keys(l.tribe_assignments ?? {}).filter(uid => !(l.voted_off ?? []).includes(uid))
      const isMergedThen = activeThenIds.length <= MERGE_AT

      if (isMergedThen) {
        // Post-merge: individual immunity — pick a random active player
        const immunePlayer = activeThenIds[Math.floor(Math.random() * activeThenIds.length)]
        newResults = [...existingResults, {
          day: prevDay,
          immunity_winner: immunePlayer,
          reward_winner: immunePlayer,
          individual_immunity: immunePlayer,
        }]
      } else if (uniqueTribes.length >= 2) {
        const tribes = uniqueTribes as ('malolo' | 'kaliki' | 'raro')[]
        const immunityWinner = tribes[Math.floor(Math.random() * tribes.length)]
        const rewardWinner   = tribes[Math.floor(Math.random() * tribes.length)]
        newResults = [...existingResults, { day: prevDay, immunity_winner: immunityWinner, reward_winner: rewardWinner }]
      }
    }

    let newVotedOff: string[] = l.voted_off ?? []
    const { data: dayVotes } = await supabase
      .from('votes').select('*').eq('lobby_id', id).eq('day', prevDay)

    // Determine if this day had individual immunity (post-merge)
    const prevDayImmune = newResults.find(r => r.day === prevDay)?.individual_immunity ?? null

    if (prevDay >= 2) {
      if (dayVotes && dayVotes.length > 0) {
        const counts: Record<string, number> = {}
        dayVotes.forEach((v: any) => {
          // Discard votes cast against the immune player
          if (prevDayImmune && v.target_id === prevDayImmune) return
          counts[v.target_id] = (counts[v.target_id] || 0) + 1
        })
        if (Object.keys(counts).length > 0) {
          const maxVotes = Math.max(...Object.values(counts))
          const tied = Object.keys(counts).filter(uid => counts[uid] === maxVotes)
          const eliminated = tied[Math.floor(Math.random() * tied.length)]
          if (!newVotedOff.includes(eliminated)) {
            newVotedOff = [...newVotedOff, eliminated]
          }
        }
      } else {
        const losingTribeKey = newResults.find(r => r.day === prevDay)?.immunity_winner === TRIBE_1
          ? TRIBE_2
          : TRIBE_1
        const eligible = Object.entries(l.tribe_assignments ?? {})
          .filter(([uid, tribe]) => !newVotedOff.includes(uid) && tribe === losingTribeKey)
          .map(([uid]) => uid)
        const pool = eligible.length > 0
          ? eligible
          : Object.keys(l.tribe_assignments ?? {}).filter(uid => !newVotedOff.includes(uid))
        if (pool.length > 0) {
          const eliminated = pool[Math.floor(Math.random() * pool.length)]
          newVotedOff = [...newVotedOff, eliminated]
        }
      }
    }

    const activeAfterElim = Object.keys(l.tribe_assignments ?? {})
      .filter(uid => !newVotedOff.includes(uid))
    const merging = activeAfterElim.length <= MERGE_AT
    let newAssignments = l.tribe_assignments ?? {}
    if (merging) {
      newAssignments = { ...newAssignments }
      activeAfterElim.forEach(uid => { newAssignments[uid] = TRIBE_RARO })
    }

    await supabase.from('lobbies').update({
      current_day: newDay,
      day_ends_at: dayEndsAt.toISOString(),
      challenge_results: newResults,
      voted_off: newVotedOff,
      tribe_assignments: newAssignments,
    }).eq('id', id)

    loadLobby(id)
  }

  // ─── Chat & voting ───────────────────────────────────────────────────────

  async function sendMessage(tribeKey: string) {
    if (!text.trim() || !lobbyId || !iAmActive) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('messages').insert({
      season_id: lobbyId, sender_id: user.id, content: text.trim(), topic: tribeKey,
    })
    setText('')
    loadMessages(lobbyId)
  }

  async function sendLobbyMessage() {
    if (!lobbyText.trim() || !lobbyId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: membership } = await supabase
      .from('lobby_players').select('id')
      .eq('lobby_id', lobbyId).eq('user_id', user.id).maybeSingle()
    if (!membership) return
    await supabase.from('messages').insert({
      season_id: lobbyId, sender_id: user.id, content: lobbyText.trim(), topic: 'lobby',
    })
    setLobbyText('')
    loadLobbyMessages(lobbyId)
  }

  async function castVote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !voteTarget || !lobbyId || hasVotedToday) return
    const { error } = await supabase.from('votes').insert({
      lobby_id: lobbyId, voter_id: user.id, target_id: voteTarget, day: currentDay,
    })
    if (error) { console.error('VOTE ERROR:', error); return }
    const voted = players.find(p => p.user_id === voteTarget)
    setVotedName(voted?.username ?? 'Unknown')
    setHasVotedToday(true)
  }

  // ─── Pause / resume ──────────────────────────────────────────────────────

  async function togglePause() {
    if (!lobbyId) return
    if (!isPaused) {
      pausedAtRef.current = Date.now()
      setIsPaused(true)
      isPausedRef.current = true
    } else {
      const pausedMs = pausedAtRef.current ? Date.now() - pausedAtRef.current : 0
      pausedAtRef.current = null
      const l = lobbyRef.current
      if (l?.day_ends_at) {
        const newEndsAt = new Date(new Date(l.day_ends_at).getTime() + pausedMs)
        await supabase.from('lobbies').update({ day_ends_at: newEndsAt.toISOString() }).eq('id', lobbyId)
        await loadLobby(lobbyId)
      }
      setIsPaused(false)
      isPausedRef.current = false
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function getMessageDay(createdAt?: string) {
    if (!createdAt || !lobby?.started_at) return 0
    const start = new Date(lobby.started_at).getTime()
    const hoursPassed = (new Date(createdAt).getTime() - start) / (1000 * 60 * 60)
    if (hoursPassed < 0) return 0
    return Math.floor(hoursPassed / (DAY_DURATION_MS / 1000 / 3600)) + 1
  }

  // ─── Avatar helper ───────────────────────────────────────────────────────

  function PlayerAvatar({ player, size = 'md', showName = true }: {
    player: Player, size?: 'sm' | 'md', showName?: boolean
  }) {
    const isVotedOff = votedOffIds.includes(player.user_id)
    const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg'
    return (
      <div
        onClick={() => router.push(`/profile/${player.username}`)}
        className="flex flex-col items-center gap-1 cursor-pointer group"
      >
        <div
          className="w-full aspect-[3/4] rounded-md overflow-hidden border-2 border-[#a07840] group-hover:border-amber-800 transition"
          style={{ filter: isVotedOff ? 'grayscale(100%)' : 'none' }}
        >
          {player.avatar_url ? (
            <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
              <span className={`${sizeClass} font-black text-amber-900`}>{player.username.slice(0, 1).toUpperCase()}</span>
            </div>
          )}
        </div>
        {showName && (
          <p className="text-[10px] font-semibold text-center leading-tight text-zinc-800 truncate w-full">
            {player.username}
          </p>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!lobbyId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>
    )
  }

  const tabs: Tab[] = ['Players', 'Camp', 'Challenge Beach', 'Tiki Court']
  const tabLabel = (tab: Tab) => tab === 'Players' && !gameStarted ? 'Lobby' : tab

  return (
    <main
      className="min-h-screen text-white flex gap-5 px-5 pb-5 pt-8 justify-center"
      style={{ backgroundImage: 'url(/castawaywallpaper.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      {/* ══ LEFT COLUMN ══ */}
      <aside className="w-64 shrink-0 flex flex-col gap-4" style={{ height: 'calc(78vh + 2.5rem)' }}>

        {/* Day Counter */}
        <div className="relative flex items-center justify-center shrink-0" style={{ aspectRatio: '2.8 / 1' }}>
          <img src="/scroll.png" alt="scroll" className="absolute inset-0 w-full h-full object-fill" />
          <div className="relative z-10 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-900 mb-0.5">Current Day</p>
            <p className="font-black text-5xl tracking-[0.2em] uppercase leading-none text-zinc-900">
              {currentDay}
            </p>
          </div>
        </div>

        {/* Profile card */}
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-3">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700">
            {me?.avatar_url ? (
              <Image src={me.avatar_url} alt="Avatar" width={256} height={256} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-black text-zinc-600">
                {me ? me.username.slice(0, 1).toUpperCase() : '?'}
              </div>
            )}
          </div>
          <div className="mt-2 text-center">
            <h1 className="text-xl font-bold text-white">
              {me ? me.username : <span className="text-zinc-600">Loading...</span>}
            </h1>
            {gameStarted && myTribe && (
              <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{
                color: myTribe === TRIBE_1 ? '#f59e0b' : myTribe === TRIBE_2 ? '#60a5fa' : '#a78bfa'
              }}>
                {tribeName(myTribe)} Tribe
              </p>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
              <span className="text-zinc-400">Rank: </span>
              <span className="font-semibold text-white">{rank || 'Peasant'}</span>
            </div>
            <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
              <span className="text-zinc-400">Doubloons: </span>
              <span className="font-semibold text-yellow-400">{coins ?? 0}</span>
            </div>
            <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
              <span className="text-zinc-400">Crowns: </span>
              <span className="font-semibold text-amber-300">{crowns ?? 0}</span>
            </div>
            <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
              <span className="text-zinc-400">Date Joined: </span>
              <span className="font-semibold text-white">
                {joinedAt
                  ? new Date(joinedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                  : 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Clock */}
        <div
          className="flex-1 rounded-2xl border border-[#a07840] flex flex-col items-center justify-center gap-3"
          style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}
        >
          {currentDay === 0 ? (
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800 text-center px-4">
              The game will start soon!
            </p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Clock</p>
              <p className={`font-black text-4xl tracking-[0.15em] tabular-nums transition-colors ${isPaused ? 'text-amber-700' : 'text-zinc-900'}`}>
                {formatCountdown(countdown)}
              </p>
              <button
                onClick={togglePause}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest border transition ${
                  isPaused
                    ? 'bg-amber-600 border-amber-800 text-white hover:bg-amber-700'
                    : 'bg-zinc-800/70 border-zinc-900/50 text-amber-100 hover:bg-zinc-900/80'
                }`}
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              {isPaused && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 animate-pulse">
                  Paused
                </p>
              )}
            </>
          )}
        </div>

      </aside>

      {/* ══ RIGHT COLUMN ══ */}
      <div className="w-[58%] flex flex-col min-h-0">

        {/* Tab bar */}
        <div className="flex items-end gap-1 px-1 pr-4">
          {tabs.map(tab => {
            const isActive = activeTab === tab
            const locked = !tabAccessible(tab)
            return (
              <button
                key={tab}
                onClick={() => { if (!locked) setActiveTab(tab) }}
                className={`
                  relative px-5 py-2 rounded-t-lg font-bold text-xs tracking-widest
                  transition-all duration-150 select-none uppercase
                  border-t border-l border-r
                  ${isActive ? 'text-zinc-900 border-[#a07840] z-10 -mb-px pb-3 shadow-md' : ''}
                  ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  ${!isActive && !locked ? 'text-[#e8d0a0] border-[#6b4820] hover:text-[#f0ddb0]' : ''}
                  ${isActive ? '' : locked ? 'text-[#e8d0a0] border-[#6b4820]' : ''}
                `}
                style={{
                  background: isActive ? '#c8a96e' : '#8b6840',
                  backgroundImage: isActive ? WOOD_GRAIN : WOOD_GRAIN_DARK,
                }}
              >
                {tabLabel(tab)}
                {locked && <span className="ml-1 text-[9px]">🔒</span>}
              </button>
            )
          })}
          <div className="flex-1" />
          {(() => {
            const isActive = activeTab === 'Summary'
            return (
              <button
                onClick={() => setActiveTab('Summary')}
                className={`
                  relative px-5 py-2 rounded-t-lg font-bold text-xs tracking-widest
                  transition-all duration-150 select-none cursor-pointer uppercase
                  border-t border-l border-r
                  ${isActive ? 'text-zinc-900 border-[#a07840] z-10 -mb-px pb-3 shadow-md' : 'text-[#e8d0a0] border-[#6b4820] hover:text-[#f0ddb0]'}
                `}
                style={{
                  background: isActive ? '#c8a96e' : '#8b6840',
                  backgroundImage: isActive ? WOOD_GRAIN : WOOD_GRAIN_DARK,
                }}
              >
                Summary
              </button>
            )
          })()}
        </div>

        {/* Tab content */}
        <div
          className="rounded-2xl rounded-tl-none overflow-hidden border border-[#a07840]"
          style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN, height: '78vh', overflowY: 'auto' }}
        >

          {/* ── PLAYERS TAB ── */}
          {activeTab === 'Players' && (
            <div className="p-5 h-full flex flex-col text-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div className="w-24" />
                <h2 className="text-2xl font-black uppercase tracking-widest text-center">Players</h2>
                <div className="w-24 flex justify-end">
                  <button className="flex items-center gap-1.5 bg-sky-400 hover:bg-sky-500 transition text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow">
                    <img src="/info.png" alt="Info" className="w-4 h-4" />
                    Info
                  </button>
                </div>
              </div>

              {!gameStarted ? (
                <>
                  {/* CHANGED: grid-cols-9 → grid-cols-6, removed fixed aspect-[3/4] in favour of taller cards */}
                  <div className="grid grid-cols-6 gap-3 mb-4">
                    {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
                      const player = players[i]
                      return (
                        <div
                          key={i}
                          onClick={() => player && router.push(`/profile/${player.username}`)}
                          className={`flex flex-col items-center gap-1 ${player ? 'cursor-pointer group' : ''}`}
                        >
                          <div className={`w-full aspect-[3/4] rounded-md overflow-hidden border-2 ${player ? 'border-[#a07840] group-hover:border-amber-800 transition' : 'border-dashed border-[#a07840]/40 bg-[#b8955a]/40'}`}>
                            {player?.avatar_url ? (
                              <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                            ) : player ? (
                              <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                                <span className="text-2xl font-black text-amber-900">{player.username.slice(0, 1).toUpperCase()}</span>
                              </div>
                            ) : null}
                          </div>
                          {player && (
                            <p className="text-xs font-semibold text-center leading-tight text-zinc-800 truncate w-full">
                              {player.username}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <p className="italic text-zinc-700 text-sm mb-3">
                    Waiting for players ({players.length}/{MAX_PLAYERS})
                    <span className="inline-block w-6 text-left">{'.'.repeat(dotCount)}</span>
                  </p>

                  <div className="bg-[#b8955a]/50 rounded-xl p-3 flex flex-col flex-1 min-h-0">
                    <h3 className="font-bold text-base mb-2 uppercase tracking-widest">Lobby Chat</h3>
                    <div ref={lobbyChatRef} className="overflow-y-auto space-y-2 mb-2 pr-1" style={{ flex: 1, minHeight: 0 }}>
                      {lobbyMessages.map(m => {
                        const isOnline = onlineUserIds.has(m.sender_id)
                        return (
                          <div key={m.id} className="bg-[#c8a96e] p-2 rounded text-sm">
                            <span className="inline-flex items-center gap-1.5 mr-2">
                              <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: isOnline ? '#22c55e' : '#ef4444', boxShadow: isOnline ? '0 0 4px #22c55e' : 'none' }}
                              />
                              <span
                                className="font-bold text-amber-900 cursor-pointer hover:underline"
                                onClick={() => router.push(`/profile/${m.username}`)}
                              >
                                {m.username}
                              </span>
                            </span>
                            <span>{m.content}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={lobbyText}
                        onChange={e => setLobbyText(e.target.value)}
                        disabled={!isPlayerInLobby}
                        className="flex-1 bg-[#c8a96e] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
                        placeholder={isPlayerInLobby ? 'Chat...' : 'Join to chat'}
                        onKeyDown={e => { if (e.key === 'Enter') sendLobbyMessage() }}
                      />
                      <button onClick={sendLobbyMessage} disabled={!isPlayerInLobby} className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer">
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : isMerged ? (
                <div>
                  <p className="text-center font-black uppercase tracking-widest text-lg mb-3" style={{ color: '#7c3aed' }}>
                    ⚔ {TRIBE_RARO_NAME} Tribe
                  </p>
                  {raroPlayers.length === 0 ? (
                    <p className="text-center italic text-zinc-600 text-sm">Loading players...</p>
                  ) : raroPlayers.length <= 9 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {raroPlayers.map(p => (
                        <div key={p.user_id} style={{ width: 'calc(11.11% - 8px)' }}>
                          <PlayerAvatar player={p} size="sm" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      {[raroPlayers.slice(0, 5), raroPlayers.slice(5)].map((row, rowIdx) => (
                        <div key={rowIdx} className="flex justify-center gap-2">
                          {row.map(p => (
                            <div key={p.user_id} style={{ width: 'calc(11.11% - 8px)' }}>
                              <PlayerAvatar player={p} size="sm" />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="font-black uppercase tracking-widest text-base mb-3 text-center" style={{ color: '#b45309' }}>
                      🔥 {TRIBE_1_NAME} Tribe
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {tribe1Players.map(p => (
                        <div key={p.user_id} style={{ width: 'calc(11.11% - 8px)' }}>
                          <PlayerAvatar player={p} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-base mb-3 text-center" style={{ color: '#1d4ed8' }}>
                      🌊 {TRIBE_2_NAME} Tribe
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {tribe2Players.map(p => (
                        <div key={p.user_id} style={{ width: 'calc(11.11% - 8px)' }}>
                          <PlayerAvatar player={p} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CAMP TAB ── */}
          {activeTab === 'Camp' && (
            <div className="p-5 h-full flex flex-col text-zinc-900">
              <div className="flex gap-2 mb-4">
                {campPages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCampPage(page)}
                    /* CHANGED: added uppercase tracking-widest to sub-page buttons */
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition border cursor-pointer uppercase tracking-widest ${campPage === page ? 'bg-amber-900 text-[#f0ddb0] border-amber-950' : 'bg-[#b8955a] text-zinc-800 border-[#a07840] hover:bg-[#a07840]'}`}
                  >
                    {isMerged && page === 'Malolo Tribe' ? 'Raro Camp' : page}
                  </button>
                ))}
              </div>

              {campPage === 'Malolo Tribe' && (
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="w-1/2 flex flex-col min-h-0">
                    <h2 className="text-base font-black uppercase tracking-widest mb-3 shrink-0" style={{ color: isMerged ? '#7c3aed' : '#b45309' }}>
                      {isMerged ? TRIBE_RARO_NAME : TRIBE_1_NAME} Tribe
                    </h2>
                    <div className="overflow-y-auto flex-1">
                      <div className="grid grid-cols-4 gap-2">
                        {(isMerged ? raroPlayers : tribe1Players).map(p => (
                          <PlayerAvatar key={p.user_id} player={p} size="sm" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="w-1/2 flex flex-col min-h-0 h-full">
                    {/* CHANGED: uppercase tracking-widest on chat heading */}
                    <h2 className="text-xl font-bold mb-3 shrink-0 uppercase tracking-widest">
                      {isMerged ? `${TRIBE_RARO_NAME} Camp Chat` : `${TRIBE_1_NAME} Camp Chat`}
                    </h2>
                    <ChatPanel
                      tribeKey={isMerged ? TRIBE_RARO : TRIBE_1}
                      canChat={iAmActive && myTribe === (isMerged ? TRIBE_RARO : TRIBE_1)}
                      messages={messages}
                      text={text}
                      setText={setText}
                      onSend={() => sendMessage(isMerged ? TRIBE_RARO : TRIBE_1)}
                      scrollRef={chatRef}
                      getMessageDay={getMessageDay}
                      onlineUserIds={onlineUserIds}
                      onClickUsername={username => router.push(`/profile/${username}`)}
                    />
                  </div>
                </div>
              )}

              {campPage === 'Kaliki Tribe' && !isMerged && (
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="w-1/2 flex flex-col min-h-0">
                    <h2 className="text-base font-black uppercase tracking-widest mb-3 shrink-0" style={{ color: '#1d4ed8' }}>
                      {TRIBE_2_NAME} Tribe
                    </h2>
                    <div className="overflow-y-auto flex-1">
                      <div className="grid grid-cols-4 gap-2">
                        {tribe2Players.map(p => (
                          <PlayerAvatar key={p.user_id} player={p} size="sm" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="w-1/2 flex flex-col min-h-0 h-full">
                    {/* CHANGED: uppercase tracking-widest on chat heading */}
                    <h2 className="text-xl font-bold mb-3 shrink-0 uppercase tracking-widest">{TRIBE_2_NAME} Camp Chat</h2>
                    <ChatPanel
                      tribeKey={TRIBE_2}
                      canChat={iAmActive && myTribe === TRIBE_2}
                      messages={messages}
                      text={text}
                      setText={setText}
                      onSend={() => sendMessage(TRIBE_2)}
                      scrollRef={chatRef}
                      getMessageDay={getMessageDay}
                      onlineUserIds={onlineUserIds}
                      onClickUsername={username => router.push(`/profile/${username}`)}
                    />
                  </div>
                </div>
              )}

              {(campPage === 'Jungle' || campPage === 'Water Well') && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xl italic text-zinc-600">{campPage} — coming soon</p>
                </div>
              )}
            </div>
          )}

          {/* ── CHALLENGE BEACH TAB ── */}
          {activeTab === 'Challenge Beach' && (
            <div className="p-5 h-full text-zinc-900 flex flex-col gap-6">
              <h2 className="text-2xl font-black uppercase tracking-widest text-center">Challenge Beach</h2>

              {todayResult ? (
                <div className="bg-[#b8955a]/60 rounded-xl p-5 border border-[#a07840]">
                  <h3 className="font-black uppercase tracking-widest text-base mb-3">Day {todayResult.day} Results</h3>
                  {isMerged ? (
                    // Post-merge: show individual immunity winner by name
                    <div className="flex justify-center">
                      <div className="bg-[#c8a96e] rounded-xl p-4 border border-[#a07840] text-center w-72">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">Individual Immunity</p>
                        {(() => {
                          const immunePlayer = players.find(p => p.user_id === todayResult.individual_immunity)
                          return (
                            <p className="text-2xl font-black">
                              {immunePlayer ? immunePlayer.username : 'Unknown'}
                              {todayResult.individual_immunity === _uid && (
                                <span className="ml-2 text-base font-bold text-amber-700">(You!)</span>
                              )}
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                  ) : (
                    // Pre-merge: show tribe immunity + reward
                    <div className="flex gap-4">
                      <div className="flex-1 bg-[#c8a96e] rounded-xl p-4 border border-[#a07840] text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">Immunity Winner</p>
                        <p className="text-2xl font-black capitalize">{tribeName(todayResult.immunity_winner)} Tribe</p>
                      </div>
                      <div className="flex-1 bg-[#c8a96e] rounded-xl p-4 border border-[#a07840] text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">Reward Winner</p>
                        <p className="text-2xl font-black capitalize">{tribeName(todayResult.reward_winner)} Tribe</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#b8955a]/60 rounded-xl p-5 border border-[#a07840] text-center">
                  <p className="italic text-zinc-600">Challenge results will be revealed when the day ends.</p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <button className="px-8 py-4 rounded-xl font-black text-lg uppercase tracking-wide bg-yellow-600 text-white border-2 border-yellow-700 hover:bg-yellow-700 transition shadow-md cursor-pointer">
                  Immunity Challenge
                </button>
                {/* Reward Challenge only shown pre-merge */}
                {!isMerged && (
                  <button className="px-8 py-4 rounded-xl font-black text-lg uppercase tracking-wide bg-[#8b6840] text-[#f0ddb0] border-2 border-[#6b4820] hover:bg-[#7a5830] transition shadow-md cursor-pointer">
                    Reward Challenge
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── TIKI COURT TAB ── */}
          {activeTab === 'Tiki Court' && (
            <div className="p-5 h-full text-zinc-900 flex">
              <div className="flex-1" />
              <div className="w-1/2 rounded-xl p-5 border border-[#a07840] flex flex-col gap-4" style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}>
                <h2 className="text-2xl font-bold">Voting Booth</h2>

                {hasVotedToday ? (
                  <div className="flex flex-col gap-3">
                    <div className="bg-[#c8a96e] rounded-xl p-3 border border-[#a07840] text-center">
                      <p className="font-bold text-zinc-700">You voted for <span className="text-red-800">{votedName}</span>.</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!lobbyId || !currentUserId) return
                        // Delete today's existing vote so they can re-vote
                        await supabase
                          .from('votes')
                          .delete()
                          .eq('lobby_id', lobbyId)
                          .eq('voter_id', currentUserId)
                          .eq('day', currentDay)
                        setHasVotedToday(false)
                        setVotedName(null)
                        setVoteTarget('')
                      }}
                      className="w-full bg-amber-700 text-white p-3 rounded font-bold hover:bg-amber-800 transition cursor-pointer"
                    >
                      ✏️ Change Vote
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={voteTarget}
                      onChange={e => setVoteTarget(e.target.value)}
                      className="w-full p-3 rounded border border-[#a07840] bg-[#c8a96e] outline-none focus:ring-2 focus:ring-amber-700 text-zinc-900 cursor-pointer"
                    >
                      <option value="">Select Player</option>
                      {voteablePlayers.map(p => (
                        <option key={p.user_id} value={p.user_id}>{p.username}</option>
                      ))}
                    </select>
                    <button
                      onClick={castVote}
                      disabled={!voteTarget}
                      className="w-full bg-red-600 text-white p-3 rounded font-bold hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                    >
                      Cast Vote
                    </button>
                  </>
                )}

                <div className="relative w-full mt-1" style={{ aspectRatio: '1.4 / 1' }}>
                  <img src="/parchment2.png" alt="parchment" className="absolute inset-0 w-full h-full object-fill" />
                  {votedName && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="text-black font-bold text-xl text-center px-4 leading-tight"
                        style={{ fontFamily: 'Georgia, serif', transform: 'rotate(-1deg)' }}
                      >
                        {votedName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SUMMARY TAB ── */}
          {activeTab === 'Summary' && (() => {
            const orderedActive = [...activePlayers].sort((a, b) => a.username.localeCompare(b.username))
            const orderedVotedOff = [...votedOffIds]
              .map(id => players.find(p => p.user_id === id))
              .filter(Boolean) as Player[]
            // Reversed so bottom-right = first eliminated
            const votedOffReversed = [...orderedVotedOff].reverse()
            const gridPlayers = [...orderedActive, ...votedOffReversed]

            // CHANGED: voteHistory reversed so most recent is at top
            const voteHistoryNewestFirst = [...voteHistory].reverse()

            function ordinal(n: number): string {
              const s = ['th','st','nd','rd']
              const v = n % 100
              return n + (s[(v - 20) % 10] || s[v] || s[0])
            }

            return (
              <div className="p-5 h-full text-zinc-900 flex gap-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-black uppercase tracking-widest mb-4">Castaways</h2>
                  <div className="grid grid-cols-6 gap-2">
                    {gridPlayers.map((player, idx) => {
                      const isVotedOff = votedOffIds.includes(player.user_id)
                      const votedOffPosition = votedOffReversed.findIndex(p => p.user_id === player.user_id)
                      const placement = isVotedOff ? (activePlayers.length + 1 + votedOffPosition) : null
                      // Jury = eliminated at or after the merge.
                      // Pre-merge boots: MAX_PLAYERS - MERGE_AT players voted off before merge.
                      // So jury members have placement > (MAX_PLAYERS - MERGE_AT).
                      const preMergeBoots = MAX_PLAYERS - MERGE_AT
                      const isJury = isVotedOff && placement !== null && placement > preMergeBoots

                      return (
                        <div key={player.user_id} className="flex flex-col items-center gap-1">
                          <div
                            onClick={() => router.push(`/profile/${player.username}`)}
                            className="cursor-pointer group w-full"
                          >
                            <div
                              className="w-full aspect-[3/4] rounded-md overflow-hidden border-2 border-[#a07840] group-hover:border-amber-800 transition"
                              style={{ filter: isVotedOff ? 'grayscale(100%)' : 'none' }}
                            >
                              {player.avatar_url ? (
                                <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                                  <span className="text-sm font-black text-amber-900">{player.username.slice(0, 1).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] font-semibold text-center leading-tight text-zinc-800 truncate w-full">
                            {player.username}
                          </p>
                          {isVotedOff && placement !== null && (() => {
                            const totalPlayers = players.length || MAX_PLAYERS
                            // 1st = highest placement number (last voted off... actually active players
                            // are still in — placement here counts up from the first boot)
                            // placement 1 = first voted off (worst), highest = winner
                            // We need the winner to be the LAST remaining, which stays as activePlayers
                            // So among votedOff, the highest placement# = most recently eliminated
                            // final 3 are still "active" — so placement among voted off goes up to
                            // (activePlayers.length + votedOffReversed.length)
                            const maxPlacement = activePlayers.length + votedOffReversed.length
                            const isFirst  = placement === maxPlacement
                            const isSecond = placement === maxPlacement - 1
                            const isThird  = placement === maxPlacement - 2
                            const bgColor = isFirst ? '#d97706' : isSecond ? '#9ca3af' : isThird ? '#b45309' : isJury ? '#71717a' : '#3f3f46'
                            const label   = isFirst ? '🥇 1st' : isSecond ? '🥈 2nd' : isThird ? '🥉 3rd'
                              : isJury ? `JURY - ${ordinal(placement)}` : ordinal(placement)
                            return (
                              <div
                                className="rounded px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wide text-center"
                                style={{ backgroundColor: bgColor }}
                              >
                                {label}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="w-52 shrink-0 flex flex-col gap-3">
                  <h2 className="text-2xl font-black uppercase tracking-widest mb-1">Stats</h2>
                  <div className="rounded-xl p-3 border border-[#a07840] text-sm space-y-2" style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}>
                    <div><span className="text-zinc-600 text-xs uppercase font-bold">Players</span><p className="font-black text-xl">{activePlayers.length}/{MAX_PLAYERS}</p></div>
                    <div><span className="text-zinc-600 text-xs uppercase font-bold">Day</span><p className="font-black text-xl">{currentDay}</p></div>
                    <div><span className="text-zinc-600 text-xs uppercase font-bold">Online</span><p className="font-black text-xl">{onlineUserIds.size}</p></div>
                  </div>

                  {voteHistoryNewestFirst.length > 0 && (
                    <>
                      <h3 className="font-black uppercase tracking-widest text-sm mt-1">Tribal History</h3>
                      <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '40vh' }}>
                        {/* CHANGED: iterating voteHistoryNewestFirst so most recent is at top */}
                        {voteHistoryNewestFirst.map(record => (
                          <div key={record.day} className="rounded-xl p-3 border border-[#a07840] text-xs" style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}>
                            <p className="font-black uppercase tracking-wide text-sm mb-1">Day {record.day}</p>
                            <p className="font-bold text-red-800 uppercase tracking-wide mb-1">🪦 {record.username}</p>
                            {/* CHANGED: rocks_drawn only shown when 0 votes, with new copy */}
                            {record.rocks_drawn ? (
                              <p className="text-zinc-700 uppercase font-bold tracking-wide text-xs">
                                0 votes were cast, thus... ROCKS WERE DRAWN
                              </p>
                            ) : (
                              <div className="space-y-0.5">
                                {Object.entries(record.vote_counts).map(([name, count]) => (
                                  <p key={name} className="text-zinc-700 uppercase font-semibold tracking-wide">{name}: {count} VOTE{count !== 1 ? 'S' : ''}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

        </div>
      </div>
    </main>
  )
}