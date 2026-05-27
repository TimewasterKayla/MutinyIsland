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

type TabType = 'about' | 'messages' | 'friends' | 'wins' | 'inventory'

const avatars = [
  '/avatars/jess.png',
  '/avatars/laffite.png',
  '/avatars/malley.png',
  '/avatars/morgan.png',
  '/avatars/read.png',
]

// -----------------------------
// YOUTUBE HELPERS
// -----------------------------
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function buildEmbedUrl(videoId: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    rel: '0',
    ...(autoplay ? { autoplay: '1', mute: '1' } : {}),
  })
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

// Build a wrapper div string that holds the iframe — stored in innerHTML
function buildYouTubeHTML(
  videoId: string,
  embedUrl: string,
  width: string,
  alignment: 'left' | 'center' | 'right',
  autoplay: boolean
): string {
  const marginMap = {
    left: 'margin: 10px auto 10px 0;',
    center: 'margin: 10px auto;',
    right: 'margin: 10px 0 10px auto;',
  }
  return `<div
    data-yt-wrapper="1"
    data-video-id="${videoId}"
    data-autoplay="${autoplay}"
    style="display:block; width:${width}; max-width:${width}; ${marginMap[alignment]}"
  ><div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px;"><iframe
    src="${embedUrl}"
    style="position:absolute; top:0; left:0; width:100%; height:100%; border:0; border-radius:12px;"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe></div></div>`
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [usernameParam, setUsernameParam] = useState<string>('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false)
  const [editing, setEditing] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [showAvatarEditor, setShowAvatarEditor] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<TabType>('about')

  // Image modal state
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageSize, setImageSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [editImageEl, setEditImageEl] = useState<HTMLImageElement | null>(null)

  // YouTube modal state
  const [showYouTubeModal, setShowYouTubeModal] = useState<boolean>(false)
  const [youtubeUrl, setYoutubeUrl] = useState<string>('')
  const [youtubeSize, setYoutubeSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [youtubeAlignment, setYoutubeAlignment] = useState<'left' | 'center' | 'right'>('center')
  const [youtubeAutoplay, setYoutubeAutoplay] = useState<boolean>(false)
  const [editYouTubeWrapper, setEditYouTubeWrapper] = useState<HTMLElement | null>(null)

  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null)
  const [charCount, setCharCount] = useState<number>(0)
  const [deleteBtn, setDeleteBtn] = useState<{ x: number; y: number; img: HTMLImageElement } | null>(null)

  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const deleteBtnImgRef = useRef<HTMLImageElement | null>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)

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

    if (!data.avatar) {
      const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)]
      await supabase.from('profiles').update({ avatar: randomAvatar }).eq('id', data.id)
      data.avatar = randomAvatar
    }

    setProfile(data)

    const { data: { user } } = await supabase.auth.getUser()
    const own = !!user && user.id === data.id
    setIsOwnProfile(own)

    setActiveTab((prev: TabType) => {
      if (!own && (prev === 'messages' || prev === 'inventory')) return 'about'
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
      setCharCount(editorRef.current.innerText.length)
      attachImageListeners()
      attachYouTubeListeners()
      startMutationObserver()
    }
    if (!editing) {
      mutationObserverRef.current?.disconnect()
      mutationObserverRef.current = null
    }
  }, [editing, profile])

  // -----------------------------
  // MUTATION OBSERVER
  // -----------------------------
  function startMutationObserver() {
    if (!editorRef.current) return
    mutationObserverRef.current?.disconnect()

    const observer = new MutationObserver(() => {
      if (!deleteBtnImgRef.current) return
      if (!editorRef.current?.contains(deleteBtnImgRef.current)) {
        deleteBtnImgRef.current = null
        setDeleteBtn(null)
      }
    })

    observer.observe(editorRef.current, { childList: true, subtree: true })
    mutationObserverRef.current = observer
  }

  // -----------------------------
  // SCROLL: keep delete btn in sync
  // -----------------------------
  useEffect(() => {
    if (!editing) return
    function handleScroll() {
      if (!deleteBtnImgRef.current) return
      const rect = deleteBtnImgRef.current.getBoundingClientRect()
      setDeleteBtn({ x: rect.right - 36, y: rect.top + 4, img: deleteBtnImgRef.current })
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [editing])

  // -----------------------------
  // SAVE CURSOR POSITION
  // -----------------------------
  function saveCursor() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  // -----------------------------
  // ATTACH LISTENERS TO IMAGES
  // -----------------------------
  function attachImageListeners() {
    if (!editorRef.current) return
    const imgs = editorRef.current.querySelectorAll('img')
    imgs.forEach((img) => addImageListeners(img as HTMLImageElement))
  }

  function addImageListeners(img: HTMLImageElement) {
    img.style.cursor = 'pointer'

    img.onmouseenter = () => {
      const rect = img.getBoundingClientRect()
      deleteBtnImgRef.current = img
      setDeleteBtn({ x: rect.right - 36, y: rect.top + 4, img })
    }

    img.onmouseleave = (e) => {
      const related = e.relatedTarget as HTMLElement
      if (related?.id === 'img-delete-btn') return
      deleteBtnImgRef.current = null
      setDeleteBtn(null)
    }

    img.oncontextmenu = (e) => {
      e.preventDefault()
      setEditImageEl(img)
      setImageUrl(img.src)
      setShowImageModal(true)
    }

    img.onclick = () => {
      if (selectedImg && selectedImg !== img) selectedImg.style.outline = 'none'
      setSelectedImg(img)
      img.style.outline = '2px solid #22c55e'

      const range = document.createRange()
      range.selectNode(img)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
  }

  // -----------------------------
  // ATTACH LISTENERS TO YOUTUBE WRAPPERS
  // -----------------------------
  function attachYouTubeListeners() {
    if (!editorRef.current) return
    const wrappers = editorRef.current.querySelectorAll<HTMLElement>('[data-yt-wrapper="1"]')
    wrappers.forEach((wrapper) => addYouTubeListeners(wrapper))
  }

  function addYouTubeListeners(wrapper: HTMLElement) {
    wrapper.style.cursor = 'default'

    wrapper.oncontextmenu = (e) => {
      e.preventDefault()
      const videoId = wrapper.getAttribute('data-video-id') || ''
      const autoplay = wrapper.getAttribute('data-autoplay') === 'true'

      // Detect current size from wrapper width
      const currentWidth = wrapper.style.width
      let size: 'small' | 'medium' | 'large' = 'medium'
      if (currentWidth === '300px') size = 'small'
      else if (currentWidth === '560px') size = 'medium'
      else if (currentWidth === '100%') size = 'large'

      // Detect current alignment
      const marginLeft = wrapper.style.marginLeft
      const marginRight = wrapper.style.marginRight
      let alignment: 'left' | 'center' | 'right' = 'center'
      if (marginLeft === '0px' || marginLeft === '0') alignment = 'left'
      else if (marginRight === '0px' || marginRight === '0') alignment = 'right'

      setEditYouTubeWrapper(wrapper)
      setYoutubeUrl(`https://www.youtube.com/watch?v=${videoId}`)
      setYoutubeSize(size)
      setYoutubeAlignment(alignment)
      setYoutubeAutoplay(autoplay)
      setShowYouTubeModal(true)
    }
  }

  // -----------------------------
  // DESELECT IMAGE on click outside
  // -----------------------------
  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG' && selectedImg) {
      selectedImg.style.outline = 'none'
      setSelectedImg(null)
    }
    saveCursor()
  }

  // -----------------------------
  // ALIGN IMAGE
  // -----------------------------
  function alignImage(alignment: 'left' | 'center' | 'right') {
    if (!selectedImg) return
    const wrapper = selectedImg.parentElement
    if (!wrapper) return
    selectedImg.style.display = 'block'
    if (alignment === 'left') {
      selectedImg.style.marginLeft = '0'
      selectedImg.style.marginRight = 'auto'
      wrapper.style.textAlign = 'left'
    } else if (alignment === 'center') {
      selectedImg.style.marginLeft = 'auto'
      selectedImg.style.marginRight = 'auto'
      wrapper.style.textAlign = 'center'
    } else if (alignment === 'right') {
      selectedImg.style.marginLeft = 'auto'
      selectedImg.style.marginRight = '0'
      wrapper.style.textAlign = 'right'
    }
    editorRef.current?.focus()
  }

  // -----------------------------
  // EXEC (text commands only)
  // -----------------------------
  function exec(command: string, value?: string) {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  // -----------------------------
  // ALIGN HANDLER
  // -----------------------------
  function handleAlign(direction: 'left' | 'center' | 'right') {
    if (selectedImg) {
      alignImage(direction)
    } else {
      const cmdMap = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }
      exec(cmdMap[direction])
    }
  }

  // -----------------------------
  // SAVE ABOUT ME
  // -----------------------------
  async function saveAboutMe() {
    if (!profile || !editorRef.current) return

    const imgs = editorRef.current.querySelectorAll('img')
    imgs.forEach((img) => ((img as HTMLImageElement).style.outline = 'none'))

    const html = editorRef.current.innerHTML

    const { error } = await supabase
      .from('profiles')
      .update({ about_me: html })
      .eq('id', profile.id)

    if (error) {
      console.error(error)
      alert('Failed to save')
      return
    }

    setProfile({ ...profile, about_me: html })
    setSelectedImg(null)
    setEditing(false)
  }

  // -----------------------------
  // CHANGE AVATAR
  // -----------------------------
  async function changeAvatar(avatar: string) {
    if (!profile) return
    const { error } = await supabase.from('profiles').update({ avatar }).eq('id', profile.id)
    if (error) { console.error(error); return }
    setProfile({ ...profile, avatar })
    setShowAvatarEditor(false)
  }

  // -----------------------------
  // INSERT IMAGE
  // -----------------------------
  function insertImage() {
    if (!imageUrl.trim()) return
    const editor = editorRef.current
    if (!editor) return

    const widthMap = { small: '200px', medium: '400px', large: '100%' }
    const wrapper = document.createElement('div')
    wrapper.style.margin = '10px 0'

    const img = document.createElement('img')
    img.src = imageUrl.trim()
    img.style.maxWidth = widthMap[imageSize]
    img.style.width = widthMap[imageSize]
    img.style.borderRadius = '12px'
    img.style.display = 'block'

    wrapper.appendChild(img)
    addImageListeners(img)

    if (savedRangeRef.current) {
      const range = savedRangeRef.current
      range.deleteContents()
      range.insertNode(wrapper)
      const br = document.createElement('br')
      wrapper.insertAdjacentElement('afterend', br)
      const newRange = document.createRange()
      newRange.setStartAfter(br)
      newRange.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(newRange)
    } else {
      editor.appendChild(wrapper)
      const br = document.createElement('br')
      editor.appendChild(br)
    }

    editor.focus()
    setCharCount(editor.innerText.length)
    setShowImageModal(false)
    setImageUrl('')
    setImageSize('medium')
    setEditImageEl(null)
    savedRangeRef.current = null
  }

  // -----------------------------
  // INSERT / UPDATE YOUTUBE
  // -----------------------------
  function insertYouTube() {
    if (!youtubeUrl.trim()) return
    const editor = editorRef.current
    if (!editor) return

    const videoId = extractYouTubeId(youtubeUrl.trim())
    if (!videoId) {
      alert('Could not detect a YouTube video ID from that URL. Please use a standard YouTube link.')
      return
    }

    const widthMap = { small: '300px', medium: '560px', large: '100%' }
    const width = widthMap[youtubeSize]
    const embedUrl = buildEmbedUrl(videoId, youtubeAutoplay)

    // If editing an existing YouTube embed, replace it in place
    if (editYouTubeWrapper) {
      const html = buildYouTubeHTML(videoId, embedUrl, width, youtubeAlignment, youtubeAutoplay)
      const temp = document.createElement('div')
      temp.innerHTML = html
      const newWrapper = temp.firstElementChild as HTMLElement
      editYouTubeWrapper.replaceWith(newWrapper)
      addYouTubeListeners(newWrapper)
    } else {
      const html = buildYouTubeHTML(videoId, embedUrl, width, youtubeAlignment, youtubeAutoplay)
      const temp = document.createElement('div')
      temp.innerHTML = html
      const newWrapper = temp.firstElementChild as HTMLElement
      addYouTubeListeners(newWrapper)

      if (savedRangeRef.current) {
        const range = savedRangeRef.current
        range.deleteContents()
        range.insertNode(newWrapper)
        const br = document.createElement('br')
        newWrapper.insertAdjacentElement('afterend', br)
        const newRange = document.createRange()
        newRange.setStartAfter(br)
        newRange.collapse(true)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(newRange)
      } else {
        editor.appendChild(newWrapper)
        const br = document.createElement('br')
        editor.appendChild(br)
      }
    }

    editor.focus()
    setCharCount(editor.innerText.length)
    closeYouTubeModal()
  }

  function closeYouTubeModal() {
    setShowYouTubeModal(false)
    setYoutubeUrl('')
    setYoutubeSize('medium')
    setYoutubeAlignment('center')
    setYoutubeAutoplay(false)
    setEditYouTubeWrapper(null)
    savedRangeRef.current = null
  }

  // -----------------------------
  // DELETE IMAGE
  // -----------------------------
  function deleteImage(img: HTMLImageElement) {
    const parent = img.parentElement
    if (parent && parent !== editorRef.current && parent.children.length === 1) {
      parent.remove()
    } else {
      img.remove()
    }
    deleteBtnImgRef.current = null
    setDeleteBtn(null)
    if (editorRef.current) setCharCount(editorRef.current.innerText.length)
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
            <h1 className="text-3xl font-bold">{profile.username}</h1>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Rank:</span>{' '}
              <span className="font-semibold text-white">{profile.rank || 'Peasant'}</span>
            </div>
            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Doubloons:</span>{' '}
              <span className="font-semibold text-yellow-400">{profile.coins || 0}</span>
            </div>
            <div className="bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700">
              <span className="text-zinc-400">Crowns:</span>{' '}
              <span className="font-semibold text-amber-300">{profile.crowns || 0}</span>
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
                onClick={() => setActiveTab(tab as TabType)}
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
                      onKeyUp={() => {
                        saveCursor()
                        setCharCount(editorRef.current?.innerText.length || 0)
                      }}
                      onMouseUp={handleEditorClick}
                      onClick={handleEditorClick}
                      className="w-full min-h-[200px] bg-zinc-800 rounded-xl p-4 outline-none border border-zinc-700"
                    />

                    <div className="flex gap-2 mt-2 items-center">

                      {/* BOLD */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); exec('bold') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold"
                      >
                        B
                      </button>

                      {/* ITALIC */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); exec('italic') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic"
                      >
                        I
                      </button>

                      {/* IMAGE */}
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          saveCursor()
                          setEditImageEl(null)
                          setImageUrl('')
                          setImageSize('medium')
                          setShowImageModal(true)
                        }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                        title="Insert image"
                      >
                        <Image src="/picture.png" alt="img" width={14} height={14} />
                      </button>

                      {/* ALIGN LEFT */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('left') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                        title="Align left"
                      >
                        <Image src="/left.png" alt="left" width={14} height={14} />
                      </button>

                      {/* ALIGN CENTER */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('center') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                        title="Align center"
                      >
                        <Image src="/center.png" alt="center" width={14} height={14} />
                      </button>

                      {/* ALIGN RIGHT */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('right') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                        title="Align right"
                      >
                        <Image src="/right.png" alt="right" width={14} height={14} />
                      </button>

                      {/* YOUTUBE */}
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          saveCursor()
                          setEditYouTubeWrapper(null)
                          setYoutubeUrl('')
                          setYoutubeSize('medium')
                          setYoutubeAlignment('center')
                          setYoutubeAutoplay(false)
                          setShowYouTubeModal(true)
                        }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center"
                        title="Insert YouTube video"
                      >
                        <Image src="/youtube.png" alt="YouTube" width={14} height={14} />
                      </button>

                    </div>

                    {/* CHARACTER COUNTER */}
                    <div className="mt-2 text-xs text-zinc-400">
                      {charCount}/1000
                    </div>

                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => {
                          if (selectedImg) {
                            selectedImg.style.outline = 'none'
                            setSelectedImg(null)
                          }
                          setEditing(false)
                        }}
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

      {/* AVATAR MODAL */}
      {showAvatarEditor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">
            <h2 className="text-2xl font-bold mb-4">Select Avatar</h2>
            <div className="grid grid-cols-3 gap-4">
              {avatars.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => changeAvatar(avatar)}
                  className="bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 hover:border-orange-400"
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
              className="mt-5 w-full bg-zinc-700 hover:bg-zinc-600 rounded-xl py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* IMAGE MODAL */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">
            <h2 className="text-2xl font-bold mb-4">
              {editImageEl ? 'Edit Image' : 'Insert Image'}
            </h2>

            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') insertImage() }}
              placeholder="Enter image URL"
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4"
              autoFocus
            />

            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Size</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value as 'small' | 'medium' | 'large')}
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="small">Small (200px)</option>
                <option value="medium">Medium (400px)</option>
                <option value="large">Large (Full width)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowImageModal(false)
                  setImageUrl('')
                  setEditImageEl(null)
                }}
                className="bg-zinc-700 px-3 py-1 rounded"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (editImageEl) {
                    const widthMap = { small: '200px', medium: '400px', large: '100%' }
                    editImageEl.src = imageUrl.trim()
                    editImageEl.style.width = widthMap[imageSize]
                    editImageEl.style.maxWidth = widthMap[imageSize]
                    setShowImageModal(false)
                    setImageUrl('')
                    setEditImageEl(null)
                  } else {
                    insertImage()
                  }
                }}
                className="bg-green-500 text-black px-4 py-1 rounded font-bold"
              >
                {editImageEl ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YOUTUBE MODAL */}
      {showYouTubeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[440px]">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Image src="/youtube.png" alt="YouTube" width={22} height={22} />
              {editYouTubeWrapper ? 'Edit YouTube Video' : 'Insert YouTube Video'}
            </h2>

            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') insertYouTube() }}
              placeholder="Paste YouTube URL (e.g. https://youtu.be/...)"
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4"
              autoFocus
            />

            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Size</label>
              <select
                value={youtubeSize}
                onChange={(e) => setYoutubeSize(e.target.value as 'small' | 'medium' | 'large')}
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="small">Small (300px)</option>
                <option value="medium">Medium (560px)</option>
                <option value="large">Large (Full width)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Alignment</label>
              <select
                value={youtubeAlignment}
                onChange={(e) => setYoutubeAlignment(e.target.value as 'left' | 'center' | 'right')}
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <input
                type="checkbox"
                id="yt-autoplay"
                checked={youtubeAutoplay}
                onChange={(e) => setYoutubeAutoplay(e.target.checked)}
                className="w-4 h-4 accent-green-500 cursor-pointer"
              />
              <label htmlFor="yt-autoplay" className="text-sm text-zinc-300 cursor-pointer select-none">
                Autoplay when profile is opened{' '}
                <span className="text-zinc-500">(muted)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeYouTubeModal}
                className="bg-zinc-700 px-3 py-1 rounded"
              >
                Cancel
              </button>

              <button
                onClick={insertYouTube}
                className="bg-green-500 text-black px-4 py-1 rounded font-bold"
              >
                {editYouTubeWrapper ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING DELETE BUTTON */}
      {editing && deleteBtn && (
        <button
          id="img-delete-btn"
          onMouseLeave={() => {
            deleteBtnImgRef.current = null
            setDeleteBtn(null)
          }}
          onClick={() => deleteImage(deleteBtn.img)}
          style={{
            position: 'fixed',
            top: deleteBtn.y,
            left: deleteBtn.x,
            zIndex: 9999,
          }}
          className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center shadow-lg"
        >
          <Image src="/trash.png" alt="Delete" width={14} height={14} />
        </button>
      )}

    </main>
  )
}