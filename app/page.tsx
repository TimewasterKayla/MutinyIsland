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
  // SIGN UP (EDGE FUNCTION VERSION)
  // -----------------------------
  async function signUp() {
    setLoading(true)
    setErrorMessage('')

    if (!email || !password || !username) {
      setErrorMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email,
            password,
            username,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      alert('Account created successfully!')
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong')
    }

    setLoading(false)
  }

  // -----------------------------
  // LOGIN
  // -----------------------------
  async function login() {
    setLoading(true)
    setErrorMessage('')

    if (!email || !password || !username) {
      setErrorMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    // ---------------------------------
    // SIGN IN WITH EMAIL/PASSWORD
    // ---------------------------------
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      setErrorMessage('Invalid email or password')
      setLoading(false)
      return
    }

    // ---------------------------------
    // FETCH PROFILE
    // ---------------------------------
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, coins')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()

      setErrorMessage('Profile not found')
      setLoading(false)
      return
    }

    // ---------------------------------
    // VERIFY USERNAME MATCH
    // ---------------------------------
    if (
      profile.username.toLowerCase() !==
      username.toLowerCase()
    ) {
      await supabase.auth.signOut()

      setErrorMessage('Incorrect username')
      setLoading(false)
      return
    }

    // ---------------------------------
    // SUCCESS
    // ---------------------------------
    window.location.href = '/games'
  }

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative overflow-hidden">

      {/* background */}
      <div className="ocean-bg" />

      <div className="w-full max-w-md space-y-6 text-center relative z-10">

        <h1 className="text-4xl font-bold">Mutiny Island</h1>

        <p className="text-sm italic text-zinc-300">
          Welcome aboard!
        </p>

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
            className="w-full bg-yellow-500 text-black p-3 rounded font-bold hover:bg-yellow-400 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Sign Up'}
          </button>

          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-white text-black p-3 rounded font-bold hover:bg-gray-200 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>

        </div>
      </div>
    </main>
  )
}