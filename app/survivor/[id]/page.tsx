'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  user_id: string
  username: string
}

type Message = {
  id: string
  content: string
  sender_id: string
  username?: string
  created_at?: string
}

type Tab = 'Lobby' | 'Camp' | 'Challenge Beach' | 'Tiki Court'

const TABS: Tab[] = ['Lobby', 'Camp', 'Challenge Beach', 'Tiki Court']

export default function SeasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()

  const [lobbyId, setLobbyId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [lobby, setLobby] = useState<any>(null)
  const [isPlayerInLobby, setIsPlayerInLobby] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Lobby')

  const chatRef = useRef<HTMLDivElement>(null)

  // -----------------------------
  // PARAMS
  // -----------------------------
  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setLobbyId(p.id)
    })
  }, [params])

  // -----------------------------
  // INIT
  // -----------------------------
  useEffect(() => {
    if (!lobbyId) return

    getCurrentUser()
    loadLobby()
    loadPlayers()
    loadMessages()

    const interval = setInterval(() => {
      loadPlayers()
      loadMessages()
    }, 3000)

    return () => clearInterval(interval)
  }, [lobbyId])

  // -----------------------------
  // AUTO SCROLL CHAT
  // -----------------------------
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // -----------------------------
  // CURRENT USER
  // -----------------------------
  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsPlayerInLobby(false)
      return
    }

    const { data } = await supabase
      .from('lobby_players')
      .select('id')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.id)
      .maybeSingle()

    setIsPlayerInLobby(!!data)
  }

  // -----------------------------
  // LOBBY
  // -----------------------------
  async function loadLobby() {
    const { data } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .maybeSingle()

    setLobby(data)
  }

  // -----------------------------
  // PLAYERS
  // -----------------------------
  async function loadPlayers() {
    const { data, error } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyId)

    if (error) {
      console.error('PLAYER ERROR:', error)
      return
    }

    if (!data || data.length === 0) {
      setPlayers([])
      return
    }

    const userIds = data.map((p) => p.user_id)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)

    const usernameMap = Object.fromEntries(
      (profileData || []).map((p) => [p.id, p.username])
    )

    const formattedPlayers: Player[] = data.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      username: usernameMap[p.user_id] || p.user_id.slice(0, 8),
    }))

    setPlayers(formattedPlayers)
  }

  // -----------------------------
  // LOAD MESSAGES
  // -----------------------------
  async function loadMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('season_id', lobbyId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('MESSAGE LOAD ERROR:', error)
      return
    }

    if (!data || data.length === 0) {
      setMessages([])
      return
    }

    const senderIds = [...new Set(data.map((m) => m.sender_id))]

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', senderIds)

    const profileMap = Object.fromEntries(
      (profileData || []).map((p) => [p.id, p.username])
    )

    setMessages(
      data.map((m) => ({
        ...m,
        username: profileMap[m.sender_id] || 'Unknown User',
      }))
    )
  }

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  async function sendMessage() {
    if (!text.trim()) return

    if (!isPlayerInLobby) {
      alert('You must be in this lobby to chat.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase.from('messages').insert({
      season_id: lobbyId,
      sender_id: user.id,
      content: text.trim(),
    })

    if (error) {
      console.error('MESSAGE ERROR:', error)
      return
    }

    setText('')
    loadMessages()
  }

  // -----------------------------
  // VOTING
  // -----------------------------
  async function castVote() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !voteTarget) return

    const { error } = await supabase.from('votes').insert({
      season_id: lobbyId,
      voter_id: user.id,
      target_id: voteTarget,
    })

    if (error) {
      console.error('VOTE ERROR:', error)
      return
    }

    alert('Vote submitted')
  }

  // -----------------------------
  // DAY SYSTEM
  // -----------------------------
  function getDayNumber() {
    if (!lobby?.started_at) return 0

    const start = new Date(lobby.started_at).getTime()
    const now = Date.now()
    const hoursPassed = (now - start) / (1000 * 60 * 60)
    return Math.floor(hoursPassed / 12) + 1
  }

  // -----------------------------
  // MESSAGE DAY
  // -----------------------------
  function getMessageDay(createdAt?: string) {
    if (!createdAt || !lobby?.started_at) return 0

    const start = new Date(lobby.started_at).getTime()
    const messageTime = new Date(createdAt).getTime()
    const hoursPassed = (messageTime - start) / (1000 * 60 * 60)

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

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex gap-4 p-4">

      {/* ── LEFT COLUMN (narrow) ── */}
      <aside className="w-48 shrink-0 flex flex-col gap-4">

        {/* Day Counter */}
        <div className="bg-amber-100 text-black rounded-2xl p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">
            Current Day
          </p>
          <p className="font-black text-5xl tracking-[0.2em] uppercase leading-none">
            {day}
          </p>
        </div>

      </aside>

      {/* ── RIGHT COLUMN (large, tabbed) ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Wooden folder tabs */}
        <div className="flex items-end gap-1 px-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  relative px-5 py-2 rounded-t-lg font-bold text-sm
                  transition-all duration-150 select-none
                  border-t border-l border-r
                  ${isActive
                    ? 'bg-[#c8a96e] text-zinc-900 border-[#a07840] z-10 -mb-px pb-3 shadow-md'
                    : 'bg-[#8b6840] text-[#e8d0a0] border-[#6b4820] hover:bg-[#9b7850] hover:text-[#f0ddb0]'
                  }
                `}
                style={{
                  backgroundImage: isActive
                    ? `repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 3px,
                        rgba(0,0,0,0.03) 3px,
                        rgba(0,0,0,0.03) 4px
                      ), repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 5px,
                        rgba(0,0,0,0.02) 5px,
                        rgba(0,0,0,0.02) 6px
                      )`
                    : `repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 3px,
                        rgba(0,0,0,0.06) 3px,
                        rgba(0,0,0,0.06) 4px
                      ), repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 5px,
                        rgba(0,0,0,0.04) 5px,
                        rgba(0,0,0,0.04) 6px
                      )`,
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Tab panel */}
        <div
          className="flex-1 rounded-2xl rounded-tl-none overflow-hidden border border-[#a07840]"
          style={{
            background: '#c8a96e',
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 3px,
                rgba(0,0,0,0.025) 3px,
                rgba(0,0,0,0.025) 4px
              ),
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 5px,
                rgba(0,0,0,0.015) 5px,
                rgba(0,0,0,0.015) 6px
              )
            `,
          }}
        >

          {/* ── LOBBY TAB ── */}
          {activeTab === 'Lobby' && (
            <div className="p-6 text-zinc-900 h-full overflow-y-auto">
              <h2 className="text-3xl font-bold mb-4">Players</h2>

              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => router.push(`/profile/${player.username}`)}
                    className="
                      bg-[#b8955a] p-3 rounded
                      cursor-pointer
                      hover:bg-[#a07840]
                      transition
                      select-none
                      font-medium
                    "
                  >
                    {player.username}
                  </div>
                ))}
              </div>

              <p className="italic text-zinc-700 mt-4">
                Waiting for players ({players.length}/16)
              </p>
            </div>
          )}

          {/* ── CAMP TAB (Tribe Chat) ── */}
          {activeTab === 'Camp' && (
            <div className="p-6 flex flex-col h-full text-zinc-900">
              <h2 className="text-3xl font-bold mb-4">Tribe Chat</h2>

              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto mb-4 pr-2"
              >
                <div className="flex flex-col justify-end min-h-full space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className="bg-[#b8955a] p-3 rounded"
                    >
                      <div className="flex justify-between mb-1">
                        <p className="text-yellow-800 font-bold text-sm">
                          {m.username}
                        </p>
                        <p className="text-xs text-zinc-600">
                          Day {getMessageDay(m.created_at)}
                        </p>
                      </div>
                      <p>{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={!isPlayerInLobby}
                  className="flex-1 bg-[#b8955a] p-3 rounded disabled:opacity-50 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-amber-700"
                  placeholder={
                    isPlayerInLobby ? 'Type message...' : 'Join this lobby to chat'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendMessage()
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!isPlayerInLobby}
                  className="bg-yellow-700 text-white px-4 rounded font-bold disabled:opacity-50 hover:bg-yellow-800 transition"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* ── CHALLENGE BEACH TAB ── */}
          {activeTab === 'Challenge Beach' && (
            <div className="p-6 text-zinc-900 h-full flex items-center justify-center">
              <p className="text-xl italic text-zinc-600">
                Challenge Beach — coming soon
              </p>
            </div>
          )}

          {/* ── TIKI COURT TAB (Voting) ── */}
          {activeTab === 'Tiki Court' && (
            <div className="p-6 text-zinc-900 h-full">
              <h2 className="text-3xl font-bold mb-4">Voting Parchment</h2>

              <select
                value={voteTarget}
                onChange={(e) => setVoteTarget(e.target.value)}
                className="w-full p-3 rounded mb-4 border border-[#a07840] bg-[#b8955a] outline-none focus:ring-2 focus:ring-amber-700"
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
                className="w-full bg-red-600 text-white p-3 rounded font-bold hover:bg-red-700 transition"
              >
                Cast Vote
              </button>
            </div>
          )}

        </div>
      </div>

    </main>
  )
}