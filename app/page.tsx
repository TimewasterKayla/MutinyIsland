'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  // NEW ERROR MESSAGE STATE
  const [errorMessage, setErrorMessage] = useState('')

  async function signUp() {
    setLoading(true)
    setErrorMessage('')

    // --------------------------------
    // CHECK IF USERNAME EXISTS
    // --------------------------------
    const { data: existingUser } = await supabase
      .from('usernames')
      .select('*')
      .eq('username', username)
      .single()

    if (existingUser) {
      setErrorMessage(
        'Another user has already claimed that username'
      )

      setLoading(false)
      return
    }

    // --------------------------------
    // CREATE AUTH ACCOUNT
    // --------------------------------
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    // --------------------------------
    // SAVE USERNAME
    // --------------------------------
    if (data.user) {
      await supabase.from('usernames').insert({
        username: username,
        user_id: data.user.id,
      })
    }

    alert('Account created! You can now log in.')
    setLoading(false)
  }

  async function login() {
    setLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/games'
  }

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative overflow-hidden">

      {/* OCEAN BACKGROUND */}
      <div className="ocean-bg" />

      {/* FLOATING BOTTLES */}
      <div className="bottle b1">🍾</div>
      <div className="bottle b2">🍾</div>
      <div className="bottle b3">🍾</div>

      {/* LOGIN CONTENT */}
      <div className="w-full max-w-md space-y-6 text-center relative z-10">

        {/* TITLE */}
        <div>
          <h1 className="text-4xl font-bold">
            Mutiny Island
          </h1>

          <p className="text-sm italic text-zinc-300 mt-2">
            Welcome aboard!
          </p>
        </div>

        {/* FORM */}
        <div className="bg-zinc-900/80 backdrop-blur-md p-6 rounded-2xl space-y-4">

          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* RED ERROR MESSAGE */}
          {errorMessage && (
            <p className="text-red-400 italic text-sm">
              {errorMessage}
            </p>
          )}

          <button
            onClick={signUp}
            disabled={loading}
            className="w-full bg-yellow-500 text-black p-3 rounded font-bold hover:bg-yellow-400 cursor-pointer active:scale-95 transition"
          >
            Sign Up
          </button>

          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-white text-black p-3 rounded font-bold hover:bg-gray-200 cursor-pointer active:scale-95 transition"
          >
            Login
          </button>

        </div>
      </div>
    </main>
  )
}