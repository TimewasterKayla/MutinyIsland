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
      .in('status', ['open', 'active', 'finished'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('LOBBY LOAD ERROR:', error)
      return
    }

    setLobbies(data || [])
  }

  useEffect(() => {
    fetchLobbies()
    const interval = setInterval(fetchLobbies, 5000)
    return () => clearInterval(interval)
  }, [])

  async function joinGame(lobbyId?: string) {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: existing, error: existingError } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) console.error('CHECK PLAYER ERROR:', existingError)

    if (existing) {
      alert('You are already in a game')
      setLoading(false)
      return
    }

    let targetLobbyId = lobbyId

    if (!targetLobbyId) {
      const { data: openLobby, error: openError } = await supabase
        .from('lobbies')
        .select('id')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()

      if (openError) console.error('OPEN LOBBY ERROR:', openError)

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

    if (!targetLobbyId) {
      console.error('NO LOBBY ID GENERATED')
      setLoading(false)
      return
    }

    const { error: joinError } = await supabase
      .from('lobby_players')
      .insert({ lobby_id: targetLobbyId, user_id: user.id })

    if (joinError) {
      console.error('JOIN ERROR:', joinError)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push(`/survivor/${targetLobbyId}`)
  }

  // Derived lobby buckets
  // "open" + not yet started = filling
  // "active" = started_at set, no finished_at = ongoing
  // "finished" or finished_at set = recently finished
  const fillingLobbies  = lobbies.filter(l => l.status === 'open' && !l.started_at)
  const ongoingLobbies  = lobbies.filter(l => l.started_at && !l.finished_at && !l.is_finale
    ? true
    : l.is_finale && !l.finished_at)
  const finishedLobbies = lobbies.filter(l => !!l.finished_at).slice(0, 10)

  function playerCount(lobby: any) {
    // We don't have player counts in this query, so show a dash until we add it
    return null
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs  = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days}d ago`
    if (hrs > 0)  return `${hrs}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'just now'
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">

      {/* LEFT — Public Islands */}
      <div className="w-1/2 p-6 border-r border-zinc-800 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Public Islands</h1>
          <button
            onClick={() => joinGame()}
            disabled={loading}
            className="bg-green-500 text-black px-4 py-2 rounded font-bold cursor-pointer disabled:opacity-50 hover:bg-green-400 transition"
          >
            {loading ? 'Joining...' : 'Join Game'}
          </button>
        </div>

        {/* ── Filling Games ── */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Filling Games
          </h2>
          {fillingLobbies.length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No games filling right now.</p>
          ) : (
            <div className="space-y-2">
              {fillingLobbies.map(lobby => (
                <div key={lobby.id} className="bg-zinc-800 p-3 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold">Island #{lobby.id.slice(0, 6)}</span>
                    <span className="ml-3 text-xs text-zinc-400 uppercase tracking-wide">Open</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => joinGame(lobby.id)}
                      disabled={loading}
                      className="bg-white text-black px-3 py-1 rounded text-sm font-bold cursor-pointer hover:bg-zinc-200 transition disabled:opacity-50"
                    >
                      Join
                    </button>
                    <button
                      onClick={() => router.push(`/survivor/${lobby.id}`)}
                      className="bg-zinc-600 px-3 py-1 rounded text-sm cursor-pointer hover:bg-zinc-500 transition"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Ongoing Games ── */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Ongoing Games
          </h2>
          {ongoingLobbies.length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No games in progress.</p>
          ) : (
            <div className="space-y-2">
              {ongoingLobbies.map(lobby => (
                <div key={lobby.id} className="bg-zinc-800 p-3 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold">Island #{lobby.id.slice(0, 6)}</span>
                    <span className="ml-3 text-xs text-zinc-400 uppercase tracking-wide">
                      {lobby.is_finale ? '🌟 Finale' : `Day ${lobby.current_day ?? '?'}`}
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(`/survivor/${lobby.id}`)}
                    className="bg-zinc-600 px-3 py-1 rounded text-sm cursor-pointer hover:bg-zinc-500 transition"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Recently Finished Games ── */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-zinc-500" />
            Recently Finished
          </h2>
          {finishedLobbies.length === 0 ? (
            <p className="text-zinc-600 text-sm italic">No finished games yet.</p>
          ) : (
            <div className="space-y-2">
              {finishedLobbies.map(lobby => (
                <div key={lobby.id} className="bg-zinc-800/60 p-3 rounded flex justify-between items-center opacity-80">
                  <div>
                    <span className="font-semibold">Island #{lobby.id.slice(0, 6)}</span>
                    <span className="ml-3 text-xs text-zinc-500 uppercase tracking-wide">
                      🏆 Finished · {lobby.finished_at ? timeAgo(lobby.finished_at) : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(`/survivor/${lobby.id}`)}
                    className="bg-zinc-700 px-3 py-1 rounded text-sm cursor-pointer hover:bg-zinc-600 transition"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* RIGHT — Private Islands */}
      <div className="w-1/2 p-6">
        <h1 className="text-3xl font-bold">Private Islands</h1>
      </div>

    </div>
  )
}