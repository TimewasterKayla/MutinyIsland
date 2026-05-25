'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    getUser()
  }, [])

  async function getUser() {
    const { data } = await supabase.auth.getUser()

    if (!data.user) return

    // Try to get username from metadata or fallback to email
    const name =
      data.user.user_metadata?.username ||
      data.user.email?.split('@')[0]

    setUsername(name)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="w-full bg-zinc-900 text-white flex items-center justify-between px-6 py-3">
      
      {/* LEFT SIDE */}
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

      {/* RIGHT SIDE */}
      <button
        onClick={logout}
        className="bg-red-500 px-3 py-1 rounded"
      >
        Logout
      </button>
    </nav>
  )
}