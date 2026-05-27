'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  username: string
  about_me: string | null
  avatar: string | null
}

const avatars = [
  '/avatars/jess.png',
  '/avatars/laffite.png',
  '/avatars/malley.png',
  '/avatars/morgan.png',
  '/avatars/read.png',
]

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

  const [showAvatarEditor, setShowAvatarEditor] =
    useState(false)

  const [activeTab, setActiveTab] =
    useState<
      'about' | 'messages' | 'friends' | 'wins'
    >('about')

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

    // Assign random avatar if none exists
    if (!data.avatar) {
      const randomAvatar =
        avatars[
          Math.floor(
            Math.random() * avatars.length
          )
        ]

      await supabase
        .from('profiles')
        .update({
          avatar: randomAvatar,
        })
        .eq('id', data.id)

      data.avatar = randomAvatar
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
  // LOAD EDIT CONTENT
  // -----------------------------
  useEffect(() => {
    if (editing && editorRef.current && profile) {
      editorRef.current.innerHTML =
        profile.about_me || ''
    }
  }, [editing, profile])

  // -----------------------------
  // SAVE ABOUT ME
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
  // CHANGE AVATAR
  // -----------------------------
  async function changeAvatar(
    avatar: string
  ) {
    if (!profile) return

    const { error } = await supabase
      .from('profiles')
      .update({
        avatar,
      })
      .eq('id', profile.id)

    if (error) {
      console.error(error)
      return
    }

    setProfile({
      ...profile,
      avatar,
    })

    setShowAvatarEditor(false)
  }

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
    <main className="min-h-screen bg-zinc-950 text-white p-6 pt-16">

      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">

        {/* LEFT */}
        <div className="bg-zinc-900 rounded-2xl p-6 h-fit">

          {/* AVATAR */}
          <div className="relative">

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700">

              <Image
                src={
                  profile.avatar ||
                  '/avatars/jess.png'
                }
                alt="Avatar"
                width={500}
                height={500}
                className="w-full h-full object-cover"
              />

            </div>

            {/* EDIT AVATAR BUTTON */}
            {isOwnProfile && (
              <button
                onClick={() =>
                  setShowAvatarEditor(true)
                }
                className="absolute bottom-3 right-3 bg-orange-500 hover:bg-orange-600 transition text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg"
              >
                Edit
              </button>
            )}

          </div>

          {/* USERNAME */}
          <div className="mt-6 text-center">
            <h1 className="text-3xl font-bold">
              {profile.username}
            </h1>
          </div>

        </div>

        {/* RIGHT WRAPPER */}
        <div className="col-span-2 relative">

          {/* TAB BAR */}
          <div className="absolute -top-7 right-6 flex gap-1 z-10">

            {[
              'about',
              'messages',
              'friends',
              'wins',
            ].map((tab) => (
              <button
                key={tab}
                onClick={() =>
                  setActiveTab(tab as any)
                }
                className={`px-3 py-1 text-xs rounded-t-md border border-zinc-700 transition capitalize ${
                  activeTab === tab
                    ? 'bg-green-500 text-black font-bold'
                    : 'bg-green-200 text-black hover:bg-green-300'
                }`}
              >
                {tab === 'about'
                  ? 'About Me'
                  : tab}
              </button>
            ))}

          </div>

          {/* RIGHT PANEL */}
          <div className="bg-zinc-900 rounded-2xl p-6 min-h-[550px]">

            {/* ABOUT TAB */}
            {activeTab === 'about' && (
              <div>

                <div className="flex items-center justify-between mb-4">

                  <h2 className="text-3xl font-bold">
                    About Me
                  </h2>

                  {isOwnProfile &&
                    !editing && (
                      <button
                        onClick={() =>
                          setEditing(true)
                        }
                        className="bg-green-500 text-black px-4 py-2 rounded-xl font-bold"
                      >
                        Edit
                      </button>
                    )}

                </div>

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

                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="w-full min-h-[200px] bg-zinc-800 rounded-xl p-4 outline-none border border-zinc-700"
                    />

                    {/* FORMAT BUTTONS */}
                    <div className="flex gap-2 mt-2">

                      <button
                        onClick={() =>
                          exec('bold')
                        }
                        className="w-7 h-7 bg-zinc-700 rounded text-xs font-bold"
                      >
                        B
                      </button>

                      <button
                        onClick={() =>
                          exec('italic')
                        }
                        className="w-7 h-7 bg-zinc-700 rounded text-xs italic"
                      >
                        I
                      </button>

                    </div>

                    {/* CHARACTER COUNT */}
                    <div className="mt-2 text-xs text-zinc-400">
                      {
                        editorRef.current
                          ?.innerText
                          ?.length || 0
                      }
                      /1000
                    </div>

                    {/* ACTIONS */}
                    <div className="flex justify-end gap-2 mt-3">

                      <button
                        onClick={() =>
                          setEditing(false)
                        }
                        className="bg-zinc-700 px-3 py-1 rounded-lg"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={saveAboutMe}
                        className="bg-green-500 text-black px-4 py-1 rounded-lg font-bold"
                      >
                        Save
                      </button>

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* OTHER TABS */}
            {activeTab === 'messages' && (
              <div className="text-zinc-400">
                Messages coming soon...
              </div>
            )}

            {activeTab === 'friends' && (
              <div className="text-zinc-400">
                Friends coming soon...
              </div>
            )}

            {activeTab === 'wins' && (
              <div className="text-zinc-400">
                Wins coming soon...
              </div>
            )}

          </div>

        </div>

      </div>

            {/* AVATAR POPUP */}
      {showAvatarEditor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">

            <h2 className="text-2xl font-bold mb-4">
              Select Avatar
            </h2>

            <div className="grid grid-cols-3 gap-4">
              {avatars.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => changeAvatar(avatar)}
                  className="bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 hover:border-orange-400 transition"
                >
                  <Image
                    src={avatar}
                    alt="Avatar"
                    width={120}
                    height={120}
                    className="w-full aspect-square object-cover"
                  />
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAvatarEditor(false)}
              className="mt-5 w-full bg-zinc-700 hover:bg-zinc-600 transition rounded-xl py-2"
            >
              Close
            </button>

          </div>

        </div>
      )}

    </main>
  )
}