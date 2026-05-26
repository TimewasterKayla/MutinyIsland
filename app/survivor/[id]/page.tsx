'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Player = {
  id: string
  user_id: string
}

export default function SeasonPage({
  params,
}: {
  params: { id: string }
}) {
  const lobbyId = params?.id

  const [players, setPlayers] = useState<Player[]>([])
  const [debug, setDebug] = useState<any>(null)

  const MAX_PLAYERS = 16

  useEffect(() => {
    if (!lobbyId) return
    loadPlayers()
  }, [lobbyId])

  async function loadPlayers() {
    console.log('LOBBY ID BEING USED:', lobbyId)

    const { data, error } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyId)

    console.log('RAW SUPABASE RESPONSE:', { data, error })

    setDebug({ data, error })

    if (error) {
      console.error('SUPABASE ERROR:', error)
      return
    }

    setPlayers(data || [])
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      
      <h1 className="text-3xl font-bold mb-4">
        Lobby Debug Page
      </h1>

      <p className="mb-2">
        Lobby ID: <span className="text-yellow-400">{lobbyId}</span>
      </p>

      <p className="mb-6">
        Players Count: {players.length}/{MAX_PLAYERS}
      </p>

      <div className="bg-zinc-900 p-4 rounded mb-6">
        <h2 className="font-bold mb-2">RAW DATA:</h2>
        <pre className="text-xs text-green-400 overflow-auto">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>

      <div className="bg-zinc-900 p-4 rounded">
        <h2 className="font-bold mb-2">PLAYERS:</h2>

        {players.map((p) => (
          <div key={p.id} className="p-2 bg-zinc-800 mb-2 rounded">
            user_id: {p.user_id}
          </div>
        ))}
      </div>

    </main>
  )
}