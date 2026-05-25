'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    getUser()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          const name =
            session.user.user_metadata?.username ||
            session.user.email?.split('@')[0]

          setUsername(name)
        } else {
          setUsername(null)
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
  }

  async function logout() {
    await supabase.auth.signOut()
    setUsername(null)
    router.push('/')
  }

  const btnStyle =
    "px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition cursor-pointer"

  return (
    <nav className="w-full bg-zinc-900 text-white px-6 py-3 flex items-center justify-between">

      {/* LEFT SPACER */}
      <div className="w-1/3" />

      {/* CENTER NAV BUTTONS */}
      <div className="w-1/3 flex justify-center gap-3">

        {/* NEW: HOME BUTTON (left of others) */}
        <button
          onClick={() => router.push('/')}
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

      {/* RIGHT LOGOUT */}
      <div className="w-1/3 flex justify-end">
        {username && (
          <button
            onClick={logout}
            className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 active:scale-95 transition cursor-pointer"
          >
            Logout
          </button>
        )}
      </div>

    </nav>
  )
}