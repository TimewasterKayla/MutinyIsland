'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

type CurrentUserProfile = {
  id: string
  username: string
  avatar: string | null
  rank: string | null
  coins: number | null
  crowns: number | null
  created_at: string | null
}

type Tab = 'Lobby' | 'Camp' | 'Challenge Beach' | 'Tiki Court'
type CampSubPage = 'Camp 1' | 'Camp 2' | 'Jungle' | 'Water Well'

const TABS: Tab[] = ['Lobby', 'Camp', 'Challenge Beach', 'Tiki Court']
const CAMP_PAGES: CampSubPage[] = ['Camp 1', 'Camp 2', 'Jungle', 'Water Well']
const MAX_PLAYERS = 18

const WOOD_GRAIN = `
  repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px),
  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.015) 5px, rgba(0,0,0,0.015) 6px)
`
const WOOD_GRAIN_DARK = `
  repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px),
  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)
`

export default function SeasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()

  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [lobbyMessages, setLobbyMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [lobbyText, setLobbyText] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [lobby, setLobby] = useState<any>(null)
  const [isPlayerInLobby, setIsPlayerInLobby] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Lobby')
  const [campPage, setCampPage] = useState<CampSubPage>('Camp 1')
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const lobbyChatRef = useRef<HTMLDivElement>(null)

  // PARAMS
  useEffect(() => {
    Promise.resolve(params).then((p) => setLobbyId(p.id))
  }, [params])

  // INIT
  useEffect(() => {
    if (!lobbyId) return
    getCurrentUser()
    loadLobby()
    loadPlayers()
    loadMessages()
    loadLobbyMessages()

    const interval = setInterval(() => {
      loadPlayers()
      loadMessages()
      loadLobbyMessages()
    }, 3000)

    return () => clearInterval(interval)
  }, [lobbyId])

  // AUTO SCROLL
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (lobbyChatRef.current) lobbyChatRef.current.scrollTop = lobbyChatRef.current.scrollHeight
  }, [lobbyMessages])

  // CURRENT USER
  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsPlayerInLobby(false); return }

    const { data: lobbyData } = await supabase
      .from('lobby_players').select('id')
      .eq('lobby_id', lobbyId).eq('user_id', user.id).maybeSingle()
    setIsPlayerInLobby(!!lobbyData)

    // Load current user's profile for sidebar
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, avatar, rank, coins, crowns, created_at')
      .eq('id', user.id)
      .maybeSingle()
    if (profileData) setCurrentUserProfile(profileData)
  }

  // LOBBY
  async function loadLobby() {
    const { data } = await supabase.from('lobbies').select('*').eq('id', lobbyId).maybeSingle()
    setLobby(data)
  }

  // PLAYERS
  async function loadPlayers() {
    const { data, error } = await supabase.from('lobby_players').select('*').eq('lobby_id', lobbyId)
    if (error || !data || data.length === 0) { setPlayers([]); return }

    const userIds = data.map((p) => p.user_id)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles').select('id, username, avatar').in('id', userIds)
    if (profileError) console.error('PROFILE ERROR:', profileError)

    const profileMap = Object.fromEntries(
      (profileData || []).map((p) => [p.id, { username: p.username, avatar: p.avatar }])
    )
    setPlayers(data.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      username: profileMap[p.user_id]?.username || p.user_id.slice(0, 8),
      avatar_url: profileMap[p.user_id]?.avatar || null,
    })))
  }

  // Helper: resolve sender IDs -> usernames
  async function resolveUsernames(senderIds: string[]): Promise<Record<string, string>> {
    const { data } = await supabase.from('profiles').select('id, username').in('id', senderIds)
    return Object.fromEntries((data || []).map((p: any) => [p.id, p.username]))
  }

  // LOAD MESSAGES (camp chat)
  async function loadMessages() {
    const { data, error } = await supabase
      .from('messages').select('*').eq('season_id', lobbyId)
      .eq('message_type', 'camp').order('created_at', { ascending: true })
    if (error || !data || data.length === 0) { setMessages([]); return }
    const senderIds = [...new Set(data.map((m) => m.sender_id))]
    const profileMap = await resolveUsernames(senderIds)
    setMessages(data.map((m) => ({ ...m, username: profileMap[m.sender_id] || 'Unknown' })))
  }

  // LOAD LOBBY MESSAGES
  async function loadLobbyMessages() {
    const { data, error } = await supabase
      .from('messages').select('*').eq('season_id', lobbyId)
      .eq('message_type', 'lobby').order('created_at', { ascending: true })
    if (error || !data || data.length === 0) { setLobbyMessages([]); return }
    const senderIds = [...new Set(data.map((m) => m.sender_id))]
    const profileMap = await resolveUsernames(senderIds)
    setLobbyMessages(data.map((m) => ({ ...m, username: profileMap[m.sender_id] || 'Unknown' })))
  }

  // SEND CAMP MESSAGE
  async function sendMessage() {
    if (!text.trim() || !isPlayerInLobby) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('messages').insert({ season_id: lobbyId, sender_id: user.id, content: text.trim(), message_type: 'camp' })
    setText('')
    loadMessages()
  }

  // SEND LOBBY MESSAGE
  async function sendLobbyMessage() {
    if (!lobbyText.trim() || !isPlayerInLobby) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('messages').insert({ season_id: lobbyId, sender_id: user.id, content: lobbyText.trim(), message_type: 'lobby' })
    setLobbyText('')
    loadLobbyMessages()
  }

  // VOTING
  async function castVote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !voteTarget) return
    const { error } = await supabase.from('votes').insert({ season_id: lobbyId, voter_id: user.id, target_id: voteTarget })
    if (error) { console.error('VOTE ERROR:', error); return }
    alert('Vote submitted')
  }

  // DAY
  function getDayNumber() {
    if (!lobby?.started_at) return 0
    const start = new Date(lobby.started_at).getTime()
    const hoursPassed = (Date.now() - start) / (1000 * 60 * 60)
    return Math.floor(hoursPassed / 12) + 1
  }

  function getMessageDay(createdAt?: string) {
    if (!createdAt || !lobby?.started_at) return 0
    const start = new Date(lobby.started_at).getTime()
    const hoursPassed = (new Date(createdAt).getTime() - start) / (1000 * 60 * 60)
    if (hoursPassed < 0) return 0
    return Math.floor(hoursPassed / 12) + 1
  }

  const day = getDayNumber()

  if (!lobbyId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading...
      </div>
    )
  }

  // ── CHAT BOX (reusable) ────────────────────────────────────────────────────
  function CampChatBox() {
    return (
      <div className="w-1/2 flex flex-col min-h-0">
        <h2 className="text-xl font-bold mb-3">{campPage} Chat</h2>
        <div
          ref={chatRef}
          className="overflow-y-auto mb-3 pr-1 space-y-2"
          style={{ maxHeight: '420px' }}
        >
          {messages.map((m) => (
            <div key={m.id} className="bg-[#b8955a] p-3 rounded">
              <div className="flex justify-between mb-1">
                <p className="text-yellow-800 font-bold text-sm">{m.username}</p>
                <p className="text-xs text-zinc-600">Day {getMessageDay(m.created_at)}</p>
              </div>
              <p className="text-sm">{m.content}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!isPlayerInLobby}
            className="flex-1 bg-[#b8955a] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
            placeholder={isPlayerInLobby ? 'Type message...' : 'Join to chat'}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
          />
          <button
            onClick={sendMessage}
            disabled={!isPlayerInLobby}
            className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    )
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex gap-5 px-5 pb-5 pt-8 justify-center">

      {/* ══ LEFT COLUMN ══ */}
      <aside className="w-64 shrink-0 flex flex-col gap-4">

        {/* Day Counter */}
        <div
          className="rounded-2xl p-5 text-center border border-[#a07840]"
          style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800 mb-1">
            Current Day
          </p>
          <p className="font-black text-6xl tracking-[0.2em] uppercase leading-none text-zinc-900">
            {day}
          </p>
        </div>

        {/* Player profile card */}
        {currentUserProfile && (
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-3">
            {/* Avatar */}
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700">
              {currentUserProfile.avatar ? (
                <Image
                  src={currentUserProfile.avatar}
                  alt="Avatar"
                  width={256}
                  height={256}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-zinc-500">
                  {currentUserProfile.username?.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Username */}
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">{currentUserProfile.username}</h2>
            </div>

            {/* Stats */}
            <div className="space-y-2 text-sm">
              <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
                <span className="text-zinc-400">Rank: </span>
                <span className="font-semibold text-white">{currentUserProfile.rank || 'Peasant'}</span>
              </div>
              <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
                <span className="text-zinc-400">Doubloons: </span>
                <span className="font-semibold text-yellow-400">{currentUserProfile.coins || 0}</span>
              </div>
              <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
                <span className="text-zinc-400">Crowns: </span>
                <span className="font-semibold text-amber-300">{currentUserProfile.crowns || 0}</span>
              </div>
              <div className="bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-700">
                <span className="text-zinc-400">Joined: </span>
                <span className="font-semibold text-white">
                  {currentUserProfile.created_at
                    ? new Date(currentUserProfile.created_at).toLocaleDateString('en-US', {
                        month: '2-digit', day: '2-digit', year: 'numeric',
                      })
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        )}

      </aside>

      {/* ══ RIGHT COLUMN (tabbed) ══ */}
      <div className="w-[58%] flex flex-col min-h-0">

        {/* Wooden folder tabs */}
        <div className="flex items-end gap-1 px-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  relative px-5 py-2 rounded-t-lg font-bold text-xs tracking-widest
                  transition-all duration-150 select-none cursor-pointer uppercase
                  border-t border-l border-r
                  ${isActive
                    ? 'text-zinc-900 border-[#a07840] z-10 -mb-px pb-3 shadow-md'
                    : 'text-[#e8d0a0] border-[#6b4820] hover:text-[#f0ddb0]'
                  }
                `}
                style={{
                  background: isActive ? '#c8a96e' : '#8b6840',
                  backgroundImage: isActive ? WOOD_GRAIN : WOOD_GRAIN_DARK,
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Tab panel */}
        <div
          className="flex-1 rounded-2xl rounded-tl-none overflow-hidden border border-[#a07840] min-h-[80vh]"
          style={{ background: '#c8a96e', backgroundImage: WOOD_GRAIN }}
        >

          {/* ── LOBBY TAB ── */}
          {activeTab === 'Lobby' && (
            <div className="p-5 h-full flex flex-col text-zinc-900">

              <h2 className="text-2xl font-black uppercase tracking-widest text-center mb-4">
                Players
              </h2>

              {/* Avatar grid — 2 rows of 9 */}
              <div className="grid grid-cols-9 gap-3 mb-4">
                {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
                  const player = players[i]
                  return (
                    <div
                      key={i}
                      onClick={() => player && router.push(`/profile/${player.username}`)}
                      className={`flex flex-col items-center gap-1 ${player ? 'cursor-pointer group' : ''}`}
                    >
                      <div
                        className={`
                          w-full aspect-[3/4] rounded-md overflow-hidden border-2
                          ${player
                            ? 'border-[#a07840] group-hover:border-amber-800 transition'
                            : 'border-dashed border-[#a07840]/40 bg-[#b8955a]/40'
                          }
                        `}
                      >
                        {player?.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt={player.username}
                            className="w-full h-full object-cover"
                          />
                        ) : player ? (
                          <div className="w-full h-full bg-[#b8955a] flex items-center justify-center">
                            <span className="text-lg font-black text-amber-900">
                              {player.username.slice(0, 1).toUpperCase()}
                            </span>
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
              </p>

              {/* Lobby Chat — fixed height, no flex-1 stretch */}
              <div className="bg-[#b8955a]/50 rounded-xl p-3">
                <h3 className="font-bold text-base mb-2">Lobby Chat</h3>
                <div
                  ref={lobbyChatRef}
                  className="overflow-y-auto space-y-2 mb-2 pr-1"
                  style={{ height: '160px' }}
                >
                  {lobbyMessages.map((m) => (
                    <div key={m.id} className="bg-[#c8a96e] p-2 rounded text-sm">
                      <span className="font-bold text-amber-900 mr-2">{m.username}</span>
                      <span>{m.content}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={lobbyText}
                    onChange={(e) => setLobbyText(e.target.value)}
                    disabled={!isPlayerInLobby}
                    className="flex-1 bg-[#c8a96e] p-2 rounded text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-amber-700 placeholder:text-zinc-600"
                    placeholder={isPlayerInLobby ? 'Chat...' : 'Join to chat'}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendLobbyMessage() }}
                  />
                  <button
                    onClick={sendLobbyMessage}
                    disabled={!isPlayerInLobby}
                    className="bg-yellow-700 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-yellow-800 transition cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ── CAMP TAB ── */}
          {activeTab === 'Camp' && (
            <div className="p-5 h-full flex flex-col text-zinc-900">

              {/* Sub-page nav */}
              <div className="flex gap-2 mb-4">
                {CAMP_PAGES.map((page) => (
                  <button
                    key={page}
                    onClick={() => setCampPage(page)}
                    className={`
                      px-4 py-2 rounded-lg font-bold text-sm transition border cursor-pointer
                      ${campPage === page
                        ? 'bg-amber-900 text-[#f0ddb0] border-amber-950'
                        : 'bg-[#b8955a] text-zinc-800 border-[#a07840] hover:bg-[#a07840]'
                      }
                    `}
                  >
                    {page}
                  </button>
                ))}
              </div>

              {/* Camp 1 / Camp 2 — chat on RIGHT half */}
              {(campPage === 'Camp 1' || campPage === 'Camp 2') && (
                <div className="flex gap-4 flex-1 min-h-0">
                  {/* Left half — empty for future content */}
                  <div className="w-1/2" />
                  {/* Chat — right half */}
                  <CampChatBox />
                </div>
              )}

              {campPage === 'Jungle' && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xl italic text-zinc-600">The Jungle — coming soon</p>
                </div>
              )}

              {campPage === 'Water Well' && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xl italic text-zinc-600">Water Well — coming soon</p>
                </div>
              )}
            </div>
          )}

          {/* ── CHALLENGE BEACH TAB ── */}
          {activeTab === 'Challenge Beach' && (
            <div className="p-5 h-full text-zinc-900">
              <h2 className="text-2xl font-bold mb-6">Challenge Beach</h2>
              <div className="flex gap-4">
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
              <div
                className="w-1/2 rounded-xl p-5 border border-[#a07840]"
                style={{ background: '#b8955a', backgroundImage: WOOD_GRAIN_DARK }}
              >
                <h2 className="text-2xl font-bold mb-4">Voting Booth</h2>
                <select
                  value={voteTarget}
                  onChange={(e) => setVoteTarget(e.target.value)}
                  className="w-full p-3 rounded mb-4 border border-[#a07840] bg-[#c8a96e] outline-none focus:ring-2 focus:ring-amber-700 text-zinc-900 cursor-pointer"
                >
                  <option value="">Select Player</option>
                  {players.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.username}
                    </option>
                  ))}
                </select>
                <button
                  onClick={castVote}
                  className="w-full bg-red-600 text-white p-3 rounded font-bold hover:bg-red-700 transition cursor-pointer"
                >
                  Cast Vote
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </main>
  )
}