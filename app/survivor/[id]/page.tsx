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
  is_whisper?: boolean
  whisper_to?: string | null
}

type Tab = 'Players' | 'Camp' | 'Challenge Beach' | 'Tiki Court' | 'Summary'
type CampSubPage = 'Malolo Tribe' | 'Kaliki Tribe' | 'Jungle' | 'Water Well'
type CampLocationKey = 'shelter' | 'beach' | 'jungle' | 'river' | 'mountain' | 'cave' | 'waterwell'

type ChallengeResult = {
  day: number
  immunity_winner: 'malolo' | 'kaliki' | 'raro' | string
  reward_winner: 'malolo' | 'kaliki' | 'raro' | string
  individual_immunity?: string
  voted_off?: string
}

type VoteRecord = {
  day: number
  voted_off: string
  username: string
  vote_counts: Record<string, number>
  tribe_key?: string
  rocks_drawn?: boolean
  is_winner?: boolean
}

type VoteRow = {
  voter_id: string
  target_id: string
  day: number
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

const TRIBE_NAME_OPTIONS = [
  'Makoa',
  'Mana',
  'Kai',
  'Tapu',
  'Ariki',
  'Taonga',
  'Rangi',
  'Vakuna',
  'Motu',
  'Malolo',
  'Raro',
  'Aurora',
]

const TRIBE_COLOR_OPTIONS = [
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#059669',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#e11d48',
]

const WOOD_GRAIN = `
  repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px),
  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.015) 5px, rgba(0,0,0,0.015) 6px)
`
const WOOD_GRAIN_DARK = `
  repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px),
  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)
`

const CAMP_LOCATIONS: Record<CampLocationKey, {
  label: string
  background?: string
  actions: string[]
  left?: CampLocationKey
  right?: CampLocationKey
}> = {
  shelter: {
    label: 'Shelter',
    actions: ['Tribe Flag', 'Bulletin Board', 'Search Bag', 'Search for Idol'],
    right: 'beach',
  },
  beach: {
    label: 'Beach',
    background: '/locationbeach.jpg',
    actions: ['Message in a Bottle', 'Gather Coconuts', 'Collect Seashells'],
    left: 'shelter',
    right: 'jungle',
  },
  jungle: {
    label: 'Jungle',
    background: '/locationjungle2.jpg',
    actions: ['Build a Spyshack', 'Search for Idol', 'Set Trap'],
    left: 'beach',
    right: 'river',
  },
  river: {
    label: 'River',
    background: '/locationriver.jpg',
    actions: ['Catch Fish', 'Search for Idol'],
    left: 'jungle',
    right: 'mountain',
  },
  mountain: {
    label: 'Mountain',
    background: '/locationmountain.jpg',
    actions: ['Predict Weather', 'Light Signal Fire', 'Search for Idol'],
    left: 'river',
    right: 'cave',
  },
  cave: {
    label: 'Cave',
    background: '/locationcave.jpg',
    actions: ['Cave Paintings', 'Search for Idol', 'Offering to Ancient Deities'],
    left: 'mountain',
  },
  waterwell: {
    label: 'Water Well',
    actions: ['Gather Water', 'Spread Rumors', 'Search for Idol'],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickTribeBranding(keys: string[], existingValues: string[] = []): { names: Record<string, string>, colors: Record<string, string> } {
  const selectedNames = new Set(existingValues.filter(value => !value.startsWith('#')))
  const selectedColors = new Set(existingValues.filter(value => value.startsWith('#')))
  const namePool = shuffleArray(TRIBE_NAME_OPTIONS.filter(name => !selectedNames.has(name)))
  const colorPool = shuffleArray(TRIBE_COLOR_OPTIONS.filter(color => !selectedColors.has(color)))
  const names: Record<string, string> = {}
  const colors: Record<string, string> = {}

  keys.forEach(key => {
    const name = namePool.find(option => !selectedNames.has(option))
      ?? TRIBE_NAME_OPTIONS.find(option => !selectedNames.has(option))
      ?? TRIBE_NAME_OPTIONS[0]
    const color = colorPool.find(option => !selectedColors.has(option))
      ?? TRIBE_COLOR_OPTIONS.find(option => !selectedColors.has(option))
      ?? TRIBE_COLOR_OPTIONS[0]

    names[key] = name
    colors[key] = color
    selectedNames.add(name)
    selectedColors.add(color)
  })

  return { names, colors }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
  const s = (totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── ChatPanel ───────────────────────────────────────────────────────────────

type ChatPanelProps = {
  tribeKey: string
  canChat: boolean
  messages: Message[]
  text: string
  setText: (v: string) => void
  onSend: (whisperTo: string | null) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  getMessageDay: (createdAt?: string) => number
  onlineUserIds: Set<string>
  onClickUsername: (username: string) => void
  tribeMembers: { user_id: string; username: string }[]
  currentUserId: string
}

function ChatPanel({ tribeKey, canChat, messages, text, setText, onSend, scrollRef, getMessageDay, onlineUserIds, onClickUsername, tribeMembers, currentUserId }: ChatPanelProps) {
  const [whisperOn,     setWhisperOn]     = useState(false)
  const [whisperTarget, setWhisperTarget] = useState('')
  const [whisperError,  setWhisperError]  = useState(false)

  const isLockedRef      = useRef(false)
  const unlockTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tribeMessages = messages.filter(m => m.topic === tribeKey)

  useEffect(() => {
    if (!isLockedRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [tribeMessages.length, scrollRef])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (atBottom) {
      isLockedRef.current = false
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
    } else {
      isLockedRef.current = true
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
    }
  }

  function handleSend() {
    if (whisperOn) {
      if (!whisperTarget) { setWhisperError(true); return }
      setWhisperError(false)
      onSend(whisperTarget)
    } else {
      setWhisperError(false)
      onSend(null)
    }
  }

  return (
    <div className="bg-[#b8955a]/50 rounded-xl p-3 flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto pr-1 min-h-0">
        <div className="flex flex-col justify-end min-h-full">
        <div className="space-y-2">
        {tribeMessages.map(m => {
          const isOnline  = onlineUserIds.has(m.sender_id)
          const isWhisper = !!m.is_whisper
          const isSentByMe = m.sender_id === currentUserId
          return (
            <div key={m.id} className="p-3 rounded bg-[#b8955a]">
              <div className="flex justify-between mb-1">
                <span className="inline-flex items-center gap-1.5">
                  {isWhisper ? (
                    isSentByMe ? (
                      <span className="font-bold text-sm italic" style={{ color: '#dc143c' }}>
                        {`[Whisper to ${tribeMembers.find(p => p.user_id === m.whisper_to)?.username ?? 'someone'}]`}
                      </span>
                    ) : (
                      <span className="font-bold text-sm italic" style={{ color: '#dc143c' }}>
                        {`[Whisper from ${m.username}]`}
                      </span>
                    )
                  ) : (
                    <>
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
                    </>
                  )}
                </span>
                <p className="text-xs text-zinc-600">Day {getMessageDay(m.created_at)}</p>
              </div>
              <p className="text-sm">{m.content}</p>
            </div>
          )
        })}
        </div>
        </div>
      </div>

      <div className="flex gap-2 mt-2 shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={!canChat}
          className="flex-1 bg-[#c8a96e] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
          placeholder={canChat ? 'Type message...' : 'You cannot chat here'}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
        />
        <button
          onClick={handleSend}
          disabled={!canChat}
          className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer"
        >
          Send
        </button>
      </div>

      {canChat && (
        <div className="mt-1.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {whisperOn && (
              <select
                value={whisperTarget}
                onChange={e => { setWhisperTarget(e.target.value); setWhisperError(false) }}
                className="flex-1 bg-[#c8a96e] border border-[#a07840] rounded text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-red-700 text-zinc-900 cursor-pointer"
              >
                <option value="">Whisper to...</option>
                {tribeMembers
                  .filter(p => p.user_id !== currentUserId)
                  .map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.username}</option>
                  ))}
              </select>
            )}
            <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto">
              <input
                type="checkbox"
                checked={whisperOn}
                onChange={e => {
                  setWhisperOn(e.target.checked)
                  setWhisperError(false)
                  if (!e.target.checked) setWhisperTarget('')
                }}
                className="w-3.5 h-3.5 accent-red-700 cursor-pointer"
              />
              <span
                className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                style={{ background: '#b94040', color: '#ffe0e0' }}
              >
                Whisper?
              </span>
            </label>
          </div>
          {whisperError && (
            <p className="text-red-700 text-xs italic mt-1">No recipient selected.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()

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
  const [campLocation,    setCampLocation]    = useState<CampLocationKey>('jungle')

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [dotCount,      setDotCount]      = useState(1)
  const [countdown,     setCountdown]     = useState<number>(0)
  const [isPaused,      setIsPaused]      = useState(false)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [timerAmount, setTimerAmount] = useState('5')
  const [timerUnit, setTimerUnit] = useState<'seconds' | 'minutes'>('minutes')

  const [rank,     setRank]     = useState<string | null>(null)
  const [coins,    setCoins]    = useState<number | null>(null)
  const [crowns,   setCrowns]   = useState<number | null>(null)
  const [joinedAt, setJoinedAt] = useState<string | null>(null)

  // Admin flag + music preference, both pulled from the profiles table.
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(false)

  const [voteHistory,   setVoteHistory]   = useState<VoteRecord[]>([])
  const [voteInfoRecord, setVoteInfoRecord] = useState<VoteRecord | null>(null)
  const [placementMap,  setPlacementMap]  = useState<Record<string, number>>({})
  const [winnerUsername, setWinnerUsername] = useState<string | null>(null)

  const [hasFilled, setHasFilled] = useState(false)

  const [reunionText,      setReunionText]      = useState('')
  const [reunionMessages,  setReunionMessages]  = useState<Message[]>([])
  const [finaleVoteTarget, setFinaleVoteTarget] = useState('')
  const [hasFinaleVoted,   setHasFinaleVoted]   = useState(false)
  const reunionChatRef = useRef<HTMLDivElement>(null)

  const campPageSetRef = useRef(false)

  const chatRef          = useRef<HTMLDivElement>(null)
  const lobbyChatRef     = useRef<HTMLDivElement>(null)
  const lobbyRef         = useRef<any>(null)
  const playersRef       = useRef<Player[]>([])
  const isPausedRef      = useRef(false)
  const pausedAtRef      = useRef<number | null>(null)
  const advancingRef     = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)

  // Tribal council theme audio element (created lazily, lives across tab switches)
  const tikiAudioRef = useRef<HTMLAudioElement | null>(null)

  // ─── Derived game state ───────────────────────────────────────────────────

  const gameStarted      = !!lobby?.started_at
  const currentDay       = lobby?.current_day ?? 0
  const tribeAssign      = (lobby?.tribe_assignments ?? {}) as Record<string, string>
  const tribeNames       = (lobby?.tribe_names ?? {}) as Record<string, string>
  const tribeColors      = (lobby?.tribe_colors ?? {}) as Record<string, string>
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

  const isFinale   = !!lobby?.is_finale
  const isFinished = !!lobby?.finished_at
  const finalists  = activePlayers
  const preMergeBootCount = MAX_PLAYERS - MERGE_AT
  const juryIds    = votedOffIds.filter((_, idx) => idx >= preMergeBootCount)
  const canReunionChat = !isFinished && (juryIds.includes(_uid) || activePlayers.some(p => p.user_id === _uid))

  const todayResult = challengeResults.find(r => r.day === currentDay - 1) ?? null
  const immunityWinnerTribe = todayResult ? normalizeTribeKey(todayResult.immunity_winner) : ''
  const losingTribe = immunityWinnerTribe === TRIBE_1 || immunityWinnerTribe === TRIBE_2
    ? (immunityWinnerTribe === TRIBE_1 ? TRIBE_2 : TRIBE_1)
    : null

  const todayIndividualImmune = (isMerged && todayResult?.individual_immunity) ? todayResult.individual_immunity : null
  const iAmImmune = todayIndividualImmune === _uid

  const isFinalThree = gameStarted && remainingCount === 3 && !isFinale && !isFinished
  const canAccessChallengeBeach = gameStarted && remainingCount > 0 && !isFinale && !isFinished

  const canAccessTikiCourt = (() => {
    if (!gameStarted || currentDay < 2 || !iAmActive) return false
    if (isFinale || isFinished) return false
    if (isMerged) return true
    return normalizeTribeKey(myTribe) === losingTribe
  })()

  const tabAccessible = (tab: Tab): boolean => {
    if (tab === 'Players') return true
    if (tab === 'Summary') return true
    if (isFinale || isFinished) return false
    if (!gameStarted) return false
    if (tab === 'Tiki Court') return canAccessTikiCourt
    if (tab === 'Challenge Beach') return canAccessChallengeBeach
    return true
  }

  const campPages: CampSubPage[] = isMerged
    ? ['Malolo Tribe', 'Jungle', 'Water Well']
    : ['Malolo Tribe', 'Kaliki Tribe', 'Jungle', 'Water Well']
  const visibleCampLocation = campPage === 'Water Well' ? CAMP_LOCATIONS.waterwell : CAMP_LOCATIONS[campLocation]

  useEffect(() => {
    if (campPageSetRef.current) return
    if (!myTribe || !gameStarted) return
    campPageSetRef.current = true
    if (myTribe === TRIBE_2) {
      setCampPage('Kaliki Tribe')
    } else {
      setCampPage('Malolo Tribe')
    }
  }, [myTribe, gameStarted])

  const tribe1Players   = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_1)
  const tribe2Players   = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_2)
  const raroPlayers     = activePlayers.filter(p => tribeAssign[p.user_id] === TRIBE_RARO)
  const voteablePlayers = activePlayers.filter(p =>
    p.user_id !== _uid &&
    normalizeTribeKey(tribeAssign[p.user_id]) === normalizeTribeKey(myTribe) &&
    p.user_id !== todayIndividualImmune
  )
  const tikiCourtTribeKey = isMerged ? TRIBE_RARO : losingTribe
  const tikiCourtPlayers = tikiCourtTribeKey
    ? activePlayers.filter(p => isMerged || normalizeTribeKey(tribeAssign[p.user_id]) === tikiCourtTribeKey)
    : []

  function normalizeTribeKey(key?: string | null): string {
    const normalized = (key ?? '').toLowerCase().replace(/\s*tribe\s*$/i, '').trim()
    const brandedEntry = Object.entries(tribeNames)
      .find(([, name]) => name.toLowerCase() === normalized)
    if (brandedEntry) return brandedEntry[0]
    if (normalized === TRIBE_1_NAME.toLowerCase()) return TRIBE_1
    if (normalized === TRIBE_2_NAME.toLowerCase()) return TRIBE_2
    if (normalized === TRIBE_RARO_NAME.toLowerCase()) return TRIBE_RARO
    return normalized
  }

  function tribeName(key: string): string {
    const tribeKey = normalizeTribeKey(key)
    if (tribeNames[tribeKey]) return tribeNames[tribeKey]
    if (tribeKey === TRIBE_1) return TRIBE_1_NAME
    if (tribeKey === TRIBE_2) return TRIBE_2_NAME
    if (tribeKey === TRIBE_RARO) return TRIBE_RARO_NAME
    return key
  }

  function tribeColor(key: string): string {
    const tribeKey = normalizeTribeKey(key)
    if (tribeColors[tribeKey]) return tribeColors[tribeKey]
    if (tribeKey === TRIBE_1) return '#b45309'
    if (tribeKey === TRIBE_2) return '#1d4ed8'
    if (tribeKey === TRIBE_RARO) return '#7c3aed'
    return '#3f3f46'
  }

  function textGlow(color: string): string {
    return `0 1px 2px rgba(0,0,0,0.95), 0 0 8px ${color}`
  }

  function sortedVoteEntries(record: VoteRecord): [string, number][] {
    return Object.entries(record.vote_counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }

  function voteCountSummary(record: VoteRecord): string {
    const counts = sortedVoteEntries(record).map(([, count]) => count)
    return counts.length > 0 ? `Vote count of (${counts.join('-')})` : '0 votes cast'
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
    loadReunionMessages(lobbyId)
    loadPlacementMap(lobbyId)

    const interval = setInterval(() => {
      loadPlayers(lobbyId)
      loadMessages(lobbyId)
      loadLobbyMessages(lobbyId)
      loadReunionMessages(lobbyId)
      loadLobby(lobbyId)
      loadPlacementMap(lobbyId)
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
      .select('rank, coins, crowns, joined_at')
      .eq('username', me.username)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setRank(data.rank)
        setCoins(data.coins)
        setCrowns(data.crowns)
        setJoinedAt(data.joined_at)
      })
  }, [me?.username])

  // ─── Admin flag + music preference for the current user ──────────────────
  // Both columns live on `profiles`, keyed by the user's auth id.

  useEffect(() => {
    if (!currentUserId) return
    supabase
      .from('profiles')
      .select('is_admin, music_enabled')
      .eq('id', currentUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('PROFILE PREFS LOAD ERROR:', error); return }
        setIsAdmin(!!data?.is_admin)
        setMusicEnabled(!!data?.music_enabled)
      })
  }, [currentUserId])

  // ─── Winner username for the clock ───────────────────────────────────────

  useEffect(() => {
    if (!isFinished || !lobby?.winner_id) return
    const winner = players.find(p => p.user_id === lobby.winner_id)
    if (winner) setWinnerUsername(winner.username)
  }, [isFinished, lobby?.winner_id, players])

  // ─── Auto scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (lobbyChatRef.current) lobbyChatRef.current.scrollTop = 0
  }, [lobbyMessages])

  useEffect(() => {
    if (reunionChatRef.current) {
      reunionChatRef.current.scrollTop = reunionChatRef.current.scrollHeight
    }
  }, [reunionMessages])

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
    const interval = setInterval(() => {
      if (isPausedRef.current) return
      const l = lobbyRef.current
      if (!l?.started_at) return
      if (l.finished_at) return
      if (advancingRef.current) return
      if (!l.day_ends_at) return
      const remaining = new Date(l.day_ends_at).getTime() - Date.now()
      if (remaining > 0) return

      const id = l.id
      if (!id) return

      advancingRef.current = true
      supabase.functions.invoke('advance-games', { body: { lobbyId: id } }).then(({ error }) => {
        if (error) console.error('[advance-games] function failed:', error)
        loadLobby(id)
        loadPlayers(id)
        loadPlacementMap(id)
      }).finally(() => {
        setTimeout(() => { advancingRef.current = false }, 10000)
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Check if already finale-voted ──────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !currentUserId || !isFinale) return
    supabase.from('votes').select('id, target_id')
      .eq('lobby_id', lobbyId).eq('voter_id', currentUserId).eq('day', 9999)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setHasFinaleVoted(true); setFinaleVoteTarget(data.target_id) }
      })
  }, [lobbyId, currentUserId, isFinale])

  const lastLoadedVoteDayRef = useRef<number>(0)

  // ─── Check if already voted today ─────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !currentUserId || !currentDay) return

    if (currentDay !== lastLoadedVoteDayRef.current) {
      setHasVotedToday(false)
      setVotedName(null)
      setVoteTarget('')
      lastLoadedVoteDayRef.current = currentDay
    }

    supabase
      .from('votes')
      .select('id, target_id')
      .eq('lobby_id', lobbyId)
      .eq('voter_id', currentUserId)
      .eq('day', currentDay)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setHasVotedToday(true)
          setVoteTarget(data.target_id)
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.target_id)
            .maybeSingle()
          setVotedName(profile?.username ?? 'Unknown')
        } else {
          setHasVotedToday(false)
          setVotedName(null)
          setVoteTarget('')
        }
      })
  }, [lobbyId, currentUserId, currentDay])

  // ─── Vote history ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!lobbyId || !gameStarted) return
    loadVoteHistory(lobbyId)
  }, [lobbyId, gameStarted, votedOffIds.length, isFinished, lobby?.winner_id])

  // ─── Load placement map from Supabase ─────────────────────────────────────

  useEffect(() => {
    if (!lobbyId) return
    loadPlacementMap(lobbyId)
  }, [lobbyId])

  // ─── If active tab becomes locked, redirect to Players ───────────────────

  useEffect(() => {
    if (!tabAccessible(activeTab)) setActiveTab('Players')
  }, [gameStarted, canAccessTikiCourt, activeTab])

  // ─── Tribal Council music: play while on the Tiki Court tab, only if the
  //     current user has music_enabled set to true on their profile ────────

  useEffect(() => {
    const shouldPlay = activeTab === 'Tiki Court' && musicEnabled

    if (shouldPlay) {
      if (!tikiAudioRef.current) {
        const audio = new Audio('/tribalcounciltheme.mp3')
        audio.loop = true
        tikiAudioRef.current = audio
      }
      // play() returns a promise that can reject (e.g. autoplay policy) - swallow it safely
      tikiAudioRef.current.play().catch(err => console.warn('[tribal council music] play() blocked:', err))
    } else if (tikiAudioRef.current) {
      tikiAudioRef.current.pause()
      tikiAudioRef.current.currentTime = 0
    }
  }, [activeTab, musicEnabled])

  // Stop and release the audio entirely when the component unmounts
  useEffect(() => {
    return () => {
      if (tikiAudioRef.current) {
        tikiAudioRef.current.pause()
        tikiAudioRef.current.src = ''
        tikiAudioRef.current = null
      }
    }
  }, [])

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
    const uid = currentUserIdRef.current
    const visible = data.filter((m: any) =>
      !m.is_whisper || m.sender_id === uid || m.whisper_to === uid
    )
    const senderIds = [...new Set(visible.map((m: any) => m.sender_id))]
    const profileMap = await resolveUsernames(senderIds)
    setMessages(visible.map((m: any) => ({ ...m, username: profileMap[m.sender_id] || 'Unknown' })))
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
    const l = lobbyRef.current
    const votedOffList: string[] = l?.voted_off ?? []
    const votedOffDays: number[] = (l?.voted_off_days ?? []).map((day: any) => Number(day))
    const resultBootDays: Record<string, number> = Object.fromEntries(
      ((l?.challenge_results ?? []) as ChallengeResult[])
        .filter(result => !!result.voted_off)
        .map(result => [result.voted_off as string, result.day])
    )

    const { data: allVotes, error: votesError } = await supabase
      .from('votes')
      .select('voter_id, target_id, day')
      .eq('lobby_id', id)
      .order('day', { ascending: true })

    if (votesError) console.error('VOTE HISTORY LOAD ERROR:', votesError)

    const votes = (allVotes ?? []) as VoteRow[]
    const regularVotes = votes.filter(v => Number(v.day) < 9999)
    const finaleVotes = votes.filter(v => Number(v.day) === 9999)

    const allUserIds = [...new Set([
      ...votedOffList,
      ...(l?.winner_id ? [l.winner_id] : []),
      ...votes.map(v => v.voter_id),
      ...votes.map(v => v.target_id),
    ])]
    const { data: profileData } = allUserIds.length > 0
      ? await supabase.from('profiles').select('id, username').in('id', allUserIds)
      : { data: [] }
    const nameMap = Object.fromEntries((profileData || []).map((p: any) => [p.id, p.username]))

    const votesByDay: Record<number, Record<string, number>> = {}
    const voteDaysByTarget: Record<string, number[]> = {}
    for (const v of regularVotes) {
      const voteDay = Number(v.day)
      if (!Number.isFinite(voteDay)) continue
      if (!votesByDay[voteDay]) votesByDay[voteDay] = {}
      votesByDay[voteDay][v.target_id] = (votesByDay[voteDay][v.target_id] || 0) + 1
      if (!voteDaysByTarget[v.target_id]) voteDaysByTarget[v.target_id] = []
      if (!voteDaysByTarget[v.target_id].includes(voteDay)) voteDaysByTarget[v.target_id].push(voteDay)
    }

    Object.values(voteDaysByTarget).forEach(days => days.sort((a, b) => a - b))
    const usedDays = new Set<number>()

    const history: VoteRecord[] = votedOffList.map((eliminatedId, idx) => {
      const storedDay = votedOffDays[idx]
      const inferredDay = voteDaysByTarget[eliminatedId]?.find(day => !usedDays.has(day))
      const day = Number.isFinite(storedDay) && storedDay > 0
        ? storedDay
        : resultBootDays[eliminatedId] ?? inferredDay ?? idx + 2
      usedDays.add(day)

      const dayCounts = votesByDay[day] ?? {}
      const totalVotes = Object.values(dayCounts).reduce((s, n) => s + n, 0)

      if (totalVotes === 0) {
        return {
          day,
          voted_off: eliminatedId,
          username: nameMap[eliminatedId] || eliminatedId.slice(0, 8),
          vote_counts: {},
          tribe_key: normalizeTribeKey(l?.tribe_assignments?.[eliminatedId]),
          rocks_drawn: true,
        }
      }

      const vote_counts: Record<string, number> = {}
      Object.entries(dayCounts).forEach(([targetId, count]) => {
        const name = nameMap[targetId] || targetId.slice(0, 8)
        vote_counts[name] = count
      })

      return {
        day,
        voted_off: eliminatedId,
        username: nameMap[eliminatedId] || eliminatedId.slice(0, 8),
        vote_counts,
        tribe_key: normalizeTribeKey(l?.tribe_assignments?.[eliminatedId]),
        rocks_drawn: false,
      }
    })

    if (l?.finished_at && l?.winner_id) {
      const finaleCountsById: Record<string, number> = {}
      finaleVotes.forEach(v => {
        finaleCountsById[v.target_id] = (finaleCountsById[v.target_id] || 0) + 1
      })

      const winnerVoteCounts: Record<string, number> = {}
      Object.entries(finaleCountsById).forEach(([targetId, count]) => {
        const name = nameMap[targetId] || targetId.slice(0, 8)
        winnerVoteCounts[name] = count
      })

      history.push({
        day: Number(l.current_day ?? history.length + 1),
        voted_off: l.winner_id,
        username: nameMap[l.winner_id] || String(l.winner_id).slice(0, 8),
        vote_counts: winnerVoteCounts,
        tribe_key: normalizeTribeKey(l?.tribe_assignments?.[l.winner_id]) || TRIBE_RARO,
        rocks_drawn: Object.values(winnerVoteCounts).reduce((sum, count) => sum + count, 0) === 0,
        is_winner: true,
      })
    }

    setVoteHistory(history)
  }

  async function loadPlacementMap(id: string) {
    const { data, error } = await supabase
      .from('lobby_players')
      .select('user_id, placement')
      .eq('lobby_id', id)
    if (error || !data) return
    const map: Record<string, number> = {}
    data.forEach((row: any) => {
      if (row.placement != null) map[row.user_id] = row.placement
    })
    setPlacementMap(map)
  }

  async function loadReunionMessages(id: string) {
    const { data, error } = await supabase
      .from('messages').select('*').eq('season_id', id)
      .eq('topic', 'reunion').order('created_at', { ascending: true })
    if (error || !data || data.length === 0) { setReunionMessages([]); return }
    const senderIds = [...new Set(data.map((m: any) => m.sender_id))]
    const profileMap = await resolveUsernames(senderIds)
    setReunionMessages(data.map((m: any) => ({ ...m, username: profileMap[m.sender_id] || 'Unknown' })))
  }

  async function sendReunionMessage() {
    if (!reunionText.trim() || !lobbyId || !canReunionChat) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('messages').insert({
      season_id: lobbyId, sender_id: user.id, content: reunionText.trim(), topic: 'reunion',
    })
    setReunionText('')
    loadReunionMessages(lobbyId)
  }

  async function castFinaleVote(targetId: string) {
    if (!lobbyId || !currentUserId || hasFinaleVoted) return
    const { error } = await supabase.from('votes').insert({
      lobby_id: lobbyId, voter_id: currentUserId, target_id: targetId, day: 9999,
    })
    if (error) { console.error('FINALE VOTE ERROR:', error); return }
    setHasFinaleVoted(true)
    setFinaleVoteTarget(targetId)
    await resolveFinale(lobbyId)
  }

  async function resolveFinale(id: string, fromTimer = false) {
    const { data: freshLobby } = await supabase.from('lobbies').select('*').eq('id', id).maybeSingle()
    if (!freshLobby || freshLobby.finished_at) return

    const activeIds = Object.keys(freshLobby.tribe_assignments ?? {}).filter((uid: string) => !(freshLobby.voted_off ?? []).includes(uid))
    const preMerge = MAX_PLAYERS - MERGE_AT
    const jury = (freshLobby.voted_off ?? []).filter((_: any, idx: number) => idx >= preMerge)

    const { data: finaleVotes } = await supabase
      .from('votes').select('*').eq('lobby_id', id).eq('day', 9999)

    if (!fromTimer && (!finaleVotes || finaleVotes.length < jury.length)) return

    const counts: Record<string, number> = {}
    ;(finaleVotes ?? []).forEach((v: any) => { counts[v.target_id] = (counts[v.target_id] || 0) + 1 })

    let winner: string | null = null
    if (Object.keys(counts).length === 0 || activeIds.length === 0) {
      winner = activeIds[Math.floor(Math.random() * activeIds.length)] ?? null
    } else {
      const maxVotes = Math.max(...Object.values(counts))
      const tied = Object.keys(counts).filter(uid => counts[uid] === maxVotes)
      winner = tied[Math.floor(Math.random() * tied.length)]
    }
    if (!winner) return

    const runnerUp = activeIds.find(uid => uid !== winner) ?? null
    const placementWrites = [
      supabase.from('lobby_players').update({ placement: 1, in_game: false }).eq('lobby_id', id).eq('user_id', winner).select(),
    ]
    if (runnerUp) {
      placementWrites.push(
        supabase.from('lobby_players').update({ placement: 2, in_game: false }).eq('lobby_id', id).eq('user_id', runnerUp).select()
      )
    }
    await Promise.all(placementWrites)

    const { error } = await supabase.from('lobbies').update({
      finished_at: new Date().toISOString(),
      winner_id: winner,
    }).eq('id', id)
    if (error) console.error('[resolveFinale] update failed:', error)
    else console.log('[resolveFinale] Winner declared:', winner)
    loadLobby(id)
    loadPlacementMap(id)
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
    const initialBranding = pickTribeBranding([TRIBE_1, TRIBE_2])

    const now = new Date()
    const dayDurationMs = getDayDurationMs(lobbyData)
    const dayEndsAt = new Date(now.getTime() + dayDurationMs)

    await supabase.from('lobbies').update({
      started_at: now.toISOString(),
      current_day: 1,
      day_ends_at: dayEndsAt.toISOString(),
      tribe_assignments: tribeAssignments,
      tribe_names: initialBranding.names,
      tribe_colors: initialBranding.colors,
      challenge_results: [],
      voted_off: [],
      status: 'active',
    }).eq('id', id)

    loadLobby(id)
  }

  async function advanceDay(id: string) {
    const { data: freshLobby } = await supabase.from('lobbies').select('*').eq('id', id).maybeSingle()
    if (!freshLobby) return
    if (freshLobby.is_finale || freshLobby.finished_at) return
    if (freshLobby.day_ends_at && new Date(freshLobby.day_ends_at).getTime() > Date.now()) return

    const l = freshLobby
    const newDay = (l.current_day ?? 1) + 1
    const dayEndsAt = new Date(Date.now() + getDayDurationMs(l))

    const prevDay = newDay - 1
    const existingResults: ChallengeResult[] = l.challenge_results ?? []
    let newResults = existingResults

    let newVotedOff: string[] = l.voted_off ?? []
    const { data: dayVotes } = await supabase
      .from('votes').select('*').eq('lobby_id', id).eq('day', prevDay)

    const voteChallengeDay = prevDay - 1
    const voteChallengeResult = newResults.find(r => r.day === voteChallengeDay) ?? null
    const prevDayImmune = voteChallengeResult?.individual_immunity ?? null

    if (prevDay >= 2) {
      const activeThenIds = Object.keys(l.tribe_assignments ?? {}).filter(uid => !(l.voted_off ?? []).includes(uid))
      const activeThenIdSet = new Set(activeThenIds)
      const isMergedThen = activeThenIds.length <= MERGE_AT
      const immunityWinnerTribe = normalizeTribeKey(voteChallengeResult?.immunity_winner)
      const getEligibleEliminationPool = () => {
        if (isMergedThen) {
          return activeThenIds.filter(uid => uid !== prevDayImmune)
        }

        if (!immunityWinnerTribe) return []

        const activeTribes = [...new Set(activeThenIds.map(uid => normalizeTribeKey(l.tribe_assignments[uid])).filter(Boolean))]
        if (!activeTribes.includes(immunityWinnerTribe)) return []

        const losingTribes = activeTribes.filter(tribe => tribe !== immunityWinnerTribe)
        return activeThenIds.filter(uid => losingTribes.includes(normalizeTribeKey(l.tribe_assignments[uid])))
      }
      const pickFallbackEliminated = () => {
        const pool = getEligibleEliminationPool()
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null
      }

      let eliminated: string | null = null
      if (dayVotes && dayVotes.length > 0) {
        const counts: Record<string, number> = {}
        dayVotes.forEach((v: any) => {
          if (prevDayImmune && v.target_id === prevDayImmune) return
          if (!activeThenIdSet.has(v.target_id)) return
          if (!activeThenIdSet.has(v.voter_id)) return

          if (!isMergedThen) {
            const voterTribe = normalizeTribeKey(l.tribe_assignments[v.voter_id])
            const targetTribe = normalizeTribeKey(l.tribe_assignments[v.target_id])
            if (!voterTribe || voterTribe !== targetTribe) return
            if (immunityWinnerTribe && targetTribe === immunityWinnerTribe) return
          }

          counts[v.target_id] = (counts[v.target_id] || 0) + 1
        })
        if (Object.keys(counts).length > 0) {
          const maxVotes = Math.max(...Object.values(counts))
          const tied = Object.keys(counts).filter(uid => counts[uid] === maxVotes)
          eliminated = tied[Math.floor(Math.random() * tied.length)]
        }
      }

      if (!eliminated) eliminated = pickFallbackEliminated()
      if (eliminated && !newVotedOff.includes(eliminated)) {
        newVotedOff = [...newVotedOff, eliminated]
        let recordedBootDay = false
        newResults = newResults.map(result => {
          if (result.day !== prevDay) return result
          recordedBootDay = true
          return { ...result, voted_off: eliminated }
        })
        if (!recordedBootDay) {
          newResults = [...newResults, { day: prevDay, immunity_winner: '', reward_winner: '', voted_off: eliminated }]
        }
      }
    }

    const justEliminated = newVotedOff[newVotedOff.length - 1]
    if (justEliminated && !(l.voted_off ?? []).includes(justEliminated)) {
      const eliminationIndex = newVotedOff.length - 1
      const placement = MAX_PLAYERS - eliminationIndex
      await supabase.from('lobby_players')
        .update({ placement, in_game: false })
        .eq('lobby_id', id)
        .eq('user_id', justEliminated)
    }

    const activeAfterElim = Object.keys(l.tribe_assignments ?? {})
      .filter(uid => !newVotedOff.includes(uid))

    let newAssignments = l.tribe_assignments ?? {}
    let newTribeNames = (l.tribe_names ?? {}) as Record<string, string>
    let newTribeColors = (l.tribe_colors ?? {}) as Record<string, string>
    if (activeAfterElim.length <= MERGE_AT) {
      newAssignments = { ...newAssignments }
      activeAfterElim.forEach(uid => { newAssignments[uid] = TRIBE_RARO })
      if (!newTribeNames[TRIBE_RARO] || !newTribeColors[TRIBE_RARO]) {
        const mergeBranding = pickTribeBranding([TRIBE_RARO], [
          ...Object.values(newTribeNames),
          ...Object.values(newTribeColors),
        ])
        newTribeNames = { ...newTribeNames, ...mergeBranding.names }
        newTribeColors = { ...newTribeColors, ...mergeBranding.colors }
      }
    }

    const alreadyHasResult = newResults.some(r => r.day === prevDay && !!r.immunity_winner)
    if (!alreadyHasResult && prevDay >= 1) {
      const existingResultForDay = newResults.find(r => r.day === prevDay)
      const activeChallengeIds = Object.keys(newAssignments).filter(uid => !newVotedOff.includes(uid))
      const isMergedChallenge = activeChallengeIds.length <= MERGE_AT

      let generatedResult: ChallengeResult | null = null
      if (isMergedChallenge) {
        const immunePlayer = activeChallengeIds[Math.floor(Math.random() * activeChallengeIds.length)]
        if (immunePlayer) {
          generatedResult = {
            day: prevDay,
            immunity_winner: immunePlayer,
            reward_winner: immunePlayer,
            individual_immunity: immunePlayer,
          }
        }
      } else {
        const remaining = activeChallengeIds.map(uid => normalizeTribeKey(newAssignments[uid]))
        const uniqueTribes = [...new Set(remaining.filter(Boolean))] as ('malolo' | 'kaliki' | 'raro')[]
        if (uniqueTribes.length >= 2) {
          const immunityWinner = uniqueTribes[Math.floor(Math.random() * uniqueTribes.length)]
          const rewardWinner   = uniqueTribes[Math.floor(Math.random() * uniqueTribes.length)]
          generatedResult = { day: prevDay, immunity_winner: immunityWinner, reward_winner: rewardWinner }
        }
      }

      if (generatedResult) {
        newResults = existingResultForDay
          ? newResults.map(result => result.day === prevDay ? { ...generatedResult, voted_off: result.voted_off } : result)
          : [...newResults, generatedResult]
      }
    }

    const enterFinale = activeAfterElim.length <= 2

    const { error: updateError } = await supabase.from('lobbies').update({
      current_day: newDay,
      day_ends_at: dayEndsAt.toISOString(),
      challenge_results: newResults,
      voted_off: newVotedOff,
      tribe_assignments: newAssignments,
      tribe_names: newTribeNames,
      tribe_colors: newTribeColors,
      ...(enterFinale ? { is_finale: true } : {}),
    }).eq('id', id)

    if (updateError) {
      console.error('[advanceDay] Supabase update failed:', updateError)
    } else {
      console.log(`[advanceDay] Advanced to day ${newDay}. Active: ${activeAfterElim.length}. Finale: ${enterFinale}`)
    }

    loadLobby(id)
    loadPlacementMap(id)
  }

  // ─── Chat & voting ───────────────────────────────────────────────────────

  async function sendMessage(tribeKey: string, whisperTo: string | null = null) {
    if (!text.trim() || !lobbyId || !iAmActive) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('messages').insert({
      season_id: lobbyId,
      sender_id: user.id,
      content: text.trim(),
      topic: tribeKey,
      ...(whisperTo ? { is_whisper: true, whisper_to: whisperTo } : {}),
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

  async function fillGame() {
    if (!lobbyId || hasFilled || gameStarted) return
    setHasFilled(true)
    const spotsNeeded = MAX_PLAYERS - players.length
    if (spotsNeeded <= 0) return
    const existingIds = players.map(p => p.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .not('id', 'in', `(${existingIds.join(',')})`)
      .limit(spotsNeeded * 3)
    if (!profiles || profiles.length === 0) return
    const shuffled = shuffleArray(profiles).slice(0, spotsNeeded)
    const inserts = shuffled.map(p => ({ lobby_id: lobbyId, user_id: p.id, in_game: true }))
    await supabase.from('lobby_players').insert(inserts)
    loadPlayers(lobbyId)
  }

  async function saveDayTimer() {
    if (!lobbyId || gameStarted) return
    const amount = Number(timerAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a timer length greater than 0.')
      return
    }

    const dayDurationMs = Math.round(amount * (timerUnit === 'minutes' ? 60_000 : 1_000))
    const { error } = await supabase
      .from('lobbies')
      .update({ day_duration_ms: dayDurationMs })
      .eq('id', lobbyId)

    if (error) {
      console.error('SET TIMER ERROR:', error)
      alert('Could not set the timer. Make sure the day_duration_ms column exists on lobbies.')
      return
    }

    setShowTimerModal(false)
    loadLobby(lobbyId)
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
    return Math.floor(hoursPassed / (getDayDurationMs(lobby) / 1000 / 3600)) + 1
  }

  function getDayDurationMs(source: any): number {
    const duration = Number(source?.day_duration_ms)
    return Number.isFinite(duration) && duration > 0 ? duration : DAY_DURATION_MS
  }

  function avatarBorderClass(player: Player): string {
    if (!isFinished) return 'border-[#a07840] group-hover:border-amber-800'
    const p = getPlayerPlacement(player.user_id)
    if (p === 1) return 'border-[#FFD700]'
    if (p === 2) return 'border-[#C0C0C0]'
    return 'border-[#a07840] group-hover:border-amber-800'
  }

  function avatarBorderStyle(player: Player): React.CSSProperties {
    if (!isFinished) return {}
    const p = getPlayerPlacement(player.user_id)
    if (p === 1) return { borderColor: '#FFD700', boxShadow: '0 0 8px 2px rgba(255,215,0,0.6)' }
    if (p === 2) return { borderColor: '#C0C0C0', boxShadow: '0 0 6px 1px rgba(192,192,192,0.5)' }
    return {}
  }

  function getPlayerPlacement(userId: string): number | null {
    const storedPlacement = placementMap[userId]
    if (storedPlacement != null) return Number(storedPlacement)

    const eliminatedIndex = votedOffIds.indexOf(userId)
    if (eliminatedIndex !== -1) {
      const totalPlayers = players.length || Object.keys(tribeAssign).length || MAX_PLAYERS
      return totalPlayers - eliminatedIndex
    }

    if (!isFinished) return null
    if (userId === lobby?.winner_id) return 1
    if (activePlayers.some(p => p.user_id === userId)) return 2
    return null
  }

  function ordinalSuffix(n: number): string {
    const s = ['th','st','nd','rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  // ─── Avatar helper ───────────────────────────────────────────────────────

  function PlayerAvatar({ player, size = 'md', showName = true }: {
    player: Player, size?: 'sm' | 'md', showName?: boolean
  }) {
    const isVotedOff = votedOffIds.includes(player.user_id)
    const isWinner   = isFinished && player.user_id === lobby?.winner_id
    const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg'
    const shouldGreyOut = isVotedOff && !isWinner
    return (
      <div
        onClick={() => router.push(`/profile/${player.username}`)}
        className="flex flex-col items-center gap-1 cursor-pointer group"
      >
        <div
          className={`w-full aspect-[3/4] rounded-md overflow-hidden border-2 transition ${avatarBorderClass(player)}`}
          style={{ filter: shouldGreyOut ? 'grayscale(100%)' : 'none', ...avatarBorderStyle(player) }}
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
  const tabLabel = (tab: Tab) => {
    if (tab === 'Players') {
      if (isFinale || isFinished) return 'Finalists'
      if (!gameStarted) return 'Lobby'
    }
    return tab
  }
  const profileSidebarHeight = '31.5rem'

  return (
    <>
    <style>{`
      @keyframes tribalWinnerGoldPulse {
        0%, 100% {
          text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 0 8px rgba(250,204,21,0.85);
        }
        50% {
          text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 0 18px rgba(250,204,21,1), 0 0 28px rgba(245,158,11,0.8);
        }
      }
    `}</style>
    <main
      className="min-h-screen text-white flex gap-5 px-5 pb-5 pt-8 justify-center"
      style={{ backgroundImage: `url(${activeTab === 'Tiki Court' ? '/tikicourt.jpg' : '/castawaywallpaper.jpg'})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
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

        {/* ── Profile card: spectator sees filler image, player sees their info ── */}
        {!isPlayerInLobby ? (
          <div
            className="rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center shrink-0"
            style={{
              backgroundImage: "url('/castawayprofilefiller.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: profileSidebarHeight,
            }}
          >
            <h2
              className="text-2xl font-bold text-white text-center px-4"
              style={{
                fontFamily: "'Survivant', serif",
                textShadow: '2px 2px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)',
              }}
            >
              Castaway Cove
            </h2>
          </div>
        ) : (
          <div
            className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-3 shrink-0"
            style={{ height: profileSidebarHeight }}
          >
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
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Survivant', serif" }}>
                {me ? me.username : <span className="text-zinc-600">Loading...</span>}
              </h1>
              {gameStarted && myTribe && (
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{
                  color: tribeColor(myTribe)
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
        )}

        {/* Clock */}
        <div
          className="flex-1 rounded-2xl border border-[#a07840] flex flex-col items-center justify-center gap-3"
          style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}
        >
          {currentDay === 0 ? (
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800 text-center px-4">
              The game will start soon!
            </p>
          ) : isFinished ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 text-center w-full">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800 animate-pulse text-center w-full">
                🏆 Game Over 🏆
              </p>
              {winnerUsername && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900 mt-1 text-center">
                    Winner
                  </p>
                  <p className="font-black text-xl leading-tight text-zinc-900 break-all text-center">
                    {winnerUsername}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {false && isFinale && (
                <p className="text-xs font-bold uppercase tracking-widest text-amber-800 animate-pulse">
                  🌟 Finale
                </p>
              )}
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{isFinale ? 'Finale Clock' : 'Clock'}</p>
              <p className={`font-black text-4xl tracking-[0.15em] tabular-nums transition-colors ${isPaused ? 'text-amber-700' : 'text-zinc-900'}`}>
                {formatCountdown(countdown)}
              </p>
              <button
                onClick={togglePause}
                className={`hidden items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest border transition ${
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

              {!isFinale && !isFinished && (
                <div className="flex items-center justify-between mb-4">
                  <div className="w-24" />
                  <h2 className="text-2xl font-black uppercase tracking-widest text-center">Players</h2>
                  <div className="flex items-center gap-2 justify-end" style={{ minWidth: '6rem' }}>
                    {!gameStarted && !hasFilled && isAdmin && (
                      <>
                        <button
                          onClick={() => setShowTimerModal(true)}
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 transition text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow"
                        >
                          Set Timer
                        </button>
                        <button
                          onClick={fillGame}
                          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 transition text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow"
                        >
                          Fill Game
                        </button>
                      </>
                    )}
                    <button className="flex items-center gap-1.5 bg-sky-400 hover:bg-sky-500 transition text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow">
                      <img src="/info.png" alt="Info" className="w-4 h-4" />
                      Info
                    </button>
                  </div>
                </div>
              )}

              {(isFinale || isFinished) && (
                <div className="flex items-center justify-end mb-2">
                  <button className="flex items-center gap-1.5 bg-sky-400 hover:bg-sky-500 transition text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow">
                    <img src="/info.png" alt="Info" className="w-4 h-4" />
                    Info
                  </button>
                </div>
              )}

              {!gameStarted ? (
                <>
                  <div className="grid grid-cols-9 gap-2 mb-2 shrink-0">
                    {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
                      const player = players[i]
                      return (
                        <div
                          key={i}
                          onClick={() => player && router.push(`/profile/${player.username}`)}
                          className={`flex flex-col items-center gap-0.5 ${player ? 'cursor-pointer group' : ''}`}
                        >
                          <div className={`w-full aspect-[3/4] rounded-md overflow-hidden border-2 ${player ? 'border-[#a07840] group-hover:border-amber-800 transition' : 'border-dashed border-[#a07840]/40 bg-[#b8955a]/40'}`}>
                            {player?.avatar_url ? (
                              <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                            ) : player ? (
                              <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                                <span className="text-xs font-black text-amber-900">{player.username.slice(0, 1).toUpperCase()}</span>
                              </div>
                            ) : null}
                          </div>
                          {player && (
                            <p className="text-[9px] font-semibold text-center leading-tight text-zinc-800 truncate w-full">
                              {player.username}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <p className="italic text-zinc-700 text-xs my-3 shrink-0">
                    Waiting for players ({players.length}/{MAX_PLAYERS})
                    <span className="inline-block w-6 text-left">{'.'.repeat(dotCount)}</span>
                  </p>

                  <div className="bg-[#b8955a]/50 rounded-xl p-3 flex flex-col flex-1 min-h-0">
                    <h3 className="font-bold text-base mb-2 uppercase tracking-widest shrink-0">Lobby Chat</h3>
                    <div ref={lobbyChatRef} className="overflow-y-auto mb-2 pr-1 flex-1 min-h-0 flex flex-col-reverse gap-2">
                      {[...lobbyMessages].reverse().map(m => {
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
                    <div className="flex gap-2 shrink-0">
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
              ) : (isFinale || isFinished) ? (
                /* ── FINALE / FINISHED view ── */
                <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">

                  {/* Left: finalists + jury */}
                  <div className="w-1/2 flex flex-col min-h-0 overflow-y-auto">

                    {/* Finalists */}
                    <div className="mb-5">
                      <h2 className="text-lg font-black uppercase tracking-widest mb-3 text-center" style={{ color: '#7c3aed' }}>
                        Finalists
                      </h2>
                      <div className="flex justify-center gap-6">
                        {(() => {
                          const sorted = isFinished
                            ? [...activePlayers].sort((a, b) =>
                                a.user_id === lobby?.winner_id ? -1 : b.user_id === lobby?.winner_id ? 1 : 0
                              )
                            : activePlayers
                          return sorted.map(p => {
                            const isWinner = isFinished && p.user_id === lobby?.winner_id
                            const placement = getPlayerPlacement(p.user_id)
                            const borderClass = placement === 1
                              ? 'border-[#FFD700]'
                              : placement === 2
                                ? 'border-[#C0C0C0]'
                                : 'border-[#a07840] group-hover:border-amber-800'
                            const borderStyle: React.CSSProperties = placement === 1
                              ? { borderColor: '#FFD700', boxShadow: '0 0 8px 2px rgba(255,215,0,0.6)' }
                              : placement === 2
                                ? { borderColor: '#C0C0C0', boxShadow: '0 0 6px 1px rgba(192,192,192,0.5)' }
                                : {}
                            return (
                              <div key={p.user_id} className="flex flex-col items-center gap-1" style={{ width: '120px' }}>
                                <div
                                  onClick={() => router.push(`/profile/${p.username}`)}
                                  className="cursor-pointer group w-full"
                                >
                                  <div
                                    className={`w-full aspect-[3/4] rounded-md overflow-hidden border-2 transition ${borderClass}`}
                                    style={borderStyle}
                                  >
                                    {p.avatar_url ? (
                                      <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                                        <span className="text-lg font-black text-amber-900">{p.username.slice(0, 1).toUpperCase()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-[11px] font-semibold text-center leading-tight text-zinc-800 truncate w-full">
                                  {p.username}
                                </p>
                                {isFinished && (
                                  <div
                                    className="rounded px-3 py-1 text-xs font-black text-white uppercase tracking-wide text-center w-full"
                                    style={{ backgroundColor: isWinner ? '#d97706' : '#9ca3af' }}
                                  >
                                    {isWinner ? '🥇 1st' : '🥈 2nd'}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>

                    {/* Jury gallery */}
                    {juryIds.length > 0 && (() => {
                      const juryWithPlacements = [...juryIds]
                        .reverse()
                        .map(uid => ({ uid, placement: getPlayerPlacement(uid) }))

                      const row1 = juryWithPlacements.slice(0, 4)
                      const row2 = juryWithPlacements.slice(4, 8)

                      function JuryAvatar({ uid, placement }: { uid: string; placement: number | null }) {
                        const juryPlayer = players.find(p => p.user_id === uid)
                        if (!juryPlayer) return <div style={{ width: '88px' }} />
                        return (
                          <div className="flex flex-col items-center gap-0.5" style={{ width: '88px' }}>
                            <div
                              onClick={() => router.push(`/profile/${juryPlayer.username}`)}
                              className="cursor-pointer group w-full"
                            >
                              <div className="w-full aspect-[3/4] rounded-md overflow-hidden border-2 border-[#a07840] group-hover:border-amber-800 transition">
                                {juryPlayer.avatar_url ? (
                                  <img src={juryPlayer.avatar_url} alt={juryPlayer.username} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                                    <span className="text-sm font-black text-amber-900">{juryPlayer.username.slice(0, 1).toUpperCase()}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] font-semibold text-center leading-tight text-zinc-800 truncate w-full">
                              {juryPlayer.username}
                            </p>
                            <div
                              className="rounded px-1 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide text-center w-full"
                              style={{ backgroundColor: '#71717a' }}
                            >
                              {placement !== null ? `JURY · ${ordinalSuffix(placement)}` : 'JURY'}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div>
                          <h3 className="text-base font-black uppercase tracking-widest mb-3 text-center text-zinc-700">
                            Jury
                          </h3>
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex justify-center gap-2">
                              {row1.map(({ uid, placement }) => (
                                <JuryAvatar key={uid} uid={uid} placement={placement} />
                              ))}
                            </div>
                            {row2.length > 0 && (
                              <div className="flex justify-center gap-2">
                                {row2.map(({ uid, placement }) => (
                                  <JuryAvatar key={uid} uid={uid} placement={placement} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Right: Reunion Chat + Jury Vote */}
                  <div className="w-1/2 flex flex-col min-h-0 h-full gap-3">

                    <div className={`flex flex-col min-h-0 ${isFinished || !(isFinale && juryIds.includes(_uid)) ? 'flex-1' : 'h-[60%]'}`}>
                      <h2 className="text-xl font-bold mb-2 shrink-0 uppercase tracking-widest">Reunion Chat</h2>
                      <div className="bg-[#b8955a]/50 rounded-xl p-3 flex flex-col flex-1 min-h-0">
                        <div ref={reunionChatRef} className="flex-1 overflow-y-auto pr-1 min-h-0">
                          <div className="flex flex-col justify-end min-h-full">
                            <div className="space-y-2">
                              {reunionMessages.map(m => {
                                const isOnline = onlineUserIds.has(m.sender_id)
                                return (
                                  <div key={m.id} className="bg-[#b8955a] p-3 rounded">
                                    <div className="flex justify-between mb-1">
                                      <span className="inline-flex items-center gap-1.5">
                                        <span className="inline-block w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: isOnline ? '#22c55e' : '#ef4444', boxShadow: isOnline ? '0 0 4px #22c55e' : 'none' }} />
                                        <span className="text-yellow-800 font-bold text-sm cursor-pointer hover:underline"
                                          onClick={() => router.push(`/profile/${m.username}`)}>
                                          {m.username}
                                        </span>
                                      </span>
                                    </div>
                                    <p className="text-sm">{m.content}</p>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-2 shrink-0">
                          <input
                            value={reunionText}
                            onChange={e => { if (!isFinished) setReunionText(e.target.value) }}
                            disabled={!canReunionChat && !isFinished ? true : isFinished ? true : false}
                            className="flex-1 bg-[#c8a96e] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
                            placeholder={
                              isFinished
                                ? '🏆 Season Complete — Chat Closed'
                                : canReunionChat
                                  ? 'Type message...'
                                  : 'Only jury & finalists can chat'
                            }
                            onKeyDown={e => { if (e.key === 'Enter' && !isFinished && canReunionChat) sendReunionMessage() }}
                          />
                          <button
                            onClick={sendReunionMessage}
                            disabled={!canReunionChat || isFinished}
                            className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Jury vote — shown during finale only, hidden once finished */}
                    {isFinale && !isFinished && juryIds.includes(_uid) && (
                      <div className="flex-1 min-h-0 p-4 rounded-xl border border-[#a07840] flex flex-col items-center justify-center text-center" style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}>
                        <p className="font-black uppercase tracking-widest text-sm mb-3 text-zinc-800">Vote for a Winner</p>
                        {hasFinaleVoted ? (
                          <div className="text-center">
                            <p className="font-bold text-zinc-700 text-sm">
                              You voted for <span className="text-amber-800">{players.find(p => p.user_id === finaleVoteTarget)?.username}</span>
                            </p>
                            <button
                              onClick={async () => {
                                if (!lobbyId || !currentUserId) return
                                await supabase.from('votes').delete()
                                  .eq('lobby_id', lobbyId).eq('voter_id', currentUserId).eq('day', 9999)
                                setHasFinaleVoted(false)
                                setFinaleVoteTarget('')
                              }}
                              className="mt-2 text-xs font-bold text-amber-700 underline cursor-pointer"
                            >
                              Change vote
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 w-full max-w-xs">
                            {activePlayers.map(p => (
                              <button
                                key={p.user_id}
                                onClick={() => castFinaleVote(p.user_id)}
                                className="w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wide bg-yellow-700 text-white hover:bg-yellow-800 transition cursor-pointer"
                              >
                                Vote for {p.username}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : isMerged ? (
                <div>
                  <p className="text-center font-black uppercase tracking-widest text-lg mb-3" style={{ color: tribeColor(TRIBE_RARO) }}>
                    {tribeName(TRIBE_RARO)} Tribe
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
                              <PlayerAvatar key={p.user_id} player={p} size="sm" />
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
                    <p className="font-black uppercase tracking-widest text-base mb-3 text-center" style={{ color: tribeColor(TRIBE_1) }}>
                      {tribeName(TRIBE_1)} Tribe
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
                    <p className="font-black uppercase tracking-widest text-base mb-3 text-center" style={{ color: tribeColor(TRIBE_2) }}>
                      {tribeName(TRIBE_2)} Tribe
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {tribe2Players.map(p => (
                        <div key={p.user_id} style={{ width: 'calc(11.11% - 8px)' }}>
                          <PlayerAvatar key={p.user_id} player={p} size="sm" />
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
                    onClick={() => {
                      setCampPage(page)
                      if (page === 'Jungle') setCampLocation('jungle')
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition border cursor-pointer uppercase tracking-widest ${campPage === page ? 'bg-amber-900 text-[#f0ddb0] border-amber-950' : 'bg-[#b8955a] text-zinc-800 border-[#a07840] hover:bg-[#a07840]'}`}
                  >
                    {isMerged && page === 'Malolo Tribe'
                      ? `${tribeName(TRIBE_RARO)} Camp`
                      : page === 'Malolo Tribe'
                        ? `${tribeName(TRIBE_1)} Camp`
                        : page === 'Kaliki Tribe'
                          ? `${tribeName(TRIBE_2)} Camp`
                          : page}
                  </button>
                ))}
              </div>

              {campPage === 'Malolo Tribe' && (
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="w-1/2 flex flex-col min-h-0">
                    <h2 className="text-base font-black uppercase tracking-widest mb-3 shrink-0" style={{ color: isMerged ? tribeColor(TRIBE_RARO) : tribeColor(TRIBE_1) }}>
                      {isMerged ? tribeName(TRIBE_RARO) : tribeName(TRIBE_1)} Tribe
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
                    <h2 className="text-xl font-bold mb-3 shrink-0 uppercase tracking-widest">
                      {isMerged ? `${tribeName(TRIBE_RARO)} Camp Chat` : `${tribeName(TRIBE_1)} Camp Chat`}
                    </h2>
                    <ChatPanel
                      tribeKey={isMerged ? TRIBE_RARO : TRIBE_1}
                      canChat={iAmActive && myTribe === (isMerged ? TRIBE_RARO : TRIBE_1)}
                      messages={messages}
                      text={text}
                      setText={setText}
                      onSend={(whisperTo) => sendMessage(isMerged ? TRIBE_RARO : TRIBE_1, whisperTo)}
                      scrollRef={chatRef}
                      getMessageDay={getMessageDay}
                      onlineUserIds={onlineUserIds}
                      onClickUsername={username => router.push(`/profile/${username}`)}
                      tribeMembers={isMerged ? raroPlayers : tribe1Players}
                      currentUserId={_uid}
                    />
                  </div>
                </div>
              )}

              {campPage === 'Kaliki Tribe' && !isMerged && (
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="w-1/2 flex flex-col min-h-0">
                    <h2 className="text-base font-black uppercase tracking-widest mb-3 shrink-0" style={{ color: tribeColor(TRIBE_2) }}>
                      {tribeName(TRIBE_2)} Tribe
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
                    <h2 className="text-xl font-bold mb-3 shrink-0 uppercase tracking-widest">{tribeName(TRIBE_2)} Camp Chat</h2>
                    <ChatPanel
                      tribeKey={TRIBE_2}
                      canChat={iAmActive && myTribe === TRIBE_2}
                      messages={messages}
                      text={text}
                      setText={setText}
                      onSend={(whisperTo) => sendMessage(TRIBE_2, whisperTo)}
                      scrollRef={chatRef}
                      getMessageDay={getMessageDay}
                      onlineUserIds={onlineUserIds}
                      onClickUsername={username => router.push(`/profile/${username}`)}
                      tribeMembers={tribe2Players}
                      currentUserId={_uid}
                    />
                  </div>
                </div>
              )}

              {(campPage === 'Jungle' || campPage === 'Water Well') && (
                <div
                  className="relative flex-1 min-h-0 overflow-hidden rounded-xl border-4 border-[#5b351b] shadow-[inset_0_0_30px_rgba(0,0,0,0.45)] bg-[#b8955a]"
                  style={{
                    backgroundImage: visibleCampLocation.background
                      ? `linear-gradient(180deg, rgba(20,12,4,0.12), rgba(20,12,4,0.44)), url('${visibleCampLocation.background}')`
                      : WOOD_GRAIN_DARK,
                    backgroundSize: visibleCampLocation.background ? 'cover' : 'auto',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-x-0 top-5 flex justify-center pointer-events-none">
                    <div className="px-5 py-2 rounded-lg border-2 border-[#5b351b] bg-[#2f1a0d]/80 shadow-lg">
                      <h2 className="font-survivant text-3xl text-[#f7d28a] drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
                        {visibleCampLocation.label}
                      </h2>
                    </div>
                  </div>

                  {campPage === 'Jungle' && visibleCampLocation.left && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCampLocation(visibleCampLocation.left!)}
                        className="h-14 w-14 rounded-full bg-orange-600 text-white border-2 border-orange-900 shadow-lg text-3xl font-black hover:bg-orange-500 active:scale-95 transition"
                        aria-label={`Go to ${CAMP_LOCATIONS[visibleCampLocation.left].label}`}
                      >
                        &lt;
                      </button>
                      <span className="px-3 py-1 rounded-md bg-[#2f1a0d]/85 text-[#f7d28a] text-xs font-black uppercase tracking-widest border border-[#5b351b] shadow">
                        {CAMP_LOCATIONS[visibleCampLocation.left].label}
                      </span>
                    </div>
                  )}

                  {campPage === 'Jungle' && visibleCampLocation.right && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCampLocation(visibleCampLocation.right!)}
                        className="h-14 w-14 rounded-full bg-orange-600 text-white border-2 border-orange-900 shadow-lg text-3xl font-black hover:bg-orange-500 active:scale-95 transition"
                        aria-label={`Go to ${CAMP_LOCATIONS[visibleCampLocation.right].label}`}
                      >
                        &gt;
                      </button>
                      <span className="px-3 py-1 rounded-md bg-[#2f1a0d]/85 text-[#f7d28a] text-xs font-black uppercase tracking-widest border border-[#5b351b] shadow">
                        {CAMP_LOCATIONS[visibleCampLocation.right].label}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-x-6 bottom-5 flex flex-wrap justify-center gap-3">
                    <div className="basis-full flex justify-center mb-1">
                      <span className="px-3 py-1 rounded-full bg-[#2f1a0d]/85 text-[#f7d28a] border border-[#5b351b] text-xs font-black uppercase tracking-widest shadow">
                        Actions 3/3
                      </span>
                    </div>
                    {visibleCampLocation.actions.map(action => (
                      <button
                        key={action}
                        type="button"
                        className="px-4 py-2 rounded-lg bg-orange-600 text-white border-2 border-orange-900 shadow-lg text-sm font-black uppercase tracking-widest hover:bg-orange-500 active:scale-95 transition"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
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

              {!isFinalThree && (
                <div className="flex gap-4 justify-center">
                  <button className="px-8 py-4 rounded-xl font-black text-lg uppercase tracking-wide bg-yellow-600 text-white border-2 border-yellow-700 hover:bg-yellow-700 transition shadow-md cursor-pointer">
                    Immunity Challenge
                  </button>
                  {!isMerged && (
                    <button className="px-8 py-4 rounded-xl font-black text-lg uppercase tracking-wide bg-[#8b6840] text-[#f0ddb0] border-2 border-[#6b4820] hover:bg-[#7a5830] transition shadow-md cursor-pointer">
                      Reward Challenge
                    </button>
                  )}
                </div>
              )}
              {isFinalThree && (
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-widest text-zinc-600 italic">
                    Final Tribal Council — no further challenges
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── TIKI COURT TAB ── */}
          {activeTab === 'Tiki Court' && (
            <div className="p-5 h-full text-zinc-900 flex gap-5">
              <div className="flex-1 min-w-0">
                <div
                  className="relative w-full h-full min-h-[32rem] rounded-xl overflow-hidden border border-[#a07840] bg-cover bg-center"
                  style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.16), rgba(0,0,0,0.28)), url('/tribalcouncil.png')" }}
                >
                  {tikiCourtTribeKey && (
                    <h2
                      className="absolute top-9 left-0 right-0 text-center text-4xl font-black uppercase tracking-widest z-10"
                      style={{
                        color: tribeColor(tikiCourtTribeKey),
                        fontFamily: "'Survivant', serif",
                        textShadow: `0 2px 3px rgba(0,0,0,0.95), 0 0 12px ${tribeColor(tikiCourtTribeKey)}`,
                      }}
                    >
                      {tribeName(tikiCourtTribeKey)} Tribe
                    </h2>
                  )}

                  {(() => {
                    const useFireRow = tikiCourtPlayers.length >= 9
                    const backRowCount = tikiCourtPlayers.length <= 4
                      ? tikiCourtPlayers.length
                      : useFireRow
                        ? 4
                        : Math.min(5, Math.ceil(tikiCourtPlayers.length / 2))
                    const middleRowCount = useFireRow ? 4 : tikiCourtPlayers.length - backRowCount
                    const backRow = tikiCourtPlayers.slice(0, backRowCount)
                    const middleRow = tikiCourtPlayers.slice(backRowCount, backRowCount + middleRowCount)
                    const fireRow = tikiCourtPlayers.slice(backRowCount + middleRowCount)
                    const renderTikiSeat = (player: Player, row: 'back' | 'front') => (
                      <div
                        key={player.user_id}
                        className="relative flex flex-col items-center w-[6.15rem] shrink-0"
                      >
                        <p
                          className="mb-1 max-w-full rounded-sm border border-[#8b6840] bg-[#5a3418]/85 px-2 py-0.5 text-center text-[10px] font-black text-white truncate shadow"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,1), 0 0 7px rgba(0,0,0,0.95)' }}
                        >
                          {player.username}
                        </p>
                        <div
                          onClick={() => router.push(`/profile/${player.username}`)}
                          className="relative z-10 w-[4.3rem] aspect-[3/4] rounded-md overflow-hidden border-2 border-amber-100 shadow-lg cursor-pointer bg-zinc-800"
                          style={{ marginBottom: '-0.7rem' }}
                        >
                          {player.avatar_url ? (
                            <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                              <span className="text-lg font-black text-amber-900">{player.username.slice(0, 1).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <img src="/woodencrate.png" alt="" className="w-full aspect-[1.35/1] object-contain drop-shadow-xl" />
                      </div>
                    )

                    return (
                      <>
                        <div className="absolute left-[6%] right-[6%] bottom-[35%] flex items-end justify-center gap-3 z-10">
                          {backRow.map(player => renderTikiSeat(player, 'back'))}
                        </div>
                        {middleRow.length > 0 && (
                          <div
                            className="absolute left-[8%] right-[8%] bottom-[24%] flex items-end justify-center gap-3 z-20"
                            style={{ transform: 'translateX(1.9rem)' }}
                          >
                            {middleRow.map(player => renderTikiSeat(player, 'front'))}
                          </div>
                        )}
                        {fireRow.length > 0 && (
                          <div className="absolute right-[11%] bottom-[9%] flex items-end justify-end gap-3 z-30">
                            {fireRow.map(player => renderTikiSeat(player, 'front'))}
                          </div>
                        )}
                      </>
                    )
                  })()}

                  <button className="absolute bottom-4 right-4 z-40 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wide px-4 py-2 rounded-lg shadow-lg cursor-pointer">
                    Advantage Menu
                  </button>
                </div>
              </div>
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
            const orderedActive = [...activePlayers].sort((a, b) => {
              if (isFinished) {
                return (getPlayerPlacement(a.user_id) ?? 99) - (getPlayerPlacement(b.user_id) ?? 99)
              }
              return a.username.localeCompare(b.username)
            })
            const orderedVotedOff = [...votedOffIds]
              .map(id => players.find(p => p.user_id === id))
              .filter(Boolean) as Player[]
            const votedOffReversed = [...orderedVotedOff].reverse()
            const gridPlayers = [...orderedActive, ...votedOffReversed]

            const voteHistoryNewestFirst = [...voteHistory].reverse()

            return (
              <div className="p-5 h-full text-zinc-900 flex gap-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-black uppercase tracking-widest mb-4">Castaways</h2>
                  <div className="grid grid-cols-6 gap-2">
                    {gridPlayers.map((player) => {
                      const isVotedOff = votedOffIds.includes(player.user_id)
                      const isWinner   = isFinished && player.user_id === lobby?.winner_id
                      const placement  = getPlayerPlacement(player.user_id)

                      const borderClass = isFinished && placement === 1
                        ? 'border-[#FFD700]'
                        : isFinished && placement === 2
                          ? 'border-[#C0C0C0]'
                          : 'border-[#a07840] group-hover:border-amber-800'
                      const borderStyle: React.CSSProperties = isFinished && placement === 1
                        ? { borderColor: '#FFD700', boxShadow: '0 0 8px 2px rgba(255,215,0,0.6)' }
                        : isFinished && placement === 2
                          ? { borderColor: '#C0C0C0', boxShadow: '0 0 6px 1px rgba(192,192,192,0.5)' }
                          : {}

                      const shouldGreyOut = isVotedOff && !isWinner
                      return (
                        <div key={player.user_id} className="flex flex-col items-center gap-1">
                          <div
                            onClick={() => router.push(`/profile/${player.username}`)}
                            className="cursor-pointer group w-full"
                          >
                            <div
                              className={`w-full aspect-[3/4] rounded-md overflow-hidden border-2 transition ${borderClass}`}
                              style={{ filter: shouldGreyOut ? 'grayscale(100%)' : 'none', ...borderStyle }}
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
                          {(() => {
                            if (placement === null) return null
                            if (!isVotedOff && !isFinished) return null

                            const bgColor = placement === 1 ? '#d97706'
                              : placement === 2 ? '#9ca3af'
                              : placement === 3 ? '#92400e'
                              : placement >= 4 && placement <= 10 ? '#71717a'
                              : '#3f3f46'

                            const label = placement === 1 ? '🥇 1st'
                              : placement === 2 ? '🥈 2nd'
                              : placement >= 3 && placement <= 10 ? `JURY - ${ordinalSuffix(placement)}`
                              : ordinalSuffix(placement)

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
                        {voteHistoryNewestFirst.map((record, i) => {
                          const tribeKey = normalizeTribeKey(record.tribe_key)
                          const tribeTextColor = tribeColor(tribeKey)
                          const votedOutTextColor = '#ef4444'
                          const winnerTextColor = '#facc15'
                          const paleTextColor = '#fef3c7'
                          return (
                            <div
                              key={`${record.day}-${i}`}
                              className="shrink-0 rounded-xl p-3 border border-[#a07840] text-xs bg-cover bg-center overflow-hidden"
                              style={{
                                backgroundImage: record.is_winner
                                  ? "linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.5)), url('/beachfireworks.jpg')"
                                  : "linear-gradient(rgba(0,0,0,0.38), rgba(0,0,0,0.56)), url('/beachtorches.png')",
                                minHeight: '8.75rem',
                              }}
                            >
                              <p
                                className="font-black uppercase tracking-wide text-sm leading-tight mb-1 text-amber-100"
                                style={{ textShadow: textGlow('#fef3c7') }}
                              >
                                Day {record.day}
                              </p>
                              <p
                                className="font-bold uppercase tracking-wide leading-tight mb-1"
                                style={{
                                  color: record.is_winner ? winnerTextColor : votedOutTextColor,
                                  fontFamily: "'Survivant', serif",
                                  textShadow: record.is_winner ? textGlow(winnerTextColor) : textGlow('#000000'),
                                  animation: record.is_winner ? 'tribalWinnerGoldPulse 1.8s ease-in-out infinite' : undefined,
                                }}
                              >
                                {record.username} {record.is_winner ? 'wins' : 'voted off'}
                              </p>
                              {tribeKey && (
                                <p
                                  className="font-black uppercase tracking-wide leading-tight mb-1"
                                  style={{ color: tribeTextColor, textShadow: textGlow(tribeTextColor) }}
                                >
                                  {tribeName(tribeKey)} Tribe
                                </p>
                              )}
                              <p
                                className="uppercase font-bold tracking-wide text-xs leading-tight mb-2"
                                style={{ color: paleTextColor, textShadow: textGlow(paleTextColor) }}
                              >
                                {voteCountSummary(record)}
                              </p>
                              <button
                                onClick={() => setVoteInfoRecord(record)}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded shadow cursor-pointer"
                              >
                                Vote Info
                              </button>
                            </div>
                          )
                        })}
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
    {voteInfoRecord && (
      <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-[#a07840] p-4 text-zinc-900 shadow-2xl relative" style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}>
          <button
            onClick={() => setVoteInfoRecord(null)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-black flex items-center justify-center hover:bg-zinc-800 cursor-pointer"
            aria-label="Close vote info"
          >
            X
          </button>
          <h2 className="text-xl font-black uppercase tracking-widest pr-8 mb-1">
            {voteInfoRecord.is_winner ? 'Jury Vote' : `Day ${voteInfoRecord.day}`}
          </h2>
          <p className="font-bold text-red-800 uppercase tracking-wide mb-3" style={{ fontFamily: "'Survivant', serif" }}>
            {voteInfoRecord.username} {voteInfoRecord.is_winner ? 'wins' : 'voted off'}
          </p>
          {sortedVoteEntries(voteInfoRecord).length > 0 ? (
            <div className="space-y-2">
              {sortedVoteEntries(voteInfoRecord).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-[#b8955a] border border-[#a07840] px-3 py-2">
                  <span className="font-black uppercase tracking-wide text-sm">{name}</span>
                  <span className="font-black text-sm">{count} vote{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-[#b8955a] border border-[#a07840] px-3 py-2 font-black uppercase tracking-wide text-sm">
              0 votes cast
            </p>
          )}
        </div>
      </div>
    )}
    {showTimerModal && !gameStarted && isAdmin && (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-[#a07840] p-5 text-zinc-900 shadow-2xl" style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}>
          <h2 className="text-xl font-black uppercase tracking-widest mb-4">Set Timer</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={timerAmount}
              onChange={e => setTimerAmount(e.target.value)}
              type="number"
              min="1"
              step="1"
              className="flex-1 bg-[#b8955a] border border-[#a07840] rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-amber-700"
            />
            <select
              value={timerUnit}
              onChange={e => setTimerUnit(e.target.value as 'seconds' | 'minutes')}
              className="bg-[#b8955a] border border-[#a07840] rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-amber-700 cursor-pointer"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowTimerModal(false)}
              className="px-3 py-2 rounded-lg bg-[#b8955a] border border-[#a07840] text-sm font-bold hover:bg-[#a07840] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={saveDayTimer}
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}