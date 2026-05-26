'use client'

import { useEffect, useState, useRef } from 'react'
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

export default function SeasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [lobbyId, setLobbyId] = useState<string | null>(null)

  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<Message[]>([])

  const [text, setText] = useState('')
  const [voteTarget, setVoteTarget] = useState('')

  const [lobby, setLobby] = useState<any>(null)

  const [isPlayerInLobby, setIsPlayerInLobby] =
    useState(false)

  const chatRef = useRef<HTMLDivElement>(null)

  const MAX_PLAYERS = 16

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
  // AUTO SCROLL CHAT TO BOTTOM
  // -----------------------------
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop =
        chatRef.current.scrollHeight
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
      (profileData || []).map((p) => [
        p.id,
        p.username,
      ])
    )

    const formattedPlayers: Player[] = data.map(
      (p) => ({
        id: p.id,
        user_id: p.user_id,
        username:
          usernameMap[p.user_id] ||
          p.user_id.slice(0, 8),
      })
    )

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
      .order('created_at', {
        ascending: true,
      })

    if (error) {
      console.error(
        'MESSAGE LOAD ERROR:',
        error
      )
      return
    }

    if (!data || data.length === 0) {
      setMessages([])
      return
    }

    const senderIds = [
      ...new Set(
        data.map((m) => m.sender_id)
      ),
    ]

    const { data: profileData } =
      await supabase
        .from('profiles')
        .select('id, username')
        .in('id', senderIds)

    const profileMap = Object.fromEntries(
      (profileData || []).map((p) => [
        p.id,
        p.username,
      ])
    )

    setMessages(
      data.map((m) => ({
        ...m,
        username:
          profileMap[m.sender_id] ||
          'Unknown User',
      }))
    )
  }

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  async function sendMessage() {
    if (!text.trim()) return

    if (!isPlayerInLobby) {
      alert(
        'You must be in this lobby to chat.'
      )
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('messages')
      .insert({
        season_id: lobbyId,
        sender_id: user.id,
        content: text.trim(),
      })

    if (error) {
      console.error(
        'MESSAGE ERROR:',
        error
      )
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

    const { error } = await supabase
      .from('votes')
      .insert({
        season_id: lobbyId,
        voter_id: user.id,
        target_id: voteTarget,
      })

    if (error) {
      console.error(
        'VOTE ERROR:',
        error
      )
      return
    }

    alert('Vote submitted')
  }

  // -----------------------------
  // DAY SYSTEM
  // -----------------------------
  function getDayNumber() {
    if (!lobby?.started_at) return 0

    const start = new Date(
      lobby.started_at
    ).getTime()

    const now = Date.now()

    const hoursPassed =
      (now - start) /
      (1000 * 60 * 60)

    return (
      Math.floor(hoursPassed / 12) + 1
    )
  }

  const day = getDayNumber()

  // -----------------------------
  // MESSAGE DAY
  // -----------------------------
  function getMessageDay(
    createdAt?: string
  ) {
    if (
      !createdAt ||
      !lobby?.started_at
    )
      return 0

    const start = new Date(
      lobby.started_at
    ).getTime()

    const messageTime = new Date(
      createdAt
    ).getTime()

    const hoursPassed =
      (messageTime - start) /
      (1000 * 60 * 60)

    if (hoursPassed < 0) return 0

    return (
      Math.floor(hoursPassed / 12) + 1
    )
  }

  // -----------------------------
  // LOADING
  // -----------------------------
  if (!lobbyId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading...
      </div>
    )
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <main className="min-h-screen bg-zinc-950 text-white grid grid-cols-3 gap-6 p-6">

      {/* PLAYERS */}
      <div className="bg-zinc-900 rounded-2xl p-6">

        <h2 className="text-3xl font-bold mb-4">
          Players
        </h2>

        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="bg-zinc-800 p-3 rounded"
            >
              {player.username}
            </div>
          ))}
        </div>

        <p className="italic text-zinc-400 mt-4">
          Waiting for players (
          {players.length}/{MAX_PLAYERS})
        </p>
      </div>

      {/* CHAT */}
      <div className="bg-zinc-900 rounded-2xl p-6 flex flex-col h-[85vh]">

        <h2 className="text-3xl font-bold mb-4">
          Tribe Chat
        </h2>

        {/* CHAT AREA */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto mb-4 pr-2"
        >
          <div className="flex flex-col justify-end min-h-full space-y-3">

            {messages.map((m) => (
              <div
                key={m.id}
                className="bg-zinc-800 p-3 rounded"
              >

                {/* TOP ROW */}
                <div className="flex justify-between items-start mb-1">

                  <p className="text-yellow-400 font-bold text-sm">
                    {m.username}
                  </p>

                  <p className="text-xs text-zinc-400">
                    Day {getMessageDay(m.created_at)}
                  </p>

                </div>

                {/* CONTENT */}
                <p className="text-white break-words">
                  {m.content}
                </p>

              </div>
            ))}

          </div>
        </div>

        {/* INPUT */}
        <div className="flex gap-2 mt-auto">

          <input
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            disabled={!isPlayerInLobby}
            className="flex-1 bg-zinc-800 p-3 rounded disabled:opacity-50"
            placeholder={
              isPlayerInLobby
                ? 'Type message...'
                : 'Join this lobby to chat'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                sendMessage()
              }
            }}
          />

          <button
            onClick={sendMessage}
            disabled={!isPlayerInLobby}
            className="bg-yellow-500 text-black px-4 rounded font-bold disabled:opacity-50"
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
          onChange={(e) =>
            setVoteTarget(
              e.target.value
            )
          }
          className="w-full p-3 rounded mb-4 border"
        >
          <option value="">
            Select Player
          </option>

          {players.map((p) => (
            <option
              key={p.user_id}
              value={p.user_id}
            >
              {p.username}
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

          <p className="font-black text-5xl tracking-[0.3em] uppercase">
            DAY {day}
          </p>

        </div>
      </div>

    </main>
  )
}