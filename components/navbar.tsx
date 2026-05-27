'use client'

import { useEffect, useState } from 'react'
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

  usePresence(userId)

  // -----------------------------
  // GET USER + PROFILE (COINS + CROWNS)
  // -----------------------------
  async function getUser() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      setUsername(null)
      setUserId(null)
      setCoins(0)
      setCrowns(0)
      return
    }

    setUserId(userData.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, coins, crowns')
      .eq('id', userData.user.id)
      .single()

    if (profile) {
      setUsername(profile.username)
      setCoins(profile.coins || 0)
      setCrowns(profile.crowns || 0)
    } else {
      setUsername(null)
      setCoins(0)
      setCrowns(0)
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

  // -----------------------------
  // ONLINE USERS
  // -----------------------------
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

    router.push('/')
  }

  const btnStyle =
    'px-4 py-2 rounded-lg bg-black/40 border border-yellow-700 hover:bg-yellow-700/40 active:scale-95 transition cursor-pointer text-white shadow-md backdrop-blur-sm'

  return (
    <nav
      className="w-full px-6 py-3 flex items-center justify-between border-b border-yellow-900 text-white relative"
    >

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
<div className="w-1/3 flex items-center gap-2 text-sm">
  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
  <span>{onlineCount} online</span>
</div>

      {/* CENTER */}
      <div className="w-1/3 flex justify-center gap-3 flex-wrap">

        <button onClick={() => router.push('/home')} className={btnStyle}>
          Home
        </button>

        <button onClick={() => router.push('/games')} className={btnStyle}>
          Games
        </button>

        <button onClick={() => router.push('/shop')} className={btnStyle}>
          Shop
        </button>

        <button onClick={() => router.push('/leaderboards')} className={btnStyle}>
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

      {/* RIGHT */}
      <div className="w-1/3 flex justify-end items-center gap-4">

        {/* CROWNS */}
        {username && (
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-gray-400 crown-shimmer">

            <Image
              src="/crown.png"
              alt="Crowns"
              width={18}
              height={18}
            />

            <span className="text-gray-200 font-semibold">
              {crowns}
            </span>

          </div>
        )}

        {/* COINS */}
        {username && (
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-yellow-700">

            <Image
              src="/coin.png"
              alt="Coins"
              width={18}
              height={18}
            />

            <span className="text-yellow-300 font-semibold">
              {coins}
            </span>

          </div>
        )}

        {/* SETTINGS */}
        {username && (
          <button className="w-8 h-8 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center border border-zinc-500 transition cursor-pointer">
            <Image src="/gear.png" alt="Settings" width={16} height={16} />
          </button>
        )}

        {/* LOGIN / LOGOUT TOGGLE */}
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