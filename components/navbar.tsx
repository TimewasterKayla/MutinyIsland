'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { usePresence } from '@/lib/usePresence'

export default function Navbar() {
  const router = useRouter()

  const [username, setUsername] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [coins, setCoins] = useState(0)
  const [crowns, setCrowns] = useState(0)
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  usePresence(userId)

  async function getUser() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      setUsername(null)
      setUserId(null)
      setCoins(0)
      setCrowns(0)
      setMusicEnabled(true)
      return
    }

    setUserId(userData.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, coins, crowns, music_enabled')
      .eq('id', userData.user.id)
      .single()

    if (profile) {
      setUsername(profile.username)
      setCoins(profile.coins || 0)
      setCrowns(profile.crowns || 0)
      setMusicEnabled(profile.music_enabled ?? true)
    } else {
      setUsername(null)
      setCoins(0)
      setCrowns(0)
      setMusicEnabled(true)
    }
  }

  useEffect(() => {
    getUser()

    const { data: listener } =
      supabase.auth.onAuthStateChange(() => {
        getUser()
      })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // Close settings dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // React to musicEnabled changes — pause or resume any active audio
  useEffect(() => {
    const audio = (window as any).__leaderboardAudio
    if (!audio) return
    if (musicEnabled) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [musicEnabled])

  async function toggleMusic() {
    const next = !musicEnabled
    setMusicEnabled(next)

    if (userId) {
      await supabase
        .from('profiles')
        .update({ music_enabled: next })
        .eq('id', userId)
    }
  }

  async function fetchOnlineUsers() {
    const { data } = await supabase
      .from('user_presence')
      .select('*')

    if (!data) return

    const now = Date.now()

    const online = data.filter((u: any) => {
      const lastSeen = new Date(u.last_seen).getTime()
      return now - lastSeen < 60000
    })

    setOnlineCount(online.length)
  }

  useEffect(() => {
    fetchOnlineUsers()
    const interval = setInterval(fetchOnlineUsers, 30000)
    return () => clearInterval(interval)
  }, [])

  async function logout() {
    await supabase.auth.signOut()

    setUsername(null)
    setUserId(null)
    setCoins(0)
    setCrowns(0)
    setMusicEnabled(true)

    router.push('/')
  }

  function handleLeaderboardClick() {
    // Only start music if the user has it enabled
    if (!musicEnabled) {
      router.push('/leaderboards')
      return
    }
    const existing = (window as any).__leaderboardAudio
    if (!existing || existing.paused) {
      const audio = new Audio('/throneroom.mp3')
      audio.loop = true
      audio.volume = 0.4
      audio.play().catch(() => {})
      ;(window as any).__leaderboardAudio = audio
    }
    router.push('/leaderboards')
  }

  const btnStyle =
    'px-3 py-2 rounded-lg bg-black/40 border border-yellow-700 hover:bg-yellow-700/40 active:scale-95 transition cursor-pointer text-white shadow-md backdrop-blur-sm text-sm whitespace-nowrap'

  return (
    <nav className="w-full px-6 py-3 flex items-center gap-4 border-b border-yellow-900 text-white relative">

      {/* BACKGROUND IMAGE */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/plank.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* DARK OVERLAY */}
      <div className="absolute inset-0 -z-10 bg-black/40" />

      {/* LEFT */}
      <div className="flex items-center gap-2 text-sm w-72 shrink-0">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>{onlineCount} online</span>
      </div>

      {/* CENTER */}
      <div className="flex-1 flex justify-center gap-2">
        <button onClick={() => router.push('/home')} className={btnStyle}>Home</button>
        <button onClick={() => router.push('/games')} className={btnStyle}>Games</button>
        <button onClick={() => router.push('/shop')} className={btnStyle}>Shop</button>
        <button onClick={() => router.push('/map')} className={btnStyle}>Map</button>
        <button onClick={handleLeaderboardClick} className={btnStyle}>Leaderboards</button>
        {username && (
          <button onClick={() => router.push(`/profile/${username}`)} className={btnStyle}>
            {username}'s Profile
          </button>
        )}
      </div>

      {/* RIGHT */}
      <div className="flex justify-end items-center gap-3 w-72 shrink-0">

        {/* CROWNS */}
        {username && (
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-gray-400 crown-shimmer">
            <Image src="/crown.png" alt="Crowns" width={18} height={18} />
            <span className="text-gray-200 font-semibold">{crowns}</span>
          </div>
        )}

        {/* COINS */}
        {username && (
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-yellow-700">
            <Image src="/coin.png" alt="Coins" width={18} height={18} />
            <span className="text-yellow-300 font-semibold">{coins}</span>
          </div>
        )}

        {/* SETTINGS */}
        {username && (
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className="w-8 h-8 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center border border-zinc-500 transition cursor-pointer"
            >
              <Image src="/gear.png" alt="Settings" width={16} height={16} />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-10 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-zinc-700 bg-zinc-800/80">
                  <span className="text-sm font-semibold text-white tracking-wide">⚙️ Settings</span>
                </div>

                {/* Music toggle */}
                <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-800/50 transition-colors">
                  <span className="text-sm text-zinc-200">🎵 Enable Music</span>
                  <button
                    onClick={toggleMusic}
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all cursor-pointer flex-shrink-0 ${
                      musicEnabled
                        ? 'bg-green-500 border-green-500'
                        : 'bg-transparent border-zinc-500 hover:border-zinc-400'
                    }`}
                    aria-label="Toggle music"
                  >
                    {musicEnabled && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOGIN / LOGOUT */}
        {username ? (
          <button
            onClick={logout}
            className="bg-red-600 px-3 py-1 rounded-lg hover:bg-red-700 active:scale-95 transition cursor-pointer text-white shadow-md"
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => router.push('/')}
            className="bg-zinc-600 px-3 py-1 rounded-lg hover:bg-zinc-500 active:scale-95 transition cursor-pointer text-white shadow-md"
          >
            Login
          </button>
        )}

      </div>

    </nav>
  )
}