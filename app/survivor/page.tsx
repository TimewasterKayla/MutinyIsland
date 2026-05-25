'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SurvivorPage() {
  const [seasons, setSeasons] = useState<any[]>([])

  useEffect(() => {
    loadSeasons()
  }, [])

  async function loadSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setSeasons(data)
  }

  async function createSeason() {
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('name', 'Survivor')
      .single()

    if (!game) return

    await supabase.from('seasons').insert({
      game_id: game.id,
      next_deadline: new Date(Date.now() + 1000 * 60 * 60 * 12),
    })

    loadSeasons()
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-5xl font-bold">Survivor Seasons</h1>

        <button
          onClick={createSeason}
          className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold"
        >
          Create Season
        </button>
      </div>

      <div className="grid gap-6">
        {seasons.map((season) => (
          <a
            key={season.id}
            href={`/survivor/${season.id}`}
            className="bg-zinc-900 p-6 rounded-2xl"
          >
            <h2 className="text-2xl font-bold">Season {season.id.slice(0, 6)}</h2>
            <p>Status: {season.status}</p>
          </a>
        ))}
      </div>
    </main>
  )
}