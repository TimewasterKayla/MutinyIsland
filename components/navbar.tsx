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

  // -----------------------------
  // PRESENCE TRACKING
  // -----------------------------
  usePresence(userId)

  // -----------------------------
  // GET USER PROFILE
  // -----------------------------
  async function getUserProfile() {
    const { data: userData } =
      await supabase.auth.getUser()

    if (!userData.user) {
      setUsername(null)
      setUserId(null)
      setCoins(0)
      return
    }

    setUserId(userData.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, coins')
      .eq('id', userData.user.id)
      .single()

    if (profile) {
      setUsername(profile.username)
      setCoins(profile.coins || 0)
    }
  }

  // -----------------------------
  // AUTH LISTENER
  // -----------------------------
  useEffect(() => {
    getUserProfile()

    const { data: listener } =
      supabase.auth.onAuthStateChange(() => {
        getUserProfile()
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
      const lastSeen = new Date(
        u.last_seen
      ).getTime()

      return now - lastSeen < 60000
    })

    setOnlineCount(online.length)
  }

  useEffect(() => {
    fetchOnlineUsers()

    const interval = setInterval(
      fetchOnlineUsers,
      30000
    )

    return () => clearInterval(interval)
  }, [])

  // -----------------------------
  // LOGOUT
  // -----------------------------
  async function logout() {
    await supabase.auth.signOut()

    setUsername(null)
    setUserId(null)
    setCoins(0)

    router.push('/')
  }

  // -----------------------------
  // BUTTON STYLE
  // -----------------------------
  const btnStyle =
    'px-4 py-2 rounded-lg bg-black/40 border border-yellow-700 hover:bg-yellow-700/40 active:scale-95 transition cursor-pointer text-white shadow-md backdrop-blur-sm'

  return (
    <nav
      className="
        w-full
        px-6
        py-3
        flex
        items-center
        justify-between
        border-b
        border-yellow-900
        bg-[#3b2414]
        text-white
      "
      style={{
        backgroundImage:
          "url('/wood-texture.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >

      {/* LEFT */}
      <div className="w-1/3 flex items-center gap-2 text-sm">

        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />

        <span>{onlineCount} online</span>

      </div>

      {/* CENTER */}
      <div className="w-1/3 flex justify-center gap-3 flex-wrap">

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
          onClick={() =>
            router.push('/leaderboards')
          }
          className={btnStyle}
        >
          Leaderboards
        </button>

        {username && (
          <button
            onClick={() =>
              router.push(`/profile/${username}`)
            }
            className={btnStyle}
          >
            {username}'s Profile
          </button>
        )}

      </div>

      {/* RIGHT */}
      <div className="w-1/3 flex justify-end items-center gap-4">

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

        {/* LOGOUT */}
        {username && (
          <button
            onClick={logout}
            className="
              bg-red-600
              px-3
              py-1
              rounded-lg
              hover:bg-red-700
              active:scale-95
              transition
              cursor-pointer
              text-white
              shadow-md
            "
          >
            Logout
          </button>
        )}

      </div>

    </nav>
  )
}