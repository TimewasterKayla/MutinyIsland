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

  const [isOwnProfile, setIsOwnProfile] =
    useState(false)

  const [editing, setEditing] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [activeTab, setActiveTab] =
    useState<'messages' | 'friends'>('messages')

  const editorRef =
    useRef<HTMLDivElement | null>(null)

  // -----------------------------
  // PARAMS
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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    setIsOwnProfile(
      !!user && user.id === data.id
    )

    setLoading(false)
  }

  // -----------------------------
  // LOAD EDIT CONTENT ON OPEN
  // -----------------------------
  useEffect(() => {
    if (editing && editorRef.current && profile) {
      editorRef.current.innerHTML =
        profile.about_me || ''
    }
  }, [editing, profile])

  // -----------------------------
  // SAVE
  // -----------------------------
  async function saveAboutMe() {
    if (!profile || !editorRef.current) return

    const html = editorRef.current.innerHTML

    const { error } = await supabase
      .from('profiles')
      .update({
        about_me: html,
      })
      .eq('id', profile.id)

    if (error) {
      console.error(error)
      alert('Failed to save')
      return
    }

    setProfile({
      ...profile,
      about_me: html,
    })

    setEditing(false)
  }

  // -----------------------------
  // RICH TEXT
  // -----------------------------
  function exec(command: string) {
    document.execCommand(command)
    editorRef.current?.focus()
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

        {/* RIGHT WRAPPER (for tab positioning) */}
        <div className="col-span-2 relative">

          {/* TAB BUTTONS (FOLDER STYLE) */}
          <div className="absolute -top-6 right-6 flex gap-2 z-10">

            <button
              onClick={() => setActiveTab('friends')}
              className={`px-4 py-2 rounded-t-lg border border-zinc-700 transition ${
                activeTab === 'friends'
                  ? 'bg-green-500 text-black font-bold'
                  : 'bg-green-200 text-black hover:bg-green-300'
              }`}
            >
              Friends
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`px-4 py-2 rounded-t-lg border border-zinc-700 transition ${
                activeTab === 'messages'
                  ? 'bg-green-500 text-black font-bold'
                  : 'bg-green-200 text-black hover:bg-green-300'
              }`}
            >
              Messages
            </button>

          </div>

          {/* RIGHT PANEL */}
          <div className="bg-zinc-900 rounded-2xl p-6 min-h-[500px]">

            {/* ABOUT SECTION ALWAYS SHOWN FOR NOW */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-4">
                About Me
              </h2>

              {!editing ? (
                <div
                  className="bg-zinc-900 rounded-xl p-4 min-h-[200px]"
                  dangerouslySetInnerHTML={{
                    __html:
                      profile.about_me?.trim() ||
                      `<span class="text-zinc-400 italic">This player has not written anything yet.</span>`,
                  }}
                />
              ) : (
                <div>

                  {/* EDITOR */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="w-full min-h-[200px] bg-zinc-800 rounded-xl p-4 text-white outline-none border border-zinc-700 focus:border-green-500"
                  />

                  {/* TOOLBAR */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() =>
                        exec('bold')
                      }
                      className="w-8 h-8 bg-zinc-700 rounded-md font-bold"
                    >
                      B
                    </button>

                    <button
                      onClick={() =>
                        exec('italic')
                      }
                      className="w-8 h-8 bg-zinc-700 rounded-md italic"
                    >
                      I
                    </button>
                  </div>

                  <div className="mt-2 text-sm text-zinc-400">
                    {
                      editorRef.current
                        ?.innerText?.length ||
                      0
                    }
                    /1000
                  </div>

                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() =>
                        setEditing(false)
                      }
                      className="bg-zinc-700 px-4 py-2 rounded-xl"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={saveAboutMe}
                      className="bg-green-500 text-black px-5 py-2 rounded-xl font-bold"
                    >
                      Save
                    </button>
                  </div>

                </div>
              )}

              {isOwnProfile && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-4 bg-green-500 text-black px-4 py-2 rounded-xl font-bold"
                >
                  Edit
                </button>
              )}
            </div>

            {/* TAB CONTENT AREA */}
            <div className="border-t border-zinc-700 pt-4">

              {activeTab === 'messages' && (
                <div className="text-zinc-300">
                  Messages tab coming soon...
                </div>
              )}

              {activeTab === 'friends' && (
                <div className="text-zinc-300">
                  Friends tab coming soon...
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

    </main>
  )
}