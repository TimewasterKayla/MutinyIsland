'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  async function signUp() {
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert([
        {
          id: data.user.id,
          username: username,
        },
      ])
    }

    alert('Account created successfully')
    setLoading(false)
  }

  async function login() {
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/games'
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-4">
        <h1 className="text-3xl font-bold text-center">
          Survivor Simulator
        </h1>

        <input
          className="w-full p-3 rounded bg-zinc-800"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="w-full p-3 rounded bg-zinc-800"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full p-3 rounded bg-zinc-800"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-yellow-500 text-black p-3 rounded font-bold"
          onClick={signUp}
          disabled={loading}
        >
          Sign Up
        </button>

        <button
          className="w-full bg-white text-black p-3 rounded font-bold"
          onClick={login}
          disabled={loading}
        >
          Login
        </button>
      </div>
    </main>
  )
}