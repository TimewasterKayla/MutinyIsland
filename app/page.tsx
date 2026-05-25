'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // -----------------------------
  // SIGN UP (ONLY PROFILES)
  // -----------------------------
  async function signUp() {
    setLoading(true)
    setErrorMessage('')

    if (!email || !password || !username) {
      setErrorMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    // 1. Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error || !data.user) {
      setErrorMessage(error?.message || 'Signup failed')
      setLoading(false)
      return
    }

    // 2. IMPORTANT: ONLY INSERT INTO profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        username,
        email,
        coins: 0,
      })

    if (profileError) {
      console.log(profileError)

      setErrorMessage(
        profileError.message.includes('duplicate')
          ? 'Username or email already taken'
          : profileError.message
      )

      setLoading(false)
      return
    }

    alert('Account created successfully!')
    setLoading(false)
  }

  // -----------------------------
  // LOGIN (NO PROFILES INSERT EVER)
  // -----------------------------
  async function login() {
    setLoading(true)
    setErrorMessage('')

    if (!email || !password || !username) {
      setErrorMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    // 1. VERIFY USERNAME + EMAIL MATCH
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('username', username)
      .eq('email', email)
      .single()

    if (error || !profile) {
      setErrorMessage('Invalid username or email')
      setLoading(false)
      return
    }

    // 2. AUTH LOGIN ONLY
    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (loginError) {
      setErrorMessage('Incorrect password')
      setLoading(false)
      return
    }

    window.location.href = '/games'
  }

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative overflow-hidden">

      <div className="ocean-bg" />

      <div className="w-full max-w-md space-y-6 text-center relative z-10">

        <h1 className="text-4xl font-bold">Mutiny Island</h1>
        <p className="text-sm italic text-zinc-300">Welcome aboard!</p>

        <div className="bg-zinc-900/80 backdrop-blur-md p-6 rounded-2xl space-y-4">

          <input
            className="w-full p-3 rounded bg-zinc-800"
            placeholder="Email"
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