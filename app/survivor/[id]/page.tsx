'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  user_id: string
  tribe: string
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
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [voteTarget, setVoteTarget] = useState('')

  useEffect(() => {
    loadPlayers()
    loadMessages()
  }, [])

  async function loadPlayers() {
    const { data, error } = await supabase
      .from('season_players')
      .select('*')
      .eq('season_id', params.id)

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setPlayers(data)
    }
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('season_id', params.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setMessages(data)
    }
  }

  async function sendMessage() {
    if (!text) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase.from('messages').insert([
      {
        season_id: params.id,
        sender_id: user.id,
        content: text,
      },
    ])

    if (error) {
      console.error(error)
      return
    }

    setText('')
    loadMessages()
  }

  async function castVote() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    if (!voteTarget) {
      alert('Select a player')
      return
    }

    const { error } = await supabase.from('votes').insert([
      {
        season_id: params.id,
        voter_id: user.id,
        target_id: voteTarget,
      },
    ])

    if (error) {
      console.error(error)
      return
    }

    alert('Vote submitted')
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white grid grid-cols-3 gap-6 p-6">
      {/* PLAYERS */}
      <div className="bg-zinc-900 rounded-2xl p-6">
        <h2 className="text-3xl font-bold mb-4">Players</h2>

        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="bg-zinc-800 p-3 rounded"
            >
              {player.user_id}
            </div>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <div className="bg-zinc-900 rounded-2xl p-6 flex flex-col">
        <h2 className="text-3xl font-bold mb-4">
          Tribe Chat
        </h2>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className="bg-zinc-800 p-2 rounded"
            >
              {message.content}
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

      {/* VOTING */}
      <div className="bg-amber-100 text-black rounded-2xl p-6">
        <h2 className="text-3xl font-bold mb-4">
          Voting Parchment
        </h2>

        <select
          value={voteTarget}
          onChange={(e) => setVoteTarget(e.target.value)}
          className="w-full p-3 rounded mb-4 border"
        >
          <option value="">Select Player</option>

          {players.map((player) => (
            <option
              key={player.user_id}
              value={player.user_id}
            >
              {player.user_id}
            </option>
          ))}
        </select>

        <button
          onClick={castVote}
          className="w-full bg-red-500 text-white p-3 rounded font-bold"
        >
          Cast Vote
        </button>
      </div>
    </main>
  )
}