'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
}

type Tab = 'Players' | 'Camp' | 'Challenge Beach' | 'Tiki Court' | 'Summary'
type CampSubPage = 'Camp 1' | 'Camp 2' | 'Jungle' | 'Water Well'

type ChallengeResult = {
  day: number
  immunity_winner: 'malolo' | 'kaliki' | 'raro'
  reward_winner: 'malolo' | 'kaliki' | 'raro'
}

type VoteRecord = {
  day: number
  voted_off: string   // user_id
  username: string
  vote_counts: Record<string, number> // username -> count
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PLAYERS = 18
const DAY_DURATION_MS = 5 * 60 * 1000   // 5 minutes per day
const MERGE_AT = 10

const TRIBE_MALOLO = 'malolo'
const TRIBE_KALIKI = 'kaliki'
const TRIBE_RARO   = 'raro'

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
  const [campPage,        setCampPage]        = useState<CampSubPage>('Camp 1')

  // Presence & UI
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [dotCount,      setDotCount]      = useState(1)
  const [countdown,     setCountdown]     = useState<number>(0)  // ms remaining in day

  // Profile sidebar
  const [rank,     setRank]     = useState<string | null>(null)
  const [coins,    setCoins]    = useState<number | null>(null)
  const [crowns,   setCrowns]   = useState<number | null>(null)
  const [joinedAt, setJoinedAt] = useState<string | null>(null)

  // Vote history for summary tab
  const [voteHistory, setVoteHistory] = useState<VoteRecord[]>([])

  const chatRef       = useRef<HTMLDivElement>(null)
  const lobbyChatRef  = useRef<HTMLDivElement>(null)
  const lobbyRef      = useRef<any>(null)   // mirror of `lobby` for use in intervals

  // ─── Derived game state ───────────────────────────────────────────────────

  const gameStarted   = !!lobby?.started_at
  const currentDay    = lobby?.current_day ?? 0
  const tribeAssign   = (lobby?.tribe_assignments ?? {}) as Record<string, string>
  const votedOffIds   = (lobby?.voted_off ?? []) as string[]
  const challengeResults = (lobby?.challenge_results ?? []) as ChallengeResult[]
  const activePlayers = players.filter(p => !votedOffIds.includes(p.user_id))
  const remainingCount = activePlayers.length

  const me          = players.find(p => p.user_id === currentUserId) ?? null
  const iAmActive   = me ? !votedOffIds.includes(me.user_id) : false
  const myTribe     = me ? tribeAssign[me.user_id] : null
  const isMerged    = gameStarted && remainingCount <= MERGE_AT

  // Today's challenge result (day N result is posted when day flips to N+1)
  const todayResult = challengeResults.find(r => r.day === currentDay - 1) ?? null
  const losingTribe = todayResult ? (todayResult.immunity_winner === TRIBE_MALOLO ? TRIBE_KALIKI : TRIBE_MALOLO) : null

  // Can I access Tiki Court?
  // - Game must have started
  // - Day must be >= 2
  // - I must be active (not voted off, and actually a player)
  // - Pre-merge: only losing tribe on day >= 2
  // - Post-merge: every active player on every day >= 2
  const canAccessTikiCourt = (() => {
    if (!gameStarted || currentDay < 2 || !iAmActive) return false
    if (isMerged) return true
    return myTribe === losingTribe
  })()

  // Tab lock: before game starts, only Players tab is accessible
  const tabAccessible = (tab: Tab): boolean => {
    if (tab === 'Players') return true
    if (!gameStarted) return false
    if (tab === 'Tiki Court') return canAccessTikiCourt
    return true
  }

  // Camp sub-pages: post-merge, collapse to single camp
  const campPages: CampSubPage[] = isMerged
    ? ['Camp 1', 'Jungle', 'Water Well']
    : ['Camp 1', 'Camp 2', 'Jungle', 'Water Well']

  // Players split by tribe for Players tab
  const maloloPlayers = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_MALOLO)
  const kalikiPlayers = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_KALIKI)
  const raroPlayers   = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_RARO)

  // Who can I vote for? My own tribe members only (excluding myself)
  const voteablePlayers = activePlayers.filter(p =>
    p.user_id !== currentUserId && tribeAssign[p.user_id] === myTribe
  )

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

  // Keep lobbyRef in sync
  useEffect(() => { lobbyRef.current = lobby }, [lobby])

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
      const l = lobbyRef.current
      if (!l?.day_ends_at) { setCountdown(0); return }
      const remaining = new Date(l.day_ends_at).getTime() - Date.now()
      setCountdown(Math.max(0, remaining))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  // ─── Day advancement (client-side leader election: lowest user_id acts) ───

  useEffect(() => {
    if (!gameStarted || !lobbyId || !currentUserId) return
    if (countdown > 0) return
    // Only the player with the lowest user_id advances the day to avoid race dupes
    const sortedIds = [...players.map(p => p.user_id)].sort()
    if (sortedIds[0] !== currentUserId) return
    advanceDay(lobbyId)
  }, [countdown, gameStarted, currentUserId, lobbyId])

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

  // ─── Load vote history for summary ───────────────────────────────────────

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

    // Auto-start game when 18th player joins
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
      .eq('topic', 'camp').order('created_at', { ascending: true })
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
    // Load all votes grouped by day
    const { data: allVotes } = await supabase
      .from('votes').select('*').eq('lobby_id', id).order('day', { ascending: true })
    if (!allVotes || allVotes.length === 0) { setVoteHistory([]); return }

    const days = [...new Set(allVotes.map(v => v.day))]
    const allIds = [...new Set([...allVotes.map(v => v.voter_id), ...allVotes.map(v => v.target_id)])]
    const { data: profileData } = await supabase.from('profiles').select('id, username').in('id', allIds)
    const nameMap = Object.fromEntries((profileData || []).map((p: any) => [p.id, p.username]))

    const history: VoteRecord[] = days.map(day => {
      const dayVotes = allVotes.filter(v => v.day === day)
      const counts: Record<string, number> = {}
      dayVotes.forEach(v => {
        const name = nameMap[v.target_id] || v.target_id.slice(0, 8)
        counts[name] = (counts[name] || 0) + 1
      })
      // Find who got most votes
      const maxVotes = Math.max(...Object.values(counts))
      const tied = Object.entries(counts).filter(([, c]) => c === maxVotes).map(([n]) => n)
      const votedOffName = tied[Math.floor(Math.random() * tied.length)]
      const votedOffId = allVotes.find(v => nameMap[v.target_id] === votedOffName)?.target_id ?? ''
      return { day, voted_off: votedOffId, username: votedOffName, vote_counts: counts }
    })
    setVoteHistory(history)
  }

  // ─── Game logic ──────────────────────────────────────────────────────────

  async function startGame(id: string, allPlayers: Player[], lobbyData: any) {
    // Optimistic lock: only one client should write this
    const { data: check } = await supabase.from('lobbies').select('started_at').eq('id', id).maybeSingle()
    if (check?.started_at) return   // already started by another client

    const shuffled = shuffleArray(allPlayers.map(p => p.user_id))
    const tribeAssignments: Record<string, string> = {}
    shuffled.forEach((uid, i) => {
      tribeAssignments[uid] = i < MAX_PLAYERS / 2 ? TRIBE_MALOLO : TRIBE_KALIKI
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
    // Guard: don't advance if day_ends_at is still in the future (another client already advanced)
    if (new Date(l.day_ends_at).getTime() > Date.now() + 2000) return

    const newDay = (l.current_day ?? 1) + 1
    const dayEndsAt = new Date(Date.now() + DAY_DURATION_MS)

    // Generate challenge results for the day that just ended (previous day)
    const prevDay = newDay - 1
    const existingResults: ChallengeResult[] = l.challenge_results ?? []
    const alreadyHasResult = existingResults.some(r => r.day === prevDay)

    let newResults = existingResults
    if (!alreadyHasResult && prevDay >= 1) {
      const remaining = Object.entries(l.tribe_assignments ?? {})
        .filter(([uid]) => !(l.voted_off ?? []).includes(uid))
        .map(([, tribe]) => tribe)
      const uniqueTribes = [...new Set(remaining)]

      if (uniqueTribes.length >= 2) {
        const tribes = uniqueTribes as ('malolo' | 'kaliki' | 'raro')[]
        const immunityWinner = tribes[Math.floor(Math.random() * tribes.length)]
        const rewardWinner   = tribes[Math.floor(Math.random() * tribes.length)]
        newResults = [...existingResults, { day: prevDay, immunity_winner: immunityWinner, reward_winner: rewardWinner }]
      }
    }

    // Process votes for day that just ended and eliminate player
    let newVotedOff: string[] = l.voted_off ?? []
    const { data: dayVotes } = await supabase
      .from('votes').select('*').eq('lobby_id', id).eq('day', prevDay)

    if (dayVotes && dayVotes.length > 0) {
      const counts: Record<string, number> = {}
      dayVotes.forEach((v: any) => { counts[v.target_id] = (counts[v.target_id] || 0) + 1 })
      const maxVotes = Math.max(...Object.values(counts))
      const tied = Object.keys(counts).filter(uid => counts[uid] === maxVotes)
      const eliminated = tied[Math.floor(Math.random() * tied.length)]
      if (!newVotedOff.includes(eliminated)) {
        newVotedOff = [...newVotedOff, eliminated]
      }
    }

    // Check for merge
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

  async function sendMessage(tribe: string) {
    if (!text.trim() || !lobbyId || !iAmActive) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('messages').insert({
      season_id: lobbyId, sender_id: user.id, content: text.trim(), topic: tribe,
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

  // ─── Chat panel ───────────────────────────────────────────────────────────

  function ChatPanel({ topic, scrollRef }: { topic: string, scrollRef: React.RefObject<HTMLDivElement | null> }) {
    const canChat = iAmActive && myTribe === topic
    return (
      <div className="bg-[#b8955a]/50 rounded-xl p-3 flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
          {messages.filter(m => true).map(m => (
            <div key={m.id} className="bg-[#b8955a] p-3 rounded">
              <div className="flex justify-between mb-1">
                <p className="text-yellow-800 font-bold text-sm">{m.username}</p>
                <p className="text-xs text-zinc-600">Day {getMessageDay(m.created_at)}</p>
              </div>
              <p className="text-sm">{m.content}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2 shrink-0">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={!canChat}
            className="flex-1 bg-[#c8a96e] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
            placeholder={canChat ? 'Type message...' : 'You cannot chat here'}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(topic) }}
          />
          <button
            onClick={() => sendMessage(topic)}
            disabled={!canChat}
            className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer"
          >
            Send
          </button>
        </div>
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

  return (
    <main
      className="min-h-screen text-white flex gap-5 px-5 pb-5 pt-8 justify-center"
      style={{ backgroundImage: 'url(/castawaywallpaper.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      {/* ══ LEFT COLUMN ══ */}
      <aside className="w-64 shrink-0 flex flex-col gap-4" style={{ height: 'calc(78vh + 2.5rem)' }}>

        {/* Day Counter — scroll.png */}
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
                color: myTribe === TRIBE_MALOLO ? '#f59e0b' : myTribe === TRIBE_KALIKI ? '#60a5fa' : '#a78bfa'
              }}>
                {myTribe === TRIBE_MALOLO ? 'Malolo' : myTribe === TRIBE_KALIKI ? 'Kaliki' : 'Raro'}
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

        {/* Clock — fills remaining space to align with bottom of right column */}
        <div
          className="flex-1 rounded-2xl border border-[#a07840] flex flex-col items-center justify-center"
          style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}
        >
          {currentDay === 0 ? (
            <p className="text-center font-bold text-zinc-800 text-sm px-4 italic">
              The game will start soon!
            </p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800 mb-1">Clock</p>
              <p className="font-black text-4xl tracking-[0.15em] text-zinc-900 tabular-nums">
                {formatCountdown(countdown)}
              </p>
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
                {tab}
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
                /* Pre-game: flat grid + lobby chat */
                <>
                  <div className="grid grid-cols-9 gap-3 mb-4">
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
                                <span className="text-lg font-black text-amber-900">{player.username.slice(0, 1).toUpperCase()}</span>
                              </div>
                            ) : null}
                          </div>
                          {player && (
                            <p className="text-[10px] font-semibold text-center leading-tight text-zinc-800 truncate w-full">
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
                /* Post-merge: single Raro tribe */
                <div>
                  <p className="text-center font-black uppercase tracking-widest text-lg mb-3" style={{ color: '#7c3aed' }}>
                    ⚔ Raro — The Merge Tribe
                  </p>
                  <div className="grid grid-cols-10 gap-2">
                    {raroPlayers.map(p => <PlayerAvatar key={p.user_id} player={p} size="sm" />)}
                  </div>
                </div>
              ) : (
                /* Two-tribe view */
                <div className="flex flex-col gap-6">
                  {/* Malolo */}
                  <div>
                    <p className="font-black uppercase tracking-widest text-base mb-2" style={{ color: '#b45309' }}>
                      🔥 Tribe Malolo
                    </p>
                    <div className="grid grid-cols-9 gap-2">
                      {maloloPlayers.map(p => <PlayerAvatar key={p.user_id} player={p} size="sm" />)}
                    </div>
                  </div>
                  {/* Kaliki */}
                  <div>
                    <p className="font-black uppercase tracking-widest text-base mb-2" style={{ color: '#1d4ed8' }}>
                      🌊 Tribe Kaliki
                    </p>
                    <div className="grid grid-cols-9 gap-2">
                      {kalikiPlayers.map(p => <PlayerAvatar key={p.user_id} player={p} size="sm" />)}
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
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition border cursor-pointer ${campPage === page ? 'bg-amber-900 text-[#f0ddb0] border-amber-950' : 'bg-[#b8955a] text-zinc-800 border-[#a07840] hover:bg-[#a07840]'}`}
                  >
                    {isMerged && page === 'Camp 1' ? 'Raro Camp' : page}
                  </button>
                ))}
              </div>

              {campPage === 'Camp 1' && (
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="w-1/2" />
                  <div className="w-1/2 flex flex-col min-h-0 h-full">
                    <h2 className="text-xl font-bold mb-3 shrink-0">
                      {isMerged ? 'Raro Camp Chat' : 'Malolo Camp Chat'}
                    </h2>
                    <ChatPanel topic={isMerged ? TRIBE_RARO : TRIBE_MALOLO} scrollRef={chatRef} />
                  </div>
                </div>
              )}

              {campPage === 'Camp 2' && !isMerged && (
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="w-1/2" />
                  <div className="w-1/2 flex flex-col min-h-0 h-full">
                    <h2 className="text-xl font-bold mb-3 shrink-0">Kaliki Camp Chat</h2>
                    <ChatPanel topic={TRIBE_KALIKI} scrollRef={chatRef} />
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
                  <div className="flex gap-4">
                    <div className="flex-1 bg-[#c8a96e] rounded-xl p-4 border border-[#a07840] text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">Immunity Winner</p>
                      <p className="text-2xl font-black capitalize">{todayResult.immunity_winner}</p>
                    </div>
                    <div className="flex-1 bg-[#c8a96e] rounded-xl p-4 border border-[#a07840] text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">Reward Winner</p>
                      <p className="text-2xl font-black capitalize">{todayResult.reward_winner}</p>
                    </div>
                  </div>
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
                <button className="px-8 py-4 rounded-xl font-black text-lg uppercase tracking-wide bg-[#8b6840] text-[#f0ddb0] border-2 border-[#6b4820] hover:bg-[#7a5830] transition shadow-md cursor-pointer">
                  Reward Challenge
                </button>
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
                  <div className="bg-[#c8a96e] rounded-xl p-3 border border-[#a07840] text-center">
                    <p className="font-bold text-zinc-700">You have already voted today.</p>
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

                {/* Parchment */}
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
          {activeTab === 'Summary' && (
            <div className="p-5 h-full text-zinc-900 flex gap-5">
              {/* Left — castaway grid */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-black uppercase tracking-widest mb-4">Castaways</h2>
                <div className="grid grid-cols-6 gap-2">
                  {[...players]
                    .sort((a, b) => a.username.localeCompare(b.username))
                    .map(player => <PlayerAvatar key={player.user_id} player={player} size="sm" />)}
                </div>
              </div>

              {/* Right — stats + vote history */}
              <div className="w-52 shrink-0 flex flex-col gap-3">
                <h2 className="text-2xl font-black uppercase tracking-widest mb-1">Stats</h2>
                <div className="rounded-xl p-3 border border-[#a07840] text-sm space-y-2" style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}>
                  <div><span className="text-zinc-600 text-xs uppercase font-bold">Players</span><p className="font-black text-xl">{activePlayers.length}/{MAX_PLAYERS}</p></div>
                  <div><span className="text-zinc-600 text-xs uppercase font-bold">Day</span><p className="font-black text-xl">{currentDay}</p></div>
                  <div><span className="text-zinc-600 text-xs uppercase font-bold">Online</span><p className="font-black text-xl">{onlineUserIds.size}</p></div>
                </div>

                {voteHistory.length > 0 && (
                  <>
                    <h3 className="font-black uppercase tracking-widest text-sm mt-1">Tribal History</h3>
                    <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '40vh' }}>
                      {voteHistory.map(record => (
                        <div key={record.day} className="rounded-xl p-3 border border-[#a07840] text-xs" style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}>
                          <p className="font-black uppercase tracking-wide mb-1">Day {record.day}</p>
                          <p className="font-bold text-red-800 mb-1">🪦 {record.username}</p>
                          <div className="space-y-0.5">
                            {Object.entries(record.vote_counts).map(([name, count]) => (
                              <p key={name} className="text-zinc-700">{name}: {count} vote{count !== 1 ? 's' : ''}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}