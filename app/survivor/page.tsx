'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SurvivorPage() {
  const [lobbies, setLobbies] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function fetchLobbies() {
    const { data, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'open')

    if (error) {
      console.error('LOBBY LOAD ERROR:', error)
      return
    }

    setLobbies(data || [])
  }

  useEffect(() => {
    fetchLobbies()
  }, [])

  async function joinGame(lobbyId?: string) {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // prevent multiple games per user
    const { data: existing, error: existingError } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) {
      console.error('CHECK PLAYER ERROR:', existingError)
    }

    if (existing) {
      alert('You are already in a game')
      setLoading(false)
      return
    }

    let targetLobbyId = lobbyId

    // find or create lobby
    if (!targetLobbyId) {
      const { data: openLobby, error: openError } = await supabase
        .from('lobbies')
        .select('id')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()

      if (openError) {
        console.error('OPEN LOBBY ERROR:', openError)
      }

      if (openLobby?.id) {
        targetLobbyId = openLobby.id
      } else {
        const { data: newLobby, error: insertError } = await supabase
          .from('lobbies')
          .insert({ status: 'open' })
          .select('id')
          .single()

        if (insertError) {
          console.error('CREATE LOBBY ERROR:', insertError)
          setLoading(false)
          return
        }

        targetLobbyId = newLobby?.id
      }
    }

    // FINAL SAFETY CHECK (CRITICAL)
    if (!targetLobbyId) {
      console.error('NO LOBBY ID GENERATED')
      setLoading(false)
      return
    }

    // join lobby
    const { error: joinError } = await supabase
      .from('lobby_players')
      .insert({
        lobby_id: targetLobbyId,
        user_id: user.id,
      })

    if (joinError) {
      console.error('JOIN ERROR:', joinError)
      setLoading(false)
      return
    }

    setLoading(false)
    fetchLobbies()

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