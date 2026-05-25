'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // --------------------------------
  // SIGN UP
  // --------------------------------
  async function signUp() {
    setLoading(true)
    setErrorMessage('')

    // --------------------------------
    // 1. CHECK IF USERNAME EXISTS
    // BEFORE CREATING AUTH USER
    // --------------------------------
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (existingUser) {
      setErrorMessage(
        'Another user has already claimed that username'
      )

      setLoading(false)
      return
    }

    // --------------------------------
    // 2. CREATE AUTH USER
    // --------------------------------
    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
      })

    if (error || !data.user) {
      setErrorMessage(
        error?.message || 'Signup failed'
      )

      setLoading(false)
      return
    }

    // --------------------------------
    // 3. CREATE PROFILE
    // --------------------------------
    const { error: profileError } =
      await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: username,
          coins: 0,
        })

    if (profileError) {
      setErrorMessage(profileError.message)

      setLoading(false)
      return
    }

    alert('Account created successfully!')

    setLoading(false)
  }

  // --------------------------------
  // LOGIN
  // --------------------------------
  async function login() {
    setLoading(true)
    setErrorMessage('')

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      setErrorMessage(error.message)

      setLoading(false)
      return
    }

    window.location.href = '/games'
  }

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative overflow-hidden">

      {/* OCEAN BACKGROUND */}
      <div className="ocean-bg" />

      {/* FLOATING DECOR */}
      <div className="bottle b1">🍾</div>
      <div className="bottle b2">🍾</div>
      <div className="bottle b3">🍾</div>

      {/* LOGIN CARD */}
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

          {/* EMAIL */}
          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          {/* USERNAME */}
          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Username"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
          />

          {/* PASSWORD */}
          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          {/* ERROR */}
          {errorMessage && (
            <p className="text-red-400 italic text-sm">
              {errorMessage}
            </p>
          )}

          {/* SIGN UP */}
          <button
            onClick={signUp}
            disabled={loading}
            className="w-full bg-yellow-500 text-black p-3 rounded font-bold hover:bg-yellow-400 cursor-pointer active:scale-95 transition"
          >
            Sign Up
          </button>

          {/* LOGIN */}
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