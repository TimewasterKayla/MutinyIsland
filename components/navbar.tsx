'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresence } from "@/lib/usePresence"

export default function Navbar() {
  const router = useRouter()

  const [username, setUsername] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [coins, setCoins] = useState(0)

  // ----------------------------
  // AUTH
  // ----------------------------
  useEffect(() => {
    getUser()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const name =
            session.user.user_metadata?.username ||
            session.user.email?.split('@')[0]

          setUsername(name)

          // fetch coins when auth changes
          fetchCoins(session.user.id)
        } else {
          setUsername(null)
          setCoins(0)
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  async function getUser() {
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
      setUsername(null)
      return
    }

    const name =
      data.user.user_metadata?.username ||
      data.user.email?.split('@')[0]

    setUsername(name)

    // fetch coins on page load
    fetchCoins(data.user.id)
  }

  // ----------------------------
  // PRESENCE SYSTEM
  // ----------------------------
  usePresence(username)

  // ----------------------------
  // FETCH ONLINE USERS
  // ----------------------------
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

  // ----------------------------
  // FETCH COINS
  // ----------------------------
  async function fetchCoins(userId: string | null) {
    if (!userId) return

    const { data } = await supabase
      .from('user_coins')
      .select('coins')
      .eq('user_id', userId)
      .single()

    if (data?.coins !== undefined) {
      setCoins(data.coins)
    }
  }

  // ----------------------------
  // LOGOUT
  // ----------------------------
  async function logout() {
    await supabase.auth.signOut()
    setUsername(null)
    setCoins(0)
    router.push('/')
  }

  const btnStyle =
    "px-4 py-2 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-700 shadow-md active:scale-95 transition cursor-pointer"

  return (
    <nav className="w-full text-white px-6 py-3 flex items-center justify-between border-b-4 border-amber-950 shadow-xl relative overflow-hidden bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950">

      {/* WOOD GRAIN OVERLAY */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 8px)"
        }}
      />

      {/* PLANK LINES */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 36px, rgba(0,0,0,0.35) 37px, transparent 38px)"
        }}
      />

      {/* LEFT: ONLINE USERS */}
      <div className="relative z-10 w-1/3 flex items-center gap-2 text-sm text-zinc-200">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span>{onlineCount} online</span>
      </div>

      {/* CENTER NAV BUTTONS */}
      <div className="relative z-10 w-1/3 flex justify-center gap-3">

        <button
          onClick={() => router.push('/home')}
          className={btnStyle}
        >
          Home
        </button>

        <button
          onClick={() => router.push('/games')}
          className={btnStyle}
        >
          Games
        </button>

        <button
          onClick={() => router.push('/shop')}
          className={btnStyle}
        >
          Shop
        </button>

        <button
          onClick={() => router.push('/leaderboards')}
          className={btnStyle}
        >
          Leaderboards
        </button>

        {username && (
          <button
            onClick={() => router.push(`/profile/${username}`)}
            className={btnStyle}
          >
            {username}'s Profile
          </button>
        )}

      </div>

      {/* RIGHT: COINS + LOGOUT */}
      <div className="relative z-10 w-1/3 flex justify-end items-center gap-3">

        {/* COINS */}
        <div className="flex items-center gap-1 text-sm text-yellow-200">

          <img
            src="/coin.png"
            alt="coin"
            className="w-4 h-4"
          />

          <span>{coins}</span>
        </div>

        {/* LOGOUT */}
        {username && (
          <button
            onClick={logout}
            className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded border border-red-900 shadow-md active:scale-95 transition cursor-pointer"
          >
            Logout
          </button>
        )}

      </div>

    </nav>
  )
}