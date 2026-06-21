'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const booterStyle = `
  @font-face {
    font-family: 'Booter';
    src: url('/fonts/Booter.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
`

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

// -----------------------------
// CONSTANTS
// -----------------------------
const POSTS_PER_PAGE = 15
const MAX_PAGES = 10

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  username?: string
}

export default function HomePage() {
  const router = useRouter()

  const [posts, setPosts] = useState<any[]>([])
  const [pinnedPosts, setPinnedPosts] = useState<any[]>([])
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({})
  const [showModal, setShowModal] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Comment counts and dropdowns
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<string | null>(null)

  // Image modal
  const [showImageModal, setShowImageModal] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageSize, setImageSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [editImageEl, setEditImageEl] = useState<HTMLImageElement | null>(null)

  // YouTube modal
  const [showYouTubeModal, setShowYouTubeModal] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeSize, setYoutubeSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [youtubeAlignment, setYoutubeAlignment] = useState<'left' | 'center' | 'right'>('center')
  const [youtubeAutoplay, setYoutubeAutoplay] = useState(false)
  const [editYouTubeWrapper, setEditYouTubeWrapper] = useState<HTMLElement | null>(null)

  // Link modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [editLinkEl, setEditLinkEl] = useState<HTMLAnchorElement | null>(null)

  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null)

  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const MAX_CHARS = 1000

  // -----------------------------
  // PAGINATION
  // -----------------------------
  const maxPosts = MAX_PAGES * POSTS_PER_PAGE
  const visiblePosts = posts.slice(0, maxPosts)
  const totalPages = Math.min(Math.ceil(visiblePosts.length / POSTS_PER_PAGE), MAX_PAGES)
  const pageStart = (currentPage - 1) * POSTS_PER_PAGE
  const pagePosts = visiblePosts.slice(pageStart, pageStart + POSTS_PER_PAGE)
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1

  function goToPage(page: number) {
    setCurrentPage(page)
    setOpenComments(null)
    document.getElementById('feed-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // -----------------------------
  // USER + PROFILE
  // -----------------------------
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      setCurrentUserId(user?.id || null)
      if (user) {
        fetchLikedPosts(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar, rank, coins, crowns, joined_at')
          .eq('id', user.id)
          .single()
        setMyProfile(profile)
      }
    }
    getUser()
  }, [])

  // -----------------------------
  // FETCH POSTS
  // -----------------------------
  useEffect(() => {
    fetchPosts()
    fetchPinnedPosts()
  }, [])

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(maxPosts)
    if (!error && data) {
      setPosts(data)
      fetchCommentCounts(data.map((p: any) => p.id))
    }
  }

  // -----------------------------
  // FETCH COMMENT COUNTS
  // -----------------------------
  async function fetchCommentCounts(postIds: string[]) {
    if (postIds.length === 0) return
    const { data, error } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds)

    if (error || !data) return

    const counts: Record<string, number> = {}
    data.forEach((row) => {
      counts[row.post_id] = (counts[row.post_id] || 0) + 1
    })
    setCommentCounts(counts)
  }

  // -----------------------------
  // TOGGLE COMMENT DROPDOWN
  // -----------------------------
  async function toggleComments(postId: string) {
    if (openComments === postId) {
      setOpenComments(null)
      return
    }

    setOpenComments(postId)

    // already loaded
    if (postComments[postId]) return

    setLoadingComments(postId)

    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })

    if (error || !data) { setLoadingComments(null); return }

    if (data.length === 0) {
      setPostComments((prev) => ({ ...prev, [postId]: [] }))
      setLoadingComments(null)
      return
    }

    const userIds = [...new Set(data.map((c) => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.username]))

    setPostComments((prev) => ({
      ...prev,
      [postId]: data.map((c) => ({
        ...c,
        username: profileMap[c.user_id] || 'Unknown',
      })),
    }))

    setLoadingComments(null)
  }

  // -----------------------------
  // FETCH PINNED POSTS
  // -----------------------------
  async function fetchPinnedPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('is_pinned', true)
      .order('pinned_at', { ascending: false })
      .limit(5)
    if (!error && data) setPinnedPosts(data)
  }

  const topPosts = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10)

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
  // PREVIEW TEXT
  // -----------------------------
  function getPreviewText(html: string): string {
    if (typeof window === 'undefined') return ''
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    tmp.querySelectorAll('img, [data-yt-wrapper]').forEach((el) => el.remove())
    const text = tmp.innerText || tmp.textContent || ''
    return text.length > 150 ? text.slice(0, 150).trimEnd() + '…' : text
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

  function attachLinkListeners(a: HTMLAnchorElement) {
    a.style.cursor = 'pointer'
    a.oncontextmenu = (e) => {
      e.preventDefault()
      setEditLinkEl(a)
      setLinkUrl(a.href)
      setShowLinkModal(true)
    }
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
  // INSERT / UPDATE YOUTUBE
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
  // INSERT / UPDATE / REMOVE LINK
  // -----------------------------
  function insertLink() {
    const editor = editorRef.current
    if (!editor) return
    if (editLinkEl) {
      if (!linkUrl.trim()) {
        const text = document.createTextNode(editLinkEl.innerText)
        editLinkEl.replaceWith(text)
      } else {
        editLinkEl.href = linkUrl.trim()
      }
      closeLinkModal()
      return
    }
    const sel = window.getSelection()
    const range = savedRangeRef.current
    if (!range || range.collapsed) {
      alert('Please highlight some text first, then click the link button.')
      closeLinkModal()
      return
    }
    if (!linkUrl.trim()) { closeLinkModal(); return }
    sel?.removeAllRanges()
    sel?.addRange(range)
    const a = document.createElement('a')
    a.href = linkUrl.trim()
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.style.color = '#22c55e'
    a.style.textDecoration = 'underline'
    a.setAttribute('data-editor-link', '1')
    try {
      range.surroundContents(a)
    } catch {
      const fragment = range.extractContents()
      a.appendChild(fragment)
      range.insertNode(a)
    }
    attachLinkListeners(a)
    const newRange = document.createRange()
    newRange.setStartAfter(a)
    newRange.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(newRange)
    editor.focus()
    setCharCount(editor.innerText.length)
    closeLinkModal()
  }

  function closeLinkModal() {
    setShowLinkModal(false)
    setLinkUrl('')
    setEditLinkEl(null)
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
    await supabase.from('posts').insert({
      title: postTitle,
      content: editor.innerHTML,
      image_url: null,
      user_id: user.id,
      username: profile?.username || 'unknown',
      avatar: profile?.avatar || null,
      likes: 0,
    })
    setPostTitle('')
    editor.innerHTML = ''
    setCharCount(0)
    setShowModal(false)
    setCurrentPage(1)
    fetchPosts()
    setLoading(false)
  }

  // -----------------------------
  // TOGGLE LIKE
  // -----------------------------
  async function toggleLike(e: React.MouseEvent, post: any) {
    e.stopPropagation()
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

  function closeModal() {
    setShowModal(false)
    setPostTitle('')
    if (editorRef.current) editorRef.current.innerHTML = ''
    setCharCount(0)
  }

  return (
    <>
      <style>{booterStyle}</style>
    <main
      className="min-h-screen flex justify-center text-white"
      style={{
        backgroundImage: 'url(/homepage.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="w-full min-h-screen" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="w-full max-w-6xl mx-auto px-4 py-8 flex gap-6 items-start">

          {/* LEFT: PROFILE SIDEBAR */}
          {currentUserId && myProfile && (
            <div className="w-72 flex-shrink-0 sticky top-8 self-start">
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 flex flex-col gap-3 w-full">
                <div
                  className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 cursor-pointer"
                  onClick={() => router.push(`/profile/${myProfile.username}`)}
                >
                  <Image
                    src={myProfile.avatar || '/avatars/jess.png'}
                    alt="Avatar"
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="text-center">
                  <h2
                    className="text-lg font-bold cursor-pointer hover:text-zinc-300 transition"
                    style={{ fontFamily: "'Survivant', serif" }}
                    onClick={() => router.push(`/profile/${myProfile.username}`)}
                  >
                    {myProfile.username}
                  </h2>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700 text-center">
                    <span className="text-zinc-400" style={{ fontFamily: "'Booter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.95rem' }}>Rank: </span>
                    <span className="font-semibold text-white">{myProfile.rank || 'Peasant'}</span>
                  </div>
                  <div className="bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700 text-center">
                    <span className="text-zinc-400" style={{ fontFamily: "'Booter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.95rem' }}>Doubloons: </span>
                    <span className="font-semibold text-yellow-400">{myProfile.coins || 0}</span>
                  </div>
                  <div className="bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700 text-center">
                    <span className="text-zinc-400" style={{ fontFamily: "'Booter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.95rem' }}>Crowns: </span>
                    <span className="font-semibold text-amber-300">{myProfile.crowns || 0}</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/profile/${myProfile.username}`)}
                  className="w-full text-xs bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 rounded-lg transition cursor-pointer"
                >
                  View Profile
                </button>
              </div>
            </div>
          )}

          {/* MIDDLE: MAIN FEED */}
          <div className="flex-1 min-w-0">

            <div id="feed-top" />

            <div className="flex justify-between items-center mb-6">
              <h1
                className="text-5xl font-bold"
                style={{ fontFamily: "'Survivant', serif" }}
              >
                Mutiny Island
              </h1>
              {currentUserId && (
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded cursor-pointer"
                >
                  New Post
                </button>
              )}
            </div>

            {/* POSTS */}
            <div className="space-y-3">
              {pagePosts.map((post) => {
                const isOpen = openComments === post.id
                return (
                  <div key={post.id}>

                    {/* POST CARD — remove bottom rounding when comments are open */}
                    <div
                      className={`bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 p-4 ${
                        isOpen
                          ? 'rounded-t-xl rounded-b-none'
                          : 'rounded-xl'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex-shrink-0 self-start cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.username}`) }}
                        >
                          <div className="w-14 h-20 rounded-lg overflow-hidden bg-zinc-700 border border-zinc-600 hover:border-zinc-400 transition-colors">
                            {post.avatar ? (
                              <Image
                                src={post.avatar}
                                alt={post.username}
                                width={56}
                                height={80}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full bg-zinc-600" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0" style={{ maxHeight: '80px', overflow: 'hidden' }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-zinc-400 leading-tight truncate">
                              <span
                                className="font-semibold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.username}`) }}
                              >
                                {post.username}
                              </span>
                              <span className="mx-1 text-zinc-600">·</span>
                              <span>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </p>
                            <button
                              onClick={(e) => toggleLike(e, post)}
                              className="flex-shrink-0 flex flex-col items-center gap-0 cursor-pointer leading-none"
                              style={{ paddingTop: '2px' }}
                            >
                              <span className="text-base leading-none">{likedPosts[post.id] ? '❤️' : '🤍'}</span>
                              <span className="text-[10px] text-zinc-400 leading-tight">{post.likes || 0}</span>
                            </button>
                          </div>

                          {post.title && (
                            <h2
                              onClick={(e) => { e.stopPropagation(); router.push(`/posts/${post.id}`) }}
                              className="font-bold text-white underline underline-offset-2 decoration-zinc-500 leading-snug cursor-pointer hover:text-zinc-200 transition-colors inline-block w-full"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                paddingRight: '4px',
                                fontSize: '0.95rem',
                                marginTop: '1px',
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word',
                              }}
                            >
                              {post.title}
                            </h2>
                          )}

                          <p
                            className="text-zinc-400 leading-snug mt-0.5"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              fontSize: '0.8rem',
                              overflowWrap: 'break-word',
                              wordBreak: 'break-word',
                            }}
                          >
                            {getPreviewText(post.content)}
                          </p>
                        </div>
                      </div>

                      {/* COMMENTS TOGGLE */}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComments(post.id) }}
                          className="text-[11px] text-amber-300 underline underline-offset-2 cursor-pointer hover:text-amber-200 transition-colors"
                        >
                          Comments ({commentCounts[post.id] || 0})
                        </button>
                      </div>
                    </div>

                    {/* COMMENTS DROPDOWN */}
                    {isOpen && (
                      <div
                        className="rounded-b-xl border border-t-0 border-amber-800/40 px-4 py-3"
                        style={{
                          background: 'linear-gradient(135deg, #3d2a1a 0%, #4a3420 50%, #3a2810 100%)',
                        }}
                      >
                        {loadingComments === post.id ? (
                          <p className="text-[11px] text-amber-300/60 italic">Loading comments...</p>
                        ) : !postComments[post.id] || postComments[post.id].length === 0 ? (
                          <p className="text-[11px] text-amber-300/60 italic">No comments yet.</p>
                        ) : (
                          <div>
                            {postComments[post.id].map((comment, index) => (
                              <div
                                key={comment.id}
                                className="flex gap-1.5 items-baseline px-2 py-1.5 rounded"
                                style={{
                                  background: index % 2 === 0
                                    ? 'rgba(120, 60, 10, 0.55)'
                                    : 'rgba(180, 110, 50, 0.35)',
                                }}
                              >
                                <button
                                  onClick={() => router.push(`/profile/${comment.username}`)}
                                  className="text-[11px] font-semibold text-amber-200 hover:text-amber-100 hover:underline cursor-pointer flex-shrink-0 transition-colors"
                                >
                                  {comment.username}
                                </button>
                                <span className="text-amber-600 text-[11px] flex-shrink-0">·</span>
                                <p
                                  className="text-[11px] text-amber-100/80 leading-snug"
                                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                                >
                                  {comment.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )
              })}
            </div>

            {/* PAGINATION */}
            {visiblePosts.length > POSTS_PER_PAGE && (
              <div className="flex items-center justify-end gap-1.5 mt-4">
                {hasPrev && (
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-green-700 hover:bg-green-600 text-white cursor-pointer transition"
                  >
                    ‹
                  </button>
                )}
                <div className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-green-600 text-white select-none">
                  {currentPage}
                </div>
                {hasNext ? (
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-green-700 hover:bg-green-600 text-white cursor-pointer transition"
                  >
                    ›
                  </button>
                ) : (
                  <div className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-zinc-700 text-zinc-500 select-none cursor-not-allowed">
                    ›
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-64 flex-shrink-0 space-y-4 sticky top-8 self-start">
            <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-4">
              <h2 className="text-base font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-yellow-400">📢</span> Announcements
              </h2>
              {pinnedPosts.length === 0 ? (
                <p className="text-zinc-400 text-sm italic">No announcements yet.</p>
              ) : (
                <div className="space-y-2">
                  {pinnedPosts.map((post) => (
                    <div key={post.id} className="flex items-start gap-2">
                      <span className="text-yellow-400 flex-shrink-0 mt-0.5">📌</span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => router.push(`/posts/${post.id}`)}
                          className="text-left w-full group cursor-pointer"
                        >
                          <p
                            className="text-sm font-semibold text-zinc-200 group-hover:text-white leading-snug underline underline-offset-2 decoration-zinc-600"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              overflowWrap: 'break-word',
                              wordBreak: 'break-word',
                            }}
                          >
                            {post.title || 'Untitled'}
                          </p>
                        </button>
                        <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                          <span>❤️ {post.likes || 0}</span>
                          <span className="text-zinc-700">·</span>
                          <button
                            onClick={() => router.push(`/profile/${post.username}`)}
                            className="truncate hover:text-zinc-300 cursor-pointer transition-colors"
                          >
                            {post.username}
                          </button>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-4">
              <h2 className="text-base font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="text-green-400">🏆</span> Top Daily Posts
              </h2>
              {topPosts.length === 0 ? (
                <p className="text-zinc-400 text-sm italic">No posts yet.</p>
              ) : (
                <div className="space-y-2">
                  {topPosts.map((post, i) => (
                    <div key={post.id} className="flex items-start gap-2">
                      <span className="text-sm font-bold text-zinc-500 w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => router.push(`/posts/${post.id}`)}
                          className="text-left w-full group cursor-pointer"
                        >
                          <p
                            className="text-sm font-semibold text-zinc-200 group-hover:text-white leading-snug underline underline-offset-2 decoration-zinc-600"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              overflowWrap: 'break-word',
                              wordBreak: 'break-word',
                            }}
                          >
                            {post.title || 'Untitled'}
                          </p>
                        </button>
                        <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                          <span>❤️ {post.likes || 0}</span>
                          <span className="text-zinc-700">·</span>
                          <button
                            onClick={() => router.push(`/profile/${post.username}`)}
                            className="truncate hover:text-zinc-300 cursor-pointer transition-colors"
                          >
                            {post.username}
                          </button>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* NEW POST MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800 flex-shrink-0">
              <h2 className="text-2xl font-bold">New Post</h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white text-2xl leading-none cursor-pointer">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <input
                  className="w-full p-3 bg-zinc-800 rounded-xl border border-zinc-700 text-white placeholder-zinc-500 text-lg font-semibold"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value.slice(0, 80))}
                  placeholder="Post title..."
                />
                <div className="text-right text-xs text-zinc-500 mt-1">{postTitle.length}/80</div>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <button onMouseDown={(e) => { e.preventDefault(); exec('bold') }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold text-white cursor-pointer" title="Bold">B</button>
                <button onMouseDown={(e) => { e.preventDefault(); exec('italic') }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic text-white cursor-pointer" title="Italic">I</button>
                <button onMouseDown={(e) => { e.preventDefault(); saveCursor(); setEditImageEl(null); setImageUrl(''); setImageSize('medium'); setShowImageModal(true) }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer" title="Insert image">
                  <Image src="/picture.png" alt="img" width={14} height={14} />
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); saveCursor(); setEditLinkEl(null); setLinkUrl(''); setShowLinkModal(true) }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer" title="Insert link">
                  <Image src="/link.png" alt="Link" width={14} height={14} />
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); handleAlign('left') }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer" title="Align left">
                  <Image src="/left.png" alt="left" width={14} height={14} />
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); handleAlign('center') }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer" title="Align center">
                  <Image src="/center.png" alt="center" width={14} height={14} />
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); handleAlign('right') }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer" title="Align right">
                  <Image src="/right.png" alt="right" width={14} height={14} />
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); saveCursor(); setEditYouTubeWrapper(null); setYoutubeUrl(''); setYoutubeSize('medium'); setYoutubeAlignment('center'); setYoutubeAutoplay(false); setShowYouTubeModal(true) }} className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer" title="Insert YouTube video">
                  <Image src="/youtube.png" alt="YouTube" width={14} height={14} />
                </button>
              </div>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onKeyUp={() => {
                  saveCursor()
                  const len = editorRef.current?.innerText.length || 0
                  if (len > MAX_CHARS) {
                    const text = editorRef.current!.innerText.slice(0, MAX_CHARS)
                    editorRef.current!.innerText = text
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
              />

              <div className={`text-right text-xs ${charCount >= MAX_CHARS ? 'text-red-400' : 'text-zinc-500'}`}>
                {charCount}/{MAX_CHARS}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800 flex-shrink-0">
              <button onClick={closeModal} className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl cursor-pointer transition">Cancel</button>
              <button
                onClick={createPost}
                disabled={loading || !postTitle.trim()}
                className="px-6 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl cursor-pointer disabled:opacity-50 transition"
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
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') insertImage() }} placeholder="Enter image URL" className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4" autoFocus />
            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Size</label>
              <select value={imageSize} onChange={(e) => setImageSize(e.target.value as 'small' | 'medium' | 'large')} className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white cursor-pointer">
                <option value="small">Small (200px)</option>
                <option value="medium">Medium (400px)</option>
                <option value="large">Large (Full width)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowImageModal(false); setImageUrl(''); setEditImageEl(null) }} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition">Cancel</button>
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
                className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition"
              >
                {editImageEl ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LINK MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">
            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Image src="/link.png" alt="Link" width={20} height={20} />
              {editLinkEl ? 'Edit Link' : 'Insert Link'}
            </h2>
            {!editLinkEl && <p className="text-xs text-zinc-400 mb-4">Highlight text in the editor before clicking this button to turn it into a link.</p>}
            {editLinkEl && <p className="text-xs text-zinc-400 mb-4">Update the URL below, or clear it to remove the link.</p>}
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') insertLink() }} placeholder="https://example.com" className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={closeLinkModal} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition">Cancel</button>
              {editLinkEl && (
                <button onClick={() => { const text = document.createTextNode(editLinkEl.innerText); editLinkEl.replaceWith(text); closeLinkModal() }} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold cursor-pointer transition">Remove</button>
              )}
              <button onClick={insertLink} className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition">{editLinkEl ? 'Update' : 'Insert'}</button>
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
            <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') insertYouTube() }} placeholder="Paste YouTube URL" className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4" autoFocus />
            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Size</label>
              <select value={youtubeSize} onChange={(e) => setYoutubeSize(e.target.value as 'small' | 'medium' | 'large')} className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white cursor-pointer">
                <option value="small">Small (300px)</option>
                <option value="medium">Medium (560px)</option>
                <option value="large">Large (Full width)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-1 block">Alignment</label>
              <select value={youtubeAlignment} onChange={(e) => setYoutubeAlignment(e.target.value as 'left' | 'center' | 'right')} className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white cursor-pointer">
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
              <button onClick={closeYouTubeModal} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition">Cancel</button>
              <button onClick={insertYouTube} className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition">{editYouTubeWrapper ? 'Update' : 'Insert'}</button>
            </div>
          </div>
        </div>
      )}

    </main>
    </>
  )
}