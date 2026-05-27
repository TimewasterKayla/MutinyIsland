'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  username: string
  about_me: string | null
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [usernameParam, setUsernameParam] =
    useState<string>('')

  const [profile, setProfile] =
    useState<Profile | null>(null)

  const [aboutMe, setAboutMe] =
    useState('')

  const [isOwnProfile, setIsOwnProfile] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  // -----------------------------
  // GET PARAMS
  // -----------------------------
  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setUsernameParam(p.id)
    })
  }, [params])

  // -----------------------------
  // LOAD PROFILE
  // -----------------------------
  useEffect(() => {
    if (!usernameParam) return

    loadProfile()
  }, [usernameParam])

  async function loadProfile() {
    setLoading(true)

    // get profile by username
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', usernameParam)
      .maybeSingle()

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    if (!data) {
      setLoading(false)
      return
    }

    setProfile(data)
    setAboutMe(data.about_me || '')

    // check if current user owns this profile
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user && user.id === data.id) {
      setIsOwnProfile(true)
    }

    setLoading(false)
  }

  // -----------------------------
  // SAVE ABOUT ME
  // -----------------------------
  async function saveAboutMe() {
    if (!profile) return

    const { error } = await supabase
      .from('profiles')
      .update({
        about_me: aboutMe,
      })
      .eq('id', profile.id)

    if (error) {
      console.error(error)
      alert('Failed to save')
      return
    }

    alert('Profile updated!')
  }

  // -----------------------------
  // LOADING
  // -----------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading profile...
      </div>
    )
  }

  // -----------------------------
  // PROFILE NOT FOUND
  // -----------------------------
  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Profile not found
      </div>
    )
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">

      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">

        {/* LEFT COLUMN */}
        <div className="bg-zinc-900 rounded-2xl p-6 h-fit">

          {/* AVATAR PLACEHOLDER */}
          <div className="w-full aspect-square rounded-2xl bg-zinc-800 flex items-center justify-center border-2 border-dashed border-zinc-600">

            <span className="text-zinc-400 text-center">
              Avatar
              <br />
              Coming Soon
            </span>

          </div>

          {/* USERNAME */}
          <div className="mt-6 text-center">

            <h1 className="text-3xl font-bold">
              {profile.username}
            </h1>

          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-2 bg-zinc-900 rounded-2xl p-6">

          <h2 className="text-3xl font-bold mb-6">
            About Me
          </h2>

          {isOwnProfile ? (
            <>
              <textarea
                value={aboutMe}
                onChange={(e) =>
                  setAboutMe(e.target.value)
                }
                placeholder="Tell people about yourself..."
                className="w-full h-64 bg-zinc-800 rounded-xl p-4 text-white resize-none outline-none border border-zinc-700 focus:border-yellow-500"
                maxLength={1000}
              />

              <div className="flex justify-between items-center mt-3">

                <p className="text-zinc-400 text-sm">
                  {aboutMe.length}/1000
                </p>

                <button
                  onClick={saveAboutMe}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-2 rounded-xl transition"
                >
                  Save
                </button>

              </div>
            </>
          ) : (
            <div className="bg-zinc-800 rounded-xl p-4 min-h-[300px] whitespace-pre-wrap">

              {profile.about_me?.trim()
                ? profile.about_me
                : (
                  <span className="text-zinc-400 italic">
                    This player has not written anything yet.
                  </span>
                )}

            </div>
          )}

        </div>

      </div>

    </main>
  )
}