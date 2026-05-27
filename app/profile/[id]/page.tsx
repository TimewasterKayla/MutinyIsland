'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  username: string
  about_me: string | null
  avatar: string | null
  coins: number | null
  crowns: number | null
  rank: string | null
  created_at: string | null
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
      'about' | 'messages' | 'friends' | 'wins' | 'inventory'
    >('about')

  const editorRef =
    useRef<HTMLDivElement | null>(null)

  // ✅ IMAGE TOOL STATE (ADDED)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [editImageEl, setEditImageEl] = useState<HTMLImageElement | null>(null)

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

    // assign avatar if missing
    if (!data.avatar) {
      const randomAvatar =
        avatars[Math.floor(Math.random() * avatars.length)]

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

    const own = !!user && user.id === data.id

    setIsOwnProfile(own)

    setActiveTab((prev) => {
      if (!own && (prev === 'messages' || prev === 'inventory')) {
        return 'about'
      }
      return prev
    })

    setLoading(false)
  }

  // -----------------------------
  // LOAD EDIT CONTENT
  // -----------------------------
  useEffect(() => {
    if (editing && editorRef.current && profile) {
      editorRef.current.innerHTML = profile.about_me || ''
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
  async function changeAvatar(avatar: string) {
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

  // -----------------------------
  // RICH TEXT
  // -----------------------------
  function exec(command: string) {
    document.execCommand(command)
    editorRef.current?.focus()
  }

  // ✅ IMAGE INSERT FUNCTION (ADDED)
  function insertImage(url: string) {
    if (!editorRef.current) return

    const img = document.createElement('img')
    img.src = url
    img.style.maxWidth = '100%'
    img.style.borderRadius = '12px'
    img.style.margin = '10px 0'

    img.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      setEditImageEl(img)
      setImageUrl(img.src)
      setShowImageModal(true)
    })

    editorRef.current.appendChild(img)

    setShowImageModal(false)
    setImageUrl('')
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

  const tabs = isOwnProfile
    ? ['about', 'messages', 'friends', 'wins', 'inventory']
    : ['about', 'friends', 'wins']

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 pt-16">

      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">

        {/* LEFT */}
        <div className="bg-zinc-900 rounded-2xl p-6 h-fit">

          <div className="relative">
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700">

              <Image
                src={profile.avatar || '/avatars/jess.png'}
                alt="Avatar"
                width={500}
                height={500}
                className="w-full h-full object-cover"
              />

            </div>

            {isOwnProfile && (
              <button
                onClick={() => setShowAvatarEditor(true)}
                className="absolute bottom-3 right-3 bg-orange-500 hover:bg-orange-600 transition text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-3xl font-bold">
              {profile.username}
            </h1>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Rank:</span>{' '}
              <span className="font-semibold text-white">
                {profile.rank || 'Peasant'}
              </span>
            </div>

            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Doubloons:</span>{' '}
              <span className="font-semibold text-yellow-400">
                {profile.coins || 0}
              </span>
            </div>

            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Crowns:</span>{' '}
              <span className="font-semibold text-amber-300">
                {profile.crowns || 0}
              </span>
            </div>

            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Date Joined:</span>{' '}
              <span className="font-semibold text-white">
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: '2-digit',
                      day: '2-digit',
                      year: 'numeric',
                    })
                  : 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-2 relative">

          <div className="absolute -top-7 right-6 flex gap-1 z-10">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3 py-1 text-xs rounded-t-md border border-zinc-700 transition capitalize cursor-pointer ${
                  activeTab === tab
                    ? 'bg-green-500 text-black font-bold'
                    : 'bg-green-200 text-black hover:bg-green-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 min-h-[550px]">

            {activeTab === 'about' && (
              <div>

                <div className="flex items-center justify-between mb-4 pl-4">
                  <h2 className="text-3xl font-bold">About Me</h2>

                  {isOwnProfile && !editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="bg-green-500 text-black px-4 py-2 rounded-xl font-bold cursor-pointer"
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

                    <div className="flex gap-2 mt-2">

                      {/* IMAGE BUTTON (ADDED) */}
                      <button
                        onClick={() => setShowImageModal(true)}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                      >
                        <Image
                          src="/picture.png"
                          alt="img"
                          width={14}
                          height={14}
                        />
                      </button>

                      <button
                        onClick={() => exec('bold')}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold"
                      >
                        B
                      </button>

                      <button
                        onClick={() => exec('italic')}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic"
                      >
                        I
                      </button>

                    </div>

                    <div className="mt-2 text-xs text-zinc-400">
                      {editorRef.current?.innerText?.length || 0}/1000
                    </div>

                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => setEditing(false)}
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

            {activeTab === 'messages' && isOwnProfile && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Messages</h2>
                <div className="text-zinc-400">Messages coming soon...</div>
              </div>
            )}

            {activeTab === 'friends' && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Friends</h2>
                <div className="text-zinc-400">Friends coming soon...</div>
              </div>
            )}

            {activeTab === 'wins' && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Wins</h2>
                <div className="text-zinc-400">Wins coming soon...</div>
              </div>
            )}

            {activeTab === 'inventory' && isOwnProfile && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Inventory</h2>
                <div className="text-zinc-400">Inventory coming soon...</div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* (your existing avatar modal unchanged) */}

      {/* IMAGE MODAL (ADDED) */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">

            <h2 className="text-2xl font-bold mb-4">
              Insert Image
            </h2>

            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL"
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
            />

            <div className="flex justify-end gap-2 mt-4">

              <button
                onClick={() => {
                  setShowImageModal(false)
                  setImageUrl('')
                }}
                className="bg-zinc-700 px-3 py-1 rounded"
              >
                Cancel
              </button>

              <button
                onClick={() => insertImage(imageUrl)}
                className="bg-green-500 text-black px-4 py-1 rounded font-bold"
              >
                Insert
              </button>

            </div>

          </div>
        </div>
      )}

    </main>
  )
}