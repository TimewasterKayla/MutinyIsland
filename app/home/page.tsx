'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

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
    ...(autoplay ? { autoplay: '1' } : {}),
  })
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

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

// Strip HTML tags to get plain text for preview
function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.innerText || tmp.textContent || ''
}

export default function HomePage() {
  const router = useRouter()

  const [posts, setPosts] = useState<any[]>([])
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({})
  const [showModal, setShowModal] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)

  // Image modal state (inside post editor)
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageSize, setImageSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [editImageEl, setEditImageEl] = useState<HTMLImageElement | null>(null)

  // YouTube modal state (inside post editor)
  const [showYouTubeModal, setShowYouTubeModal] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeSize, setYoutubeSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [youtubeAlignment, setYoutubeAlignment] = useState<'left' | 'center' | 'right'>('center')
  const [youtubeAutoplay, setYoutubeAutoplay] = useState(false)
  const [editYouTubeWrapper, setEditYouTubeWrapper] = useState<HTMLElement | null>(null)

  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null)

  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const MAX_CHARS = 1000

  // -----------------------------
  // USER
  // -----------------------------
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      setCurrentUserId(user?.id || null)
      if (user) {
        fetchLikedPosts(user.id)
        // Fetch current avatar so it's always fresh
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar')
          .eq('id', user.id)
          .single()
        setCurrentUserAvatar(profile?.avatar || null)
      }
    }
    getUser()
  }, [])

  // Re-fetch avatar any time modal opens so it's always up to date
  useEffect(() => {
    if (!showModal || !currentUserId) return
    supabase
      .from('profiles')
      .select('avatar')
      .eq('id', currentUserId)
      .single()
      .then(({ data }) => {
        if (data?.avatar) setCurrentUserAvatar(data.avatar)
      })
  }, [showModal])

  // -----------------------------
  // FETCH POSTS
  // -----------------------------
  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setPosts(data)
  }

  // -----------------------------
  // FETCH USER LIKES
  // -----------------------------
  async function fetchLikedPosts(userId: string) {
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
    const map: Record<string, boolean> = {}
    data?.forEach((l) => { map[l.post_id] = true })
    setLikedPosts(map)
  }

  // -----------------------------
  // FORMAT DATE
  // -----------------------------
  function formatDate(dateString: string) {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  // -----------------------------
  // EDITOR HELPERS
  // -----------------------------
  function saveCursor() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  function handleAlign(direction: 'left' | 'center' | 'right') {
    if (selectedImg) {
      alignImage(direction)
    } else {
      const cmdMap = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }
      exec(cmdMap[direction])
    }
  }

  function alignImage(alignment: 'left' | 'center' | 'right') {
    if (!selectedImg) return
    const wrapper = selectedImg.parentElement
    if (!wrapper) return
    selectedImg.style.display = 'block'
    if (alignment === 'left') {
      selectedImg.style.marginLeft = '0'; selectedImg.style.marginRight = 'auto'
      wrapper.style.textAlign = 'left'
    } else if (alignment === 'center') {
      selectedImg.style.marginLeft = 'auto'; selectedImg.style.marginRight = 'auto'
      wrapper.style.textAlign = 'center'
    } else {
      selectedImg.style.marginLeft = 'auto'; selectedImg.style.marginRight = '0'
      wrapper.style.textAlign = 'right'
    }
    editorRef.current?.focus()
  }

  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG' && selectedImg) {
      selectedImg.style.outline = 'none'
      setSelectedImg(null)
    }
    saveCursor()
  }

  function attachImageListeners(img: HTMLImageElement) {
    img.style.cursor = 'pointer'
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

  function attachYouTubeListeners(wrapper: HTMLElement) {
    wrapper.oncontextmenu = (e) => {
      e.preventDefault()
      const videoId = wrapper.getAttribute('data-video-id') || ''
      const autoplay = wrapper.getAttribute('data-autoplay') === 'true'
      const currentWidth = wrapper.style.width
      let size: 'small' | 'medium' | 'large' = 'medium'
      if (currentWidth === '300px') size = 'small'
      else if (currentWidth === '100%') size = 'large'
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
  // INSERT IMAGE (in post editor)
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
    attachImageListeners(img)
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
  // INSERT / UPDATE YOUTUBE (in post editor)
  // -----------------------------
  function insertYouTube() {
    if (!youtubeUrl.trim()) return
    const editor = editorRef.current
    if (!editor) return
    const videoId = extractYouTubeId(youtubeUrl.trim())
    if (!videoId) {
      alert('Could not detect a YouTube video ID. Please use a standard YouTube link.')
      return
    }
    const widthMap = { small: '300px', medium: '560px', large: '100%' }
    const width = widthMap[youtubeSize]
    const embedUrl = buildEmbedUrl(videoId, youtubeAutoplay)
    if (editYouTubeWrapper) {
      const html = buildYouTubeHTML(videoId, embedUrl, width, youtubeAlignment, youtubeAutoplay)
      const temp = document.createElement('div')
      temp.innerHTML = html
      const newWrapper = temp.firstElementChild as HTMLElement
      editYouTubeWrapper.replaceWith(newWrapper)
      attachYouTubeListeners(newWrapper)
    } else {
      const html = buildYouTubeHTML(videoId, embedUrl, width, youtubeAlignment, youtubeAutoplay)
      const temp = document.createElement('div')
      temp.innerHTML = html
      const newWrapper = temp.firstElementChild as HTMLElement
      attachYouTubeListeners(newWrapper)
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
  // CREATE POST
  // -----------------------------
  async function createPost() {
    const editor = editorRef.current
    if (!postTitle.trim() || !editor) return

    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user.id)
      .single()

    const contentHtml = editor.innerHTML

    await supabase.from('posts').insert({
      title: postTitle,
      content: contentHtml,
      image_url: null, // images are embedded in content now
      user_id: user.id,
      username: profile?.username || 'unknown',
      avatar: profile?.avatar || null,
      likes: 0,
    })

    setPostTitle('')
    editor.innerHTML = ''
    setCharCount(0)
    setShowModal(false)
    fetchPosts()
    setLoading(false)
  }

  // -----------------------------
  // TOGGLE LIKE
  // -----------------------------
  async function toggleLike(post: any) {
    if (!currentUserId) return
    const isLiked = likedPosts[post.id]
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId)
      await supabase.from('posts').update({ likes: (post.likes || 1) - 1 }).eq('id', post.id)
      setLikedPosts((prev) => ({ ...prev, [post.id]: false }))
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId })
      await supabase.from('posts').update({ likes: (post.likes || 0) + 1 }).eq('id', post.id)
      setLikedPosts((prev) => ({ ...prev, [post.id]: true }))
    }
    fetchPosts()
  }

  // -----------------------------
  // PREVIEW TEXT — strips HTML, max 100 chars
  // -----------------------------
  function getPreviewText(html: string): string {
    if (typeof window === 'undefined') return ''
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    const text = tmp.innerText || tmp.textContent || ''
    return text.length > 100 ? text.slice(0, 100).trimEnd() + '…' : text
  }

  return (
    <main className="min-h-screen flex justify-center text-white bg-zinc-950">
      <div className="w-full max-w-2xl px-4 py-8">

        {/* TOP BAR */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Mutiny Island</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded cursor-pointer"
          >
            New Post
          </button>
        </div>

        {/* POSTS */}
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"
            >
              {/* AVATAR + USER + DATE + LIKE (top row) */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {/* RECTANGULAR AVATAR */}
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-700 border border-zinc-600 flex-shrink-0">
                    {post.avatar ? (
                      <Image
                        src={post.avatar}
                        alt={post.username}
                        width={40}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-600" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">{post.username}</p>
                    <p className="text-xs text-zinc-500">{formatDate(post.created_at)}</p>
                  </div>
                </div>

                {/* LIKE */}
                <button
                  onClick={() => toggleLike(post)}
                  className="flex items-center gap-1 cursor-pointer mt-1"
                >
                  <span className="text-xl">{likedPosts[post.id] ? '❤️' : '🤍'}</span>
                  <span className="text-sm text-zinc-300">{post.likes || 0}</span>
                </button>
              </div>

              {/* TITLE — clickable */}
              {post.title && (
                <button
                  onClick={() => router.push(`/posts/${post.id}`)}
                  className="text-left w-full"
                >
                  <h2 className="text-lg font-bold text-white hover:text-green-400 transition-colors leading-snug mb-1">
                    {post.title}
                  </h2>
                </button>
              )}

              {/* CONTENT PREVIEW — plain text, 100 chars max, no images */}
              {post.content && (
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {getPreviewText(post.content)}
                </p>
              )}

              {/* READ MORE */}
              <button
                onClick={() => router.push(`/posts/${post.id}`)}
                className="mt-2 text-xs text-green-400 hover:text-green-300 transition-colors cursor-pointer"
              >
                Read more →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* NEW POST MODAL — large */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0">
              <h2 className="text-2xl font-bold">New Post</h2>
              <button
                onClick={() => { setShowModal(false); setPostTitle(''); if (editorRef.current) editorRef.current.innerHTML = ''; setCharCount(0) }}
                className="text-zinc-400 hover:text-white text-2xl leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* TITLE */}
              <div>
                <input
                  className="w-full p-3 bg-zinc-800 rounded-xl border border-zinc-700 text-white placeholder-zinc-500 text-lg font-semibold"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value.slice(0, 80))}
                  placeholder="Post title..."
                />
                <div className="text-right text-xs text-zinc-500 mt-1">{postTitle.length}/80</div>
              </div>

              {/* TOOLBAR */}
              <div className="flex gap-2 items-center flex-wrap">
                {/* BOLD */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); exec('bold') }}
                  className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold text-white"
                  title="Bold"
                >B</button>

                {/* ITALIC */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); exec('italic') }}
                  className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic text-white"
                  title="Italic"
                >I</button>

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

              {/* EDITOR */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onKeyUp={() => {
                  saveCursor()
                  const len = editorRef.current?.innerText.length || 0
                  if (len > MAX_CHARS) {
                    // trim to max
                    const text = editorRef.current!.innerText.slice(0, MAX_CHARS)
                    editorRef.current!.innerText = text
                    // move cursor to end
                    const range = document.createRange()
                    range.selectNodeContents(editorRef.current!)
                    range.collapse(false)
                    const sel = window.getSelection()
                    sel?.removeAllRanges()
                    sel?.addRange(range)
                  }
                  setCharCount(Math.min(editorRef.current?.innerText.length || 0, MAX_CHARS))
                }}
                onMouseUp={handleEditorClick}
                onClick={handleEditorClick}
                className="w-full min-h-[240px] bg-zinc-800 rounded-xl p-4 outline-none border border-zinc-700 text-white"
                data-placeholder="Write your post..."
                style={{ '--placeholder-color': '#71717a' } as React.CSSProperties}
              />

              {/* CHAR COUNT */}
              <div className={`text-right text-xs ${charCount >= MAX_CHARS ? 'text-red-400' : 'text-zinc-500'}`}>
                {charCount}/{MAX_CHARS}
              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800 flex-shrink-0">
              <button
                onClick={() => {
                  setShowModal(false)
                  setPostTitle('')
                  if (editorRef.current) editorRef.current.innerHTML = ''
                  setCharCount(0)
                }}
                className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                disabled={loading || !postTitle.trim()}
                className="px-6 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* IMAGE MODAL */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">
            <h2 className="text-2xl font-bold mb-4">{editImageEl ? 'Edit Image' : 'Insert Image'}</h2>
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
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowImageModal(false); setImageUrl(''); setEditImageEl(null) }} className="bg-zinc-700 px-3 py-1 rounded">Cancel</button>
              <button
                onClick={() => {
                  if (editImageEl) {
                    const widthMap = { small: '200px', medium: '400px', large: '100%' }
                    editImageEl.src = imageUrl.trim()
                    editImageEl.style.width = widthMap[imageSize]
                    editImageEl.style.maxWidth = widthMap[imageSize]
                    setShowImageModal(false); setImageUrl(''); setEditImageEl(null)
                  } else { insertImage() }
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[440px]">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Image src="/youtube.png" alt="YouTube" width={22} height={22} />
              {editYouTubeWrapper ? 'Edit YouTube Video' : 'Insert YouTube Video'}
            </h2>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') insertYouTube() }}
              placeholder="Paste YouTube URL"
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4"
              autoFocus
            />
            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Size</label>
              <select value={youtubeSize} onChange={(e) => setYoutubeSize(e.target.value as 'small' | 'medium' | 'large')} className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white">
                <option value="small">Small (300px)</option>
                <option value="medium">Medium (560px)</option>
                <option value="large">Large (Full width)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Alignment</label>
              <select value={youtubeAlignment} onChange={(e) => setYoutubeAlignment(e.target.value as 'left' | 'center' | 'right')} className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div className="mb-5 flex items-center gap-3">
              <input type="checkbox" id="yt-autoplay-post" checked={youtubeAutoplay} onChange={(e) => setYoutubeAutoplay(e.target.checked)} className="w-4 h-4 accent-green-500 cursor-pointer" />
              <label htmlFor="yt-autoplay-post" className="text-sm text-zinc-300 cursor-pointer select-none">Autoplay when post is opened</label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeYouTubeModal} className="bg-zinc-700 px-3 py-1 rounded">Cancel</button>
              <button onClick={insertYouTube} className="bg-green-500 text-black px-4 py-1 rounded font-bold">{editYouTubeWrapper ? 'Update' : 'Insert'}</button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}