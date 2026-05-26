'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SurvivorPage() {
  const [lobbies, setLobbies] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // -----------------------------
  // LOAD LOBBIES
  // -----------------------------
  async function fetchLobbies() {
    const { data } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'open')

    setLobbies(data || [])
  }

  useEffect(() => {
    fetchLobbies()
  }, [])

  // -----------------------------
  // JOIN / CREATE GAME
  // -----------------------------
  async function joinGame(lobbyId?: string) {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // prevent multiple games per user
    const { data: existing } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      alert('You are already in a game')
      setLoading(false)
      return
    }

    let targetLobbyId = lobbyId

    // find or create lobby
    if (!targetLobbyId) {
      const { data: openLobby } = await supabase
        .from('lobbies')
        .select('*')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()

      if (openLobby) {
        targetLobbyId = openLobby.id
      } else {
        const { data: newLobby } = await supabase
          .from('lobbies')
          .insert({ status: 'open' })
          .select()
          .single()

        targetLobbyId = newLobby.id
      }
    }

    await supabase.from('lobby_players').insert({
      lobby_id: targetLobbyId,
      user_id: user.id,
    })

    setLoading(false)
    fetchLobbies()

    // go straight into lobby page
    router.push(`/survivor/${targetLobbyId}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">

      {/* LEFT */}
      <div className="w-1/2 p-6 border-r border-zinc-800">
        <h1 className="text-3xl font-bold mb-4">Public Islands</h1>

        <button
          onClick={() => joinGame()}
          className="bg-green-500 text-black px-4 py-2 rounded font-bold mb-6"
        >
          Join Game
        </button>

        <div className="space-y-3">
          {lobbies.map((lobby) => (
            <div
              key={lobby.id}
              className="bg-zinc-800 p-3 rounded flex justify-between items-center"
            >
              <span>Island #{lobby.id.slice(0, 6)}</span>

              <div className="flex gap-2">
                <button
                  onClick={() => joinGame(lobby.id)}
                  className="bg-white text-black px-3 py-1 rounded"
                >
                  Join
                </button>

                <button
                  onClick={() => router.push(`/survivor/${lobby.id}`)}
                  className="bg-zinc-600 px-3 py-1 rounded"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-1/2 p-6">
        <h1 className="text-3xl font-bold">Private Islands</h1>
      </div>

    </div>
  )
}