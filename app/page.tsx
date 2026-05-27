'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  // -----------------------------
  // AUTO REDIRECT IF LOGGED IN
  // -----------------------------
  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()

      if (data.user) {
        router.replace('/home')
        return
      }

      setCheckingAuth(false)
    }

    checkUser()
  }, [router])

  // -----------------------------
  // SWITCH MODE
  // -----------------------------
  function switchMode(to: 'login' | 'signup') {
    setMode(to)
    setErrorMessage('')
    setEmail('')
    setPassword('')
    setUsername('')
  }

  // -----------------------------
  // SIGN UP → then auto-login
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
          body: JSON.stringify({ email, password, username }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      // Auto-login after successful signup
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (signInError || !signInData.user) {
        setErrorMessage('Account created! Please log in.')
        switchMode('login')
        setLoading(false)
        return
      }

      window.location.href = '/home'
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong')
    }

    setLoading(false)
  }

  // -----------------------------
  // LOGIN (username + password only, via edge function)
  // -----------------------------
  async function login() {
    setLoading(true)
    setErrorMessage('')

    if (!password || !username) {
      setErrorMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ username, password }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Login failed')
        setLoading(false)
        return
      }

      await supabase.auth.setSession(data.session)

      window.location.href = '/games'
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong')
    }

    setLoading(false)
  }

  // -----------------------------
  // LOADING GATE
  // -----------------------------
  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white bg-black">
        <p className="opacity-70">Checking session...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative overflow-hidden">

      {/* BACKGROUND */}
      <div className="ocean-bg" />

      <div className="w-full max-w-md space-y-6 text-center relative z-10">

        <h1 className="text-4xl font-bold">Mutiny Island</h1>

        <p className="text-sm italic text-zinc-300">Welcome aboard!</p>

        <div className="bg-zinc-900/80 backdrop-blur-md p-6 rounded-2xl space-y-4">

          {/* EMAIL — signup only */}
          {mode === 'signup' && (
            <input
              className="w-full p-3 rounded bg-zinc-800"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

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
            <p className="text-red-400 italic text-sm">{errorMessage}</p>
          )}

          {mode === 'login' ? (
            <>
              <p
                onClick={() => switchMode('signup')}
                className="text-sm text-zinc-400 hover:text-white transition cursor-pointer underline underline-offset-2"
              >
                Click here to sign up
              </p>

              <button
                onClick={login}
                disabled={loading}
                className="w-full bg-white text-black p-3 rounded font-bold hover:bg-gray-200 active:scale-95 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Login'}
              </button>
            </>
          ) : (
            <>
              <p
                onClick={() => switchMode('login')}
                className="text-sm text-zinc-400 hover:text-white transition cursor-pointer underline underline-offset-2"
              >
                Back to login
              </p>

              <button
                onClick={signUp}
                disabled={loading}
                className="w-full bg-yellow-500 text-black p-3 rounded font-bold hover:bg-yellow-400 active:scale-95 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Sign Up'}
              </button>
            </>
          )}

        </div>
      </div>
    </main>
  )
}