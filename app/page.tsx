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
  const [signupSuccess, setSignupSuccess] = useState(false)

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
    setSignupSuccess(false)
  }

  // -----------------------------
  // USERNAME VALIDATION
  // -----------------------------
  function validateUsername(name: string): string | null {
    if (name.includes(' ')) return 'Username cannot contain a space'
    if (name.length < 2) return 'Username contains too few characters'
    if (name.length > 16) return 'Username contains too many characters'
    if (!/^[a-zA-Z0-9]+$/.test(name)) return 'Username contains invalid special characters'

    const banned = ['bitch', 'fuck', 'nigga', 'nigger', 'cunt', 'pussy', 'cock']
    const lower = name.toLowerCase()
    for (const word of banned) {
      if (lower.includes(word)) return 'Username contains explicit language'
    }

    return null
  }

  // -----------------------------
  // SIGN UP → show "check your email"
  // -----------------------------
  async function signUp() {
    setLoading(true)
    setErrorMessage('')

    if (!email || !password || !username) {
      setErrorMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    const usernameError = validateUsername(username)
    if (usernameError) {
      setErrorMessage(usernameError)
      setLoading(false)
      return
    }

    // Case-insensitive duplicate username check
    const { data: existingUsers, error: lookupError } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username)

    if (lookupError) {
      setErrorMessage('Something went wrong checking username availability')
      setLoading(false)
      return
    }

    if (existingUsers && existingUsers.length > 0) {
      setErrorMessage('Username is already taken')
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

      // Show "check your email" message
      setSignupSuccess(true)
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
      console.log('login response:', data)

      if (!res.ok) {
        setErrorMessage(data.error || 'Login failed')
        setLoading(false)
        return
      }

      await supabase.auth.setSession(data.session)

      window.location.href = '/home'
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
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden">

      {/* PAGE BACKGROUND */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/loginscreen.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* SHIMMER OVERLAY */}
      <div className="ocean-bg absolute inset-0 -z-10 opacity-40" />

      {/* PARCHMENT CARD */}
      <div className="relative w-full max-w-md">

        {/* PARCHMENT IMAGE */}
        <img
          src="/parchment.png"
          alt=""
          className="absolute inset-0 w-full h-full object-fill"
        />

        {/* CONTENT ON TOP OF PARCHMENT */}
        <div className="relative z-10 flex flex-col items-center text-center px-10 py-14 space-y-6">

          <h1 className="text-4xl font-bold text-amber-900 drop-shadow-sm">
            Mutiny Island
          </h1>

          <p className="text-sm italic text-amber-800">
            Welcome aboard!
          </p>

          {/* CHECK YOUR EMAIL STATE */}
          {signupSuccess ? (
            <div className="w-full space-y-4">
              <p className="text-amber-900 font-semibold">⚓ Almost there!</p>
              <p className="text-sm text-amber-800">
                We sent a confirmation email to <strong>{email}</strong>. Click the link in the email to activate your account.
              </p>
              <button
                onClick={() => switchMode('login')}
                className="w-full bg-amber-800 hover:bg-amber-900 text-amber-50 p-3 rounded font-bold active:scale-95 transition"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <div className="w-full space-y-4">

              {/* EMAIL — signup only */}
              {mode === 'signup' && (
                <input
                  className="w-full p-3 rounded bg-amber-50/80 border border-amber-800/30 text-amber-900 placeholder-amber-700/60 outline-none focus:ring-2 focus:ring-amber-700/40"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}

              <input
                className="w-full p-3 rounded bg-amber-50/80 border border-amber-800/30 text-amber-900 placeholder-amber-700/60 outline-none focus:ring-2 focus:ring-amber-700/40"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <input
                className="w-full p-3 rounded bg-amber-50/80 border border-amber-800/30 text-amber-900 placeholder-amber-700/60 outline-none focus:ring-2 focus:ring-amber-700/40"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {errorMessage && (
                <p className="text-red-700 italic text-sm">{errorMessage}</p>
              )}

              {mode === 'login' ? (
                <>
                  <p
                    onClick={() => switchMode('signup')}
                    className="text-sm text-amber-800 hover:text-amber-950 transition cursor-pointer underline underline-offset-2"
                  >
                    Click here to sign up
                  </p>

                  <button
                    onClick={login}
                    disabled={loading}
                    className="w-full bg-amber-800 hover:bg-amber-900 text-amber-50 p-3 rounded font-bold active:scale-95 transition disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Login'}
                  </button>
                </>
              ) : (
                <>
                  <p
                    onClick={() => switchMode('login')}
                    className="text-sm text-amber-800 hover:text-amber-950 transition cursor-pointer underline underline-offset-2"
                  >
                    Back to login
                  </p>

                  <button
                    onClick={signUp}
                    disabled={loading}
                    className="w-full bg-amber-800 hover:bg-amber-900 text-amber-50 p-3 rounded font-bold active:scale-95 transition disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Sign Up'}
                  </button>
                </>
              )}

            </div>
          )}

        </div>
      </div>

    </main>
  )
}