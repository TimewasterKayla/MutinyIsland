'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    // initial load
    getUser()

    // listen for login/logout changes
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
    setUsername(null) // 👈 instantly clear UI
    router.push('/')
  }

  return (
    <nav className="w-full bg-zinc-900 text-white flex items-center justify-between px-6 py-3">
      <div className="flex gap-4">
        <button onClick={() => router.push('/games')}>
          Games
        </button>

        {username && (
          <button onClick={() => router.push(`/profile/${username}`)}>
            {username}'s Profile
          </button>
        )}
      </div>

      {username && (
        <button
          onClick={logout}
          className="bg-red-500 px-3 py-1 rounded"
        >
          Logout
        </button>
      )}
    </nav>
  )
}