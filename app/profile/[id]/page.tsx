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
  const [usernameParam, setUsernameParam] = useState<string>('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAvatarEditor, setShowAvatarEditor] = useState(false)

  // =========================
  // IMAGE FEATURE STATE (NEW)
  // =========================
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [editingImageEl, setEditingImageEl] = useState<HTMLImageElement | null>(null)

  const [activeTab, setActiveTab] =
    useState<'about' | 'messages' | 'friends' | 'wins' | 'inventory'>('about')

  const editorRef = useRef<HTMLDivElement | null>(null)

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
  // FORMAT COMMANDS
  // -----------------------------
  function exec(command: string) {
    document.execCommand(command)
    editorRef.current?.focus()
  }

  // =====================================================
  // IMAGE INSERT + EDIT SYSTEM (NEW, SAFE ADDITION)
  // =====================================================

  function insertImage(url: string) {
    if (!editorRef.current) return

    const img = document.createElement('img')
    img.src = url
    img.className = 'max-w-full rounded-lg my-2'
    img.style.cursor = 'pointer'

    img.oncontextmenu = (e) => {
      e.preventDefault()
      setImageUrl(url)
      setEditingImageEl(img)
      setShowImageModal(true)
    }

    editorRef.current.appendChild(img)
  }

  function openImageModalForNew() {
    setImageUrl('')
    setEditingImageEl(null)
    setShowImageModal(true)
  }

  function confirmImageInsert() {
    if (!imageUrl.trim()) return

    if (editingImageEl) {
      editingImageEl.src = imageUrl
    } else {
      insertImage(imageUrl)
    }

    setImageUrl('')
    setEditingImageEl(null)
    setShowImageModal(false)
  }

  // -----------------------------
  // LOADING STATES
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

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 pt-16">

      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">

        {/* LEFT (UNCHANGED) */}
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
                className="absolute bottom-3 right-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-lg"
              >
                Edit
              </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-3xl font-bold">{profile.username}</h1>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-2 relative">

          {/* TAB BAR */}
          <div className="absolute -top-7 right-6 flex gap-1 z-10">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3 py-1 text-xs rounded-t-md border border-zinc-700 ${
                  activeTab === tab
                    ? 'bg-green-500 text-black font-bold'
                    : 'bg-green-200 text-black'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* PANEL */}
          <div className="bg-zinc-900 rounded-2xl p-6 min-h-[550px]">

            {activeTab === 'about' && (
              <div>

                <div className="flex justify-between mb-4">
                  <h2 className="text-3xl font-bold">About Me</h2>

                  {isOwnProfile && !editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="bg-green-500 text-black px-4 py-2 rounded-xl font-bold"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {!editing ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html:
                        profile.about_me ||
                        `<span class="text-zinc-400 italic">Nothing here yet</span>`,
                    }}
                  />
                ) : (
                  <div>

                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="min-h-[200px] bg-zinc-800 p-4 rounded-xl outline-none"
                    />

                    {/* TOOLBAR */}
                    <div className="flex gap-2 mt-2">

                      <button onClick={() => exec('bold')} className="w-7 h-7 bg-zinc-700 rounded font-bold">
                        B
                      </button>

                      <button onClick={() => exec('italic')} className="w-7 h-7 bg-zinc-700 rounded italic">
                        I
                      </button>

                      {/* IMAGE BUTTON */}
                      <button
                        onClick={openImageModalForNew}
                        className="w-7 h-7 bg-zinc-700 rounded flex items-center justify-center"
                      >
                        <Image src="/picture.png" alt="img" width={16} height={16} />
                      </button>

                    </div>

                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setEditing(false)} className="bg-zinc-700 px-3 py-1 rounded">
                        Cancel
                      </button>

                      <button onClick={saveAboutMe} className="bg-green-500 text-black px-4 py-1 rounded font-bold">
                        Save
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* OTHER TABS (UNCHANGED) */}
            {activeTab === 'friends' && <div><h2 className="text-3xl">Friends</h2></div>}
            {activeTab === 'wins' && <div><h2 className="text-3xl">Wins</h2></div>}
            {activeTab === 'messages' && <div><h2 className="text-3xl">Messages</h2></div>}
            {activeTab === 'inventory' && <div><h2 className="text-3xl">Inventory</h2></div>}

          </div>
        </div>
      </div>

      {/* IMAGE MODAL */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-[400px]">

            <h2 className="text-xl font-bold mb-4">
              {editingImageEl ? 'Edit Image' : 'Insert Image'}
            </h2>

            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2 rounded bg-zinc-800 mb-4"
              placeholder="https://..."
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImageModal(false)}
                className="bg-zinc-700 px-3 py-1 rounded"
              >
                Cancel
              </button>

              <button
                onClick={confirmImageInsert}
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