'use client'

import { useEffect, useState, useRef } from 'react'
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

  const [editing, setEditing] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setUsernameParam(p.id)
    })
  }, [params])

  useEffect(() => {
    if (!usernameParam) return
    loadProfile()
  }, [usernameParam])

  async function loadProfile() {
    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', usernameParam)
      .maybeSingle()

    if (error || !data) {
      console.error(error)
      setLoading(false)
      return
    }

    setProfile(data)
    setAboutMe(data.about_me || '')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    setIsOwnProfile(
      !!user && user.id === data.id
    )

    setLoading(false)
  }

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

    setProfile({
      ...profile,
      about_me: aboutMe,
    })

    setEditing(false)
  }

  // -----------------------------
  // FORMATTING (stored markdown -> rendered HTML)
  // -----------------------------
  function formatText(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
  }

  function wrapSelection(before: string, after: string) {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = aboutMe.substring(start, end)

    const newText =
      aboutMe.substring(0, start) +
      before +
      selected +
      after +
      aboutMe.substring(end)

    setAboutMe(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = start + before.length
      textarea.selectionEnd = end + before.length
    }, 0)
  }

  function makeBold() {
    wrapSelection('**', '**')
  }

  function makeItalic() {
    wrapSelection('_', '_')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading profile...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Profile not found
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">

      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">

        {/* LEFT */}
        <div className="bg-zinc-900 rounded-2xl p-6 h-fit">

          <div className="w-full aspect-square rounded-2xl bg-zinc-800 flex items-center justify-center border-2 border-dashed border-zinc-600">
            <span className="text-zinc-400 text-center">
              Avatar
              <br />
              Coming Soon
            </span>
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-3xl font-bold">
              {profile.username}
            </h1>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-2 bg-zinc-900 rounded-2xl p-6">

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">
              About Me
            </h2>

            {isOwnProfile && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-500 transition"
              >
                Edit
              </button>
            )}
          </div>

          {/* VIEW MODE (REAL RICH TEXT RENDERING) */}
          {!editing ? (
            <div
              className="bg-zinc-900 rounded-xl p-4 min-h-[300px]"
              dangerouslySetInnerHTML={{
                __html: profile.about_me?.trim()
                  ? formatText(profile.about_me)
                  : `<span class="text-zinc-400 italic">This player has not written anything yet.</span>`
              }}
            />
          ) : (
            /* EDIT MODE */
            <div className="relative">

              <textarea
                ref={textareaRef}
                value={aboutMe}
                onChange={(e) =>
                  setAboutMe(e.target.value)
                }
                className="w-full h-64 bg-zinc-800 rounded-xl p-4 text-white resize-none outline-none border border-zinc-700 focus:border-green-500"
                maxLength={1000}
              />

              {/* FORMAT BUTTONS */}
              <div className="absolute bottom-3 left-3 flex gap-2">
                <button
                  onClick={makeBold}
                  className="w-8 h-8 bg-zinc-700 rounded-md flex items-center justify-center font-bold text-white hover:bg-zinc-600 transition"
                >
                  B
                </button>

                <button
                  onClick={makeItalic}
                  className="w-8 h-8 bg-zinc-700 rounded-md flex items-center justify-center italic text-white hover:bg-zinc-600 transition"
                >
                  I
                </button>
              </div>

              {/* COUNTER MOVED BELOW BUTTONS */}
              <div className="mt-3 ml-1 text-zinc-400 text-sm">
                {aboutMe.length}/1000
              </div>

              {/* ACTIONS */}
              <div className="flex justify-between items-center mt-2">
                <div />

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false)
                      setAboutMe(
                        profile.about_me || ''
                      )
                    }}
                    className="bg-zinc-700 text-white px-4 py-2 rounded-xl"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveAboutMe}
                    className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-green-500 transition"
                  >
                    Save
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </main>
  )
}