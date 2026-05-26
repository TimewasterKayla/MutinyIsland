'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  user_id: string
  tribe: string | null
  profiles: {
    username: string
  } | null
}

type Message = {
  id: string
  content: string
}

export default function SeasonPage({
  params,
}: {
  params: { id: string }
}) {
  const lobbyId = params.id

  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [voteTarget, setVoteTarget] = useState('')
  const [lobby, setLobby] = useState<any>(null)

  const MAX_PLAYERS = 16

  // -----------------------------
  // INIT
  // -----------------------------
  useEffect(() => {
    loadLobby()
    loadPlayers()
    loadMessages()

    const interval = setInterval(() => {
      loadPlayers()
    }, 3000)

    return () => clearInterval(interval)
  }, [lobbyId])

  // -----------------------------
  // LOBBY
  // -----------------------------
  async function loadLobby() {
    const { data } = await supabase
      .from('lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single()

    setLobby(data)
  }

  // -----------------------------
  // PLAYERS (FIXED - NO BROKEN JOIN)
  // -----------------------------
  async function loadPlayers() {
    // STEP 1: get lobby players
    const { data: lobbyPlayers, error } = await supabase
      .from('lobby_players')
      .select('id, user_id, tribe')
      .eq('lobby_id', lobbyId)

    if (error) {
      console.error('PLAYER LOAD ERROR:', error)
      return
    }

    if (!lobbyPlayers || lobbyPlayers.length === 0) {
      setPlayers([])
      return
    }

    // STEP 2: get profiles separately
    const userIds = lobbyPlayers.map((p) => p.user_id)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)

    // STEP 3: merge manually
    const merged: Player[] = lobbyPlayers.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      tribe: p.tribe ?? null,
      profiles:
        profiles?.find((x) => x.id === p.user_id) || null,
    }))

    setPlayers(merged)
  }

  // -----------------------------
  // MESSAGES
  // -----------------------------
  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('season_id', lobbyId)
      .order('created_at', { ascending: true })

    setMessages(data || [])
  }

  async function sendMessage() {
    if (!text) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('messages').insert({
      season_id: lobbyId,
      sender_id: user.id,
      content: text,
    })

    setText('')
    loadMessages()
  }

  async function castVote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !voteTarget) return

    await supabase.from('votes').insert({
      season_id: lobbyId,
      voter_id: user.id,
      target_id: voteTarget,
    })

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

  const day = getDayNumber()

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <main className="min-h-screen bg-zinc-950 text-white grid grid-cols-3 gap-6 p-6">

      {/* PLAYERS */}
      <div className="bg-zinc-900 rounded-2xl p-6">
        <h2 className="text-3xl font-bold mb-4">Players</h2>

        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="bg-zinc-800 p-3 rounded"
            >
              {player.profiles?.username || player.user_id}
            </div>
          ))}
        </div>

        <p className="italic text-zinc-400 mt-4">
          Waiting for players ({players.length}/{MAX_PLAYERS})
        </p>
      </div>

      {/* CHAT */}
      <div className="bg-zinc-900 rounded-2xl p-6 flex flex-col">
        <h2 className="text-3xl font-bold mb-4">Tribe Chat</h2>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {messages.map((m) => (
            <div key={m.id} className="bg-zinc-800 p-2 rounded">
              {m.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-zinc-800 p-3 rounded"
            placeholder="Type message..."
          />

          <button
            onClick={sendMessage}
            className="bg-yellow-500 text-black px-4 rounded"
          >
            Send
          </button>
        </div>
      </div>

      {/* VOTING + DAY */}
      <div className="bg-amber-100 text-black rounded-2xl p-6 relative">

        <h2 className="text-3xl font-bold mb-4">
          Voting Parchment
        </h2>

        <select
          value={voteTarget}
          onChange={(e) => setVoteTarget(e.target.value)}
          className="w-full p-3 rounded mb-4 border"
        >
          <option value="">Select Player</option>

          {players.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.profiles?.username || p.user_id}
            </option>
          ))}
        </select>

        <button
          onClick={castVote}
          className="w-full bg-red-500 text-white p-3 rounded font-bold"
        >
          Cast Vote
        </button>

        {/* DAY DISPLAY */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="font-bold text-2xl tracking-widest uppercase">
            DAY {day}
          </p>
        </div>
      </div>

    </main>
  )
}