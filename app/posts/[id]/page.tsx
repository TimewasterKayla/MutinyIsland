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

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  username?: string
  avatar?: string
}

export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()

  const [postId, setPostId] = useState<string>('')
  const [post, setPost] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [pinning, setPinning] = useState(false)

  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState<string>('')
  const [submittingComment, setSubmittingComment] = useState<boolean>(false)

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

  // -----------------------------
  // PARAMS
  // -----------------------------
  useEffect(() => {
    Promise.resolve(params).then((p) => setPostId(p.id))
  }, [params])

  // -----------------------------
  // USER + ADMIN CHECK
  // -----------------------------
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      setCurrentUserId(user?.id || null)
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle()
        setIsAdmin(!!profile?.is_admin)
      }
    }
    getUser()
  }, [])

  // -----------------------------
  // FETCH POST
  // -----------------------------
  useEffect(() => {
    if (!postId) return
    fetchPost()
    fetchComments()
  }, [postId])

  async function fetchPost() {
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle()
    if (error || !data) { setLoading(false); return }
    setPost(data)
    setLoading(false)
  }

  // -----------------------------
  // FETCH COMMENTS (newest first)
  // -----------------------------
  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })

    if (error || !data) return

    if (data.length === 0) {
      setComments([])
      return
    }

    const userIds = [...new Set(data.map((c) => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar')
      .in('id', userIds)

    const profileMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, { username: p.username, avatar: p.avatar }])
    )

    setComments(
      data.map((c) => ({
        ...c,
        username: profileMap[c.user_id]?.username || 'Unknown',
        avatar: profileMap[c.user_id]?.avatar || null,
      }))
    )
  }

  // -----------------------------
  // SUBMIT COMMENT
  // -----------------------------
  async function submitComment() {
    if (!commentText.trim() || !currentUserId || submittingComment) return
    setSubmittingComment(true)

    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: currentUserId,
      content: commentText.trim(),
    })

    if (!error) {
      setCommentText('')
      await fetchComments()
    }

    setSubmittingComment(false)
  }

  // -----------------------------
  // DELETE COMMENT
  // -----------------------------
  async function deleteComment(commentId: string) {
    await supabase.from('comments').delete().eq('id', commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  // -----------------------------
  // FETCH LIKE STATUS
  // -----------------------------
  useEffect(() => {
    if (!postId || !currentUserId) return
    fetchLikeStatus()
  }, [postId, currentUserId])

  async function fetchLikeStatus() {
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', currentUserId!)
      .maybeSingle()
    setIsLiked(!!data)
  }

  useEffect(() => {
    if (editing && editorRef.current && post) {
      editorRef.current.innerHTML = post.content || ''
    }
  }, [editing])

  // -----------------------------
  // TOGGLE LIKE
  // -----------------------------
  async function toggleLike() {
    if (!currentUserId || !post) return
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId)
      await supabase.from('posts').update({ likes: (post.likes || 1) - 1 }).eq('id', post.id)
      setPost({ ...post, likes: (post.likes || 1) - 1 })
      setIsLiked(false)
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId })
      await supabase.from('posts').update({ likes: (post.likes || 0) + 1 }).eq('id', post.id)
      setPost({ ...post, likes: (post.likes || 0) + 1 })
      setIsLiked(true)
    }
  }

  // -----------------------------
  // TOGGLE PIN
  // -----------------------------
  async function togglePin() {
    if (!post || pinning) return
    setPinning(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (!accessToken) { setPinning(false); return }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pin-post`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ postId: post.id, pin: !post.is_pinned }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to update pin status')
        setPinning(false)
        return
      }

      setPost({ ...post, is_pinned: !post.is_pinned })
    } catch (err) {
      console.error(err)
      alert('Something went wrong')
    }

    setPinning(false)
  }

  // -----------------------------
  // DELETE POST
  // -----------------------------
  async function deletePost() {
    if (!confirm('Delete this post?')) return
    await supabase.from('posts').delete().eq('id', post.id)
    router.push('/')
  }

  // -----------------------------
  // SAVE EDIT
  // -----------------------------
  async function saveEdit() {
    if (!editTitle.trim() || !editorRef.current) return
    setSaving(true)
    const newContent = editorRef.current.innerHTML
    const { error } = await supabase
      .from('posts')
      .update({ title: editTitle, content: newContent })
      .eq('id', post.id)
    if (!error) {
      setPost({ ...post, title: editTitle, content: newContent })
      setEditing(false)
    }
    setSaving(false)
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
    closeLinkModal()
  }

  function closeLinkModal() {
    setShowLinkModal(false)
    setLinkUrl('')
    setEditLinkEl(null)
    savedRangeRef.current = null
  }

  // -----------------------------
  // FORMAT DATE
  // -----------------------------
  function formatDate(dateString: string) {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  function formatCommentDate(dateString: string) {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // -----------------------------
  // STATES
  // -----------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading post...
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Post not found.
      </div>
    )
  }

  const isOwner = currentUserId === post.user_id
  const canEdit = isOwner || isAdmin

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* BACK BUTTON */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6 cursor-pointer group"
        >
          <span className="text-lg group-hover:-translate-x-0.5 transition-transform">←</span>
          <span className="text-sm">Back</span>
        </button>

        {/* POST CARD */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">

          {/* AUTHOR ROW */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-700 border border-zinc-600 flex-shrink-0">
                {post.avatar ? (
                  <Image
                    src={post.avatar}
                    alt={post.username}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-white">{post.username}</p>
                <p className="text-xs text-zinc-400">{formatDate(post.created_at)}</p>
              </div>
            </div>

            {/* LIKE + PIN + OWNER/ADMIN BUTTONS */}
            <div className="flex items-center gap-3">
              <button onClick={toggleLike} className="flex items-center gap-1 cursor-pointer">
                <span className="text-xl">{isLiked ? '❤️' : '🤍'}</span>
                <span className="text-sm text-zinc-300">{post.likes || 0}</span>
              </button>

              {isAdmin && !editing && (
                <button
                  onClick={togglePin}
                  disabled={pinning}
                  className="bg-yellow-500 hover:bg-yellow-400 text-white px-3 py-1.5 rounded text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
                >
                  {pinning ? '...' : post.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              )}

              {canEdit && !editing && (
                <>
                  <button
                    onClick={() => { setEditTitle(post.title || ''); setEditing(true) }}
                    className="bg-orange-500 hover:bg-orange-400 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer transition-colors text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={deletePost}
                    className="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}

              {canEdit && editing && (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editTitle.trim()}
                    className="bg-green-500 hover:bg-green-400 text-black px-3 py-1.5 rounded text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* DIVIDER */}
          <div className="border-t border-zinc-800 mb-6" />

          {/* VIEW MODE */}
          {!editing && (
            <>
              {post.title && (
                <h1
                  className="text-3xl font-bold text-white mb-5 leading-snug"
                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                >
                  {post.title}
                </h1>
              )}
              {post.content && (
                <div
                  className="text-zinc-200 leading-relaxed prose-invert"
                  style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
              )}
            </>
          )}

          {/* EDIT MODE */}
          {editing && (
            <div className="space-y-4">
              <div>
                <input
                  className="w-full p-3 bg-zinc-800 rounded-xl border border-zinc-700 text-white text-xl font-bold placeholder-zinc-500"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value.slice(0, 80))}
                  placeholder="Post title..."
                />
                <div className="text-right text-xs text-zinc-500 mt-1">{editTitle.length}/80</div>
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
                onKeyUp={saveCursor}
                onMouseUp={handleEditorClick}
                onClick={handleEditorClick}
                className="w-full min-h-[300px] bg-zinc-800 rounded-xl p-4 outline-none border border-zinc-700 text-white"
              />
            </div>
          )}

        </div>

        {/* COMMENTS SECTION */}
        <div className="mt-6 bg-zinc-900 rounded-2xl border border-zinc-800 p-8">

          <h2 className="text-xl font-bold text-white mb-6">
            Comments ({comments.length})
          </h2>

          {/* COMMENT INPUT — signed in only */}
          {currentUserId ? (
            <div className="mb-6">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitComment()
                  }
                }}
                placeholder="Write a comment..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-500 outline-none resize-none focus:border-zinc-500 transition-colors"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-zinc-500">{commentText.length}/500</span>
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || submittingComment}
                  className="bg-green-500 hover:bg-green-400 text-black px-4 py-1.5 rounded-lg text-sm font-bold cursor-pointer transition-colors disabled:opacity-50"
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-zinc-800 rounded-xl p-4 text-zinc-400 text-sm text-center">
              Sign in to leave a comment
            </div>
          )}

          {/* COMMENT LIST */}
          {comments.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 bg-zinc-800 rounded-xl p-4 border border-zinc-700"
                >
                  {/* AVATAR — clickable */}
                  <div
                    onClick={() => router.push(`/profile/${comment.username}`)}
                    className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-700 border border-zinc-600 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {comment.avatar ? (
                      <Image
                        src={comment.avatar}
                        alt={comment.username || ''}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-600" />
                    )}
                  </div>

                  {/* CONTENT */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {/* USERNAME — clickable */}
                        <span
                          onClick={() => router.push(`/profile/${comment.username}`)}
                          className="font-semibold text-white text-sm cursor-pointer hover:underline"
                        >
                          {comment.username}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatCommentDate(comment.created_at)}
                        </span>
                      </div>

                      {/* DELETE */}
                      {(currentUserId === comment.user_id || isAdmin) && (
                        <button
                          onClick={() => deleteComment(comment.id)}
                          className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <p
                      className="text-zinc-200 text-sm leading-relaxed"
                      style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                    >
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

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
              <input type="checkbox" id="yt-autoplay-edit" checked={youtubeAutoplay} onChange={(e) => setYoutubeAutoplay(e.target.checked)} className="w-4 h-4 accent-green-500 cursor-pointer" />
              <label htmlFor="yt-autoplay-edit" className="text-sm text-zinc-300 cursor-pointer select-none">Autoplay when post is opened</label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeYouTubeModal} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition">Cancel</button>
              <button onClick={insertYouTube} className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition">{editYouTubeWrapper ? 'Update' : 'Insert'}</button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}