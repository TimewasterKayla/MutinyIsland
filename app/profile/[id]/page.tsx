'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
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
  joined_at: string | null
}

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  title: string
  body: string
  read: boolean
  created_at: string
  thread_id: string | null
  parent_id: string | null
  sender_username?: string
  recipient_username?: string
}

type ProfilePostSummary = {
  id: string
  title: string | null
  created_at: string
  likes: number | null
}

type TabType = 'about' | 'inbox' | 'posts' | 'friends' | 'wins' | 'inventory'
type PostsViewType = 'all' | 'top'

const avatars = [
  '/avatars/jess.png',
  '/avatars/laffite.png',
  '/avatars/malley.png',
  '/avatars/morgan.png',
  '/avatars/read.png',
]

// -----------------------------
// PROFILE POSTS PAGINATION
// -----------------------------
const PROFILE_POSTS_PER_PAGE = 11
const PROFILE_POSTS_MAX_PAGES = 10

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
// SIMPLE RICH TEXT EXEC BUTTON
// -----------------------------
function RichButton({
  onAction,
  className,
  title,
  children,
}: {
  onAction: () => void
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onAction() }}
      title={title}
      className={`w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer text-xs ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
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

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false)
  const [linkUrl, setLinkUrl] = useState<string>('')
  const [editLinkEl, setEditLinkEl] = useState<HTMLAnchorElement | null>(null)

  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null)
  const [charCount, setCharCount] = useState<number>(0)
  const [deleteBtn, setDeleteBtn] = useState<{ x: number; y: number; img: HTMLImageElement } | null>(null)

  // Inbox / messaging state
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [showCompose, setShowCompose] = useState<boolean>(false)
  const [composeRecipient, setComposeRecipient] = useState<string>('')
  const [composeTitle, setComposeTitle] = useState<string>('')
  const [composeBody, setComposeBody] = useState<string>('')
  const [recipientError, setRecipientError] = useState<string>('')
  const [composeSending, setComposeSending] = useState<boolean>(false)

  // Thread view state
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [threadTitle, setThreadTitle] = useState<string>('')
  const [showReply, setShowReply] = useState<boolean>(false)
  const [replyBody, setReplyBody] = useState<string>('')
  const [replySending, setReplySending] = useState<boolean>(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string>('')

  // Posts tab state
  const [userPosts, setUserPosts] = useState<ProfilePostSummary[]>([])
  const [postsPage, setPostsPage] = useState<number>(1)
  const [postsView, setPostsView] = useState<PostsViewType>('all')

  const editorRef = useRef<HTMLDivElement | null>(null)
  const composeEditorRef = useRef<HTMLDivElement | null>(null)
  const replyEditorRef = useRef<HTMLDivElement | null>(null)
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
    if (user) {
      setCurrentUserId(user.id)
      setCurrentUsername(data.username)
    }

    setActiveTab((prev: TabType) => {
      if (!own && (prev === 'inbox' || prev === 'inventory')) return 'about'
      return prev
    })

    setLoading(false)
  }

  // -----------------------------
  // LOAD USER POSTS (any profile, own or not)
  // -----------------------------
  useEffect(() => {
    if (!profile) return
    setPostsPage(1)
    setPostsView('all')
    loadUserPosts(profile.id)
  }, [profile?.id])

  async function loadUserPosts(profileId: string) {
    const maxPosts = PROFILE_POSTS_MAX_PAGES * PROFILE_POSTS_PER_PAGE
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, created_at, likes')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(maxPosts)

    if (!error && data) setUserPosts(data)
  }

  // -----------------------------
  // LOAD MESSAGES (own profile only)
  // -----------------------------
  useEffect(() => {
    if (!isOwnProfile || !currentUserId) return
    loadMessages()

    const channel = supabase
      .channel('inbox-' + currentUserId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        () => { loadMessages() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isOwnProfile, currentUserId])

  async function loadMessages() {
    if (!currentUserId) return
    const { data, error } = await supabase
      .from('inbox_messages')
      .select('*, profiles!inbox_messages_sender_id_fkey(username)')
      .eq('recipient_id', currentUserId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })

    if (error) { console.error(error); return }

    const msgs: Message[] = (data || []).map((m: any) => ({
      ...m,
      sender_username: m.profiles?.username ?? 'Unknown',
    }))

    setMessages(msgs)

    const { data: unreadData } = await supabase
      .from('inbox_messages')
      .select('id')
      .eq('recipient_id', currentUserId)
      .eq('read', false)

    setUnreadCount((unreadData || []).length)
  }

  async function loadThread(threadId: string) {
    if (!currentUserId) return
    const { data, error } = await supabase
      .from('inbox_messages')
      .select('*, sender:profiles!inbox_messages_sender_id_fkey(username), recipient:profiles!inbox_messages_recipient_id_fkey(username)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) { console.error(error); return }

    const msgs: Message[] = (data || []).map((m: any) => ({
      ...m,
      sender_username: m.sender?.username ?? 'Unknown',
      recipient_username: m.recipient?.username ?? 'Unknown',
    }))

    setThreadMessages(msgs)

    const unreadIds = msgs.filter((m) => !m.read && m.recipient_id === currentUserId).map((m) => m.id)
    if (unreadIds.length > 0) {
      await supabase.from('inbox_messages').update({ read: true }).in('id', unreadIds)
      setUnreadCount((prev) => Math.max(0, prev - unreadIds.length))
      setMessages((prev) =>
        prev.map((m) => (m.thread_id === threadId || m.id === threadId) ? { ...m, read: true } : m)
      )
    }
  }

  function openThread(msg: Message) {
    const tid = msg.thread_id ?? msg.id
    setOpenThreadId(tid)
    setThreadTitle(msg.title)
    loadThread(tid)
  }

  // -----------------------------
  // SEND NEW MESSAGE
  // -----------------------------
  async function sendMessage() {
    const body = composeEditorRef.current?.innerHTML?.trim() ?? ''
    if (!composeRecipient.trim() || !composeTitle.trim() || !body) return
    setComposeSending(true)
    setRecipientError('')

    const { data: recipientProfile, error: recipientErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', composeRecipient.trim())
      .maybeSingle()

    if (recipientErr || !recipientProfile) {
      setRecipientError('Username not found')
      setComposeSending(false)
      return
    }

    const { data: inserted, error: sendErr } = await supabase
      .from('inbox_messages')
      .insert({
        sender_id: currentUserId,
        recipient_id: recipientProfile.id,
        title: composeTitle.trim().slice(0, 60),
        body,
        read: false,
        parent_id: null,
      })
      .select('id')
      .single()

    if (sendErr || !inserted) {
      console.error('Send error:', sendErr)
      alert('Failed to send message.')
      setComposeSending(false)
      return
    }

    await supabase
      .from('inbox_messages')
      .update({ thread_id: inserted.id })
      .eq('id', inserted.id)
      .is('thread_id', null)

    setComposeSending(false)
    setShowCompose(false)
    setComposeRecipient('')
    setComposeTitle('')
    setComposeBody('')
    setRecipientError('')
    if (composeEditorRef.current) composeEditorRef.current.innerHTML = ''
    loadMessages()
  }

  // -----------------------------
  // SEND REPLY
  // -----------------------------
  async function sendReply() {
    if (!openThreadId || !currentUserId) return
    const body = replyEditorRef.current?.innerHTML?.trim() ?? ''
    if (!body) return
    setReplySending(true)

    const lastMsg = threadMessages[threadMessages.length - 1]
    const replyToId = lastMsg.sender_id === currentUserId ? lastMsg.recipient_id : lastMsg.sender_id

    const { data: inserted, error } = await supabase
      .from('inbox_messages')
      .insert({
        sender_id: currentUserId,
        recipient_id: replyToId,
        title: threadTitle,
        body,
        read: false,
        thread_id: openThreadId,
        parent_id: lastMsg.id,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('Reply error:', error)
      alert('Failed to send reply.')
      setReplySending(false)
      return
    }

    setReplySending(false)
    setShowReply(false)
    setReplyBody('')
    if (replyEditorRef.current) replyEditorRef.current.innerHTML = ''
    loadThread(openThreadId)
  }

  async function markMessageRead(msg: Message) {
    if (msg.read) return
    await supabase.from('inbox_messages').update({ read: true }).eq('id', msg.id)
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
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
      attachLinkListeners()
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

      const currentWidth = wrapper.style.width
      let size: 'small' | 'medium' | 'large' = 'medium'
      if (currentWidth === '300px') size = 'small'
      else if (currentWidth === '560px') size = 'medium'
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
  // ATTACH LISTENERS TO LINKS
  // -----------------------------
  function attachLinkListeners() {
    if (!editorRef.current) return
    const anchors = editorRef.current.querySelectorAll<HTMLAnchorElement>('a[data-editor-link="1"]')
    anchors.forEach((a) => addLinkListeners(a))
  }

  function addLinkListeners(a: HTMLAnchorElement) {
    a.style.cursor = 'pointer'

    a.oncontextmenu = (e) => {
      e.preventDefault()
      setEditLinkEl(a)
      setLinkUrl(a.href)
      setShowLinkModal(true)
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

  function execOn(ref: React.RefObject<HTMLDivElement | null>, command: string) {
    ref.current?.focus()
    document.execCommand(command, false, undefined)
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

    if (!linkUrl.trim()) {
      closeLinkModal()
      return
    }

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

    addLinkListeners(a)

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
    ? ['about', 'inbox', 'posts', 'friends', 'wins', 'inventory']
    : ['about', 'posts', 'friends', 'wins']

  const inventoryPlaceholders = Array.from({ length: 5 })

  const displayDateJoined = profile.joined_at
    ? new Date(profile.joined_at).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    : null

  // Posts tab: sort according to the active view
  const sortedUserPosts = postsView === 'top'
    ? [...userPosts].sort((a, b) => {
        const likesDiff = (b.likes || 0) - (a.likes || 0)
        if (likesDiff !== 0) return likesDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    : userPosts // already ordered by created_at desc from the query

  // Posts tab pagination (computed each render)
  const visibleUserPosts = sortedUserPosts.slice(0, PROFILE_POSTS_MAX_PAGES * PROFILE_POSTS_PER_PAGE)
  const totalUserPostsPages = Math.min(
    Math.ceil(visibleUserPosts.length / PROFILE_POSTS_PER_PAGE),
    PROFILE_POSTS_MAX_PAGES
  )
  const userPostsPageStart = (postsPage - 1) * PROFILE_POSTS_PER_PAGE
  const pageUserPosts = visibleUserPosts.slice(userPostsPageStart, userPostsPageStart + PROFILE_POSTS_PER_PAGE)
  const hasNextUserPosts = postsPage < totalUserPostsPages
  const hasPrevUserPosts = postsPage > 1

  function switchPostsView(view: PostsViewType) {
    setPostsView(view)
    setPostsPage(1)
  }

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
            <h1 className="text-3xl font-bold font-survivant">{profile.username}</h1>
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
                {displayDateJoined ?? 'Unknown'}
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
                className={`relative px-3 py-1 text-xs rounded-t-md border border-zinc-700 transition capitalize cursor-pointer ${
                  activeTab === tab
                    ? 'bg-green-500 text-black font-bold'
                    : 'bg-green-200 text-black hover:bg-green-300'
                }`}
              >
                {tab}
                {tab === 'inbox' && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none z-20">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 min-h-[550px] relative overflow-hidden">

            {/* ======================== ABOUT TAB ======================== */}
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
                      <button
                        onMouseDown={(e) => { e.preventDefault(); exec('bold') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold cursor-pointer"
                      >B</button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); exec('italic') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic cursor-pointer"
                      >I</button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          saveCursor()
                          setEditImageEl(null)
                          setImageUrl('')
                          setImageSize('medium')
                          setShowImageModal(true)
                        }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Insert image"
                      >
                        <Image src="/picture.png" alt="img" width={14} height={14} />
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          saveCursor()
                          setEditLinkEl(null)
                          setLinkUrl('')
                          setShowLinkModal(true)
                        }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Insert link"
                      >
                        <Image src="/link.png" alt="Link" width={14} height={14} />
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('left') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Align left"
                      >
                        <Image src="/left.png" alt="left" width={14} height={14} />
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('center') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Align center"
                      >
                        <Image src="/center.png" alt="center" width={14} height={14} />
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('right') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Align right"
                      >
                        <Image src="/right.png" alt="right" width={14} height={14} />
                      </button>
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
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Insert YouTube video"
                      >
                        <Image src="/youtube.png" alt="YouTube" width={14} height={14} />
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-zinc-400">{charCount}/1000</div>

                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => {
                          if (selectedImg) {
                            selectedImg.style.outline = 'none'
                            setSelectedImg(null)
                          }
                          setEditing(false)
                        }}
                        className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded-lg cursor-pointer transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveAboutMe}
                        className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded-lg font-bold cursor-pointer transition"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================== INBOX TAB ======================== */}
            {activeTab === 'inbox' && isOwnProfile && (
              <div className="h-full">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-3xl font-bold">Inbox</h2>
                  <button
                    onClick={() => {
                      setShowCompose(true)
                      setComposeRecipient('')
                      setComposeTitle('')
                      setComposeBody('')
                      setRecipientError('')
                      if (composeEditorRef.current) composeEditorRef.current.innerHTML = ''
                    }}
                   className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer transition shadow-md text-sm"
                  >
                    New Message
                    <Image src="/MessageSendIcon.png" alt="Send" width={14} height={14} />
                  </button>
                </div>

                {/* Message list */}
                {messages.length === 0 ? (
                  <div className="text-zinc-400 italic mt-6">No messages yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((msg) => (
                      <li
                        key={msg.id}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden"
                      >
                        <div className="flex items-stretch min-h-[52px]">
                          {/* LEFT: messagebox image fills entire left section */}
                          <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: '130px' }}>
                            <Image
                              src="/messagebox.jpg"
                              alt=""
                              fill
                              className="object-cover"
                              style={{ pointerEvents: 'none' }}
                            />
                            {/* Unread dot — top-left corner over the image */}
                            {!msg.read && (
                              <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-red-500 z-10" />
                            )}
                            {/* @username clickable, centered over image */}
                            <button
                              onClick={() => router.push(`/profile/${msg.sender_username}`)}
                              className="relative z-10 text-xs font-bold text-white px-2 py-1 text-center leading-tight hover:text-yellow-300 transition cursor-pointer"
                              style={{ textShadow: '0 1px 6px #000, 0 0 12px #000' }}
                            >
                              @{msg.sender_username}
                            </button>
                          </div>

                          {/* RIGHT: title + date */}
                          <div className="flex flex-1 items-center px-4 gap-3">
                            <button
                              onClick={() => openThread(msg)}
                              className="text-white underline hover:text-green-400 transition text-left cursor-pointer font-medium text-sm truncate flex-1"
                              title={msg.title}
                            >
                              {msg.title}
                            </button>
                            <div className="text-xs text-zinc-400 flex-shrink-0">
                              {new Date(msg.created_at).toLocaleDateString('en-US', {
                                month: '2-digit',
                                day: '2-digit',
                                year: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* ---- COMPOSE OVERLAY ---- */}
                {showCompose && (
                  <div className="absolute inset-0 bg-zinc-900 rounded-2xl p-6 z-20 flex flex-col">
                    <div className="flex items-center gap-3 mb-5">
                      <button
                        onClick={() => setShowCompose(false)}
                        className="bg-yellow-500 hover:bg-yellow-400 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer transition text-sm"
                      >
                        Back
                      </button>
                      <h2 className="text-2xl font-bold">New Message</h2>
                    </div>

                    <div className="mb-3">
                      <label className="text-xs text-zinc-400 block mb-1">To (username)</label>
                      <input
                        value={composeRecipient}
                        onChange={(e) => {
                          setComposeRecipient(e.target.value)
                          setRecipientError('')
                        }}
                        placeholder="Enter a username"
                        className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white outline-none focus:border-green-500 transition"
                      />
                      {recipientError && (
                        <p className="text-red-400 italic text-xs mt-1">{recipientError}</p>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="text-xs text-zinc-400 block mb-1">
                        Title <span className="text-zinc-500">({composeTitle.length}/60)</span>
                      </label>
                      <input
                        value={composeTitle}
                        onChange={(e) => setComposeTitle(e.target.value.slice(0, 60))}
                        placeholder="Message title"
                        maxLength={60}
                        className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white outline-none focus:border-green-500 transition"
                      />
                    </div>

                    <div className="flex-1 flex flex-col mb-2">
                      <label className="text-xs text-zinc-400 block mb-1">Message</label>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); execOn(composeEditorRef, 'bold') }}
                          className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold cursor-pointer"
                        >B</button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); execOn(composeEditorRef, 'italic') }}
                          className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic cursor-pointer"
                        >I</button>
                      </div>
                      <div
                        ref={composeEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Write your message..."
                        className="flex-1 w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white outline-none focus:border-green-500 transition overflow-y-auto min-h-[120px]"
                        style={{ whiteSpace: 'pre-wrap' }}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={sendMessage}
                        disabled={composeSending || !composeRecipient.trim() || !composeTitle.trim()}
                        className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-6 py-2 rounded-xl cursor-pointer transition"
                      >
                        {composeSending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ---- THREAD VIEW OVERLAY ---- */}
                {openThreadId && (
                  <div className="absolute inset-0 bg-zinc-900 rounded-2xl p-6 z-20 flex flex-col">
                    {/* Header: Back + Title */}
                    <div className="flex items-center gap-3 mb-1">
                      <button
                        onClick={() => {
                          setOpenThreadId(null)
                          setThreadMessages([])
                          setShowReply(false)
                          setReplyBody('')
                          if (replyEditorRef.current) replyEditorRef.current.innerHTML = ''
                        }}
                        className="bg-yellow-500 hover:bg-yellow-400 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer transition text-sm flex-shrink-0"
                      >
                        Back
                      </button>
                      <h2 className="text-lg font-bold truncate">{threadTitle}</h2>
                    </div>

                    {/* Thread messages */}
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4 pt-2">
                      {threadMessages.map((m, idx) => {
                        const isRoot = m.parent_id === null
                        const isMe = m.sender_id === currentUserId

                        return (
                          <div key={m.id} className="bg-zinc-700/50 rounded-xl px-4 py-3 w-full">
                            {isRoot ? (
                              /* ---- Root message ---- */
                              <>
                                {/* Sender + date on same line, directly below title */}
                                <div className="flex items-center gap-2 mb-2">
                                  <button
                                    onClick={() => router.push(`/profile/${m.sender_username}`)}
                                    className="text-sm font-semibold text-green-400 hover:text-green-300 transition cursor-pointer"
                                  >
                                    @{m.sender_username}
                                  </button>
                                  <span className="text-zinc-500 text-xs">·</span>
                                  <span className="text-xs text-zinc-400">
                                    {new Date(m.created_at).toLocaleString('en-US', {
                                      month: '2-digit',
                                      day: '2-digit',
                                      year: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <div
                                  className="text-sm leading-relaxed text-zinc-100"
                                  dangerouslySetInnerHTML={{ __html: m.body }}
                                />
                              </>
                            ) : (
                              /* ---- Reply message ---- */
                              <>
                                <div className="flex items-center gap-2 mb-2">
                                  <button
                                    onClick={() => router.push(`/profile/${m.sender_username}`)}
                                    className={`text-sm font-semibold hover:opacity-80 transition cursor-pointer ${isMe ? 'text-green-400' : 'text-zinc-200'}`}
                                  >
                                    @{isMe ? currentUsername : m.sender_username}
                                  </button>
                                  {/* Date pushed to right for replies */}
                                  <span className="ml-auto text-xs text-zinc-400 flex-shrink-0">
                                    {new Date(m.created_at).toLocaleString('en-US', {
                                      month: '2-digit',
                                      day: '2-digit',
                                      year: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <div
                                  className="text-sm leading-relaxed text-zinc-100"
                                  dangerouslySetInnerHTML={{ __html: m.body }}
                                />
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Reply area */}
                    {!showReply ? (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShowReply(true)}
                          className="bg-green-500 hover:bg-green-400 text-black font-bold px-5 py-2 rounded-xl cursor-pointer transition"
                        >
                          Reply
                        </button>
                      </div>
                    ) : (
                      <div className="border-t border-zinc-700 pt-3">
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); execOn(replyEditorRef, 'bold') }}
                            className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold cursor-pointer"
                          >B</button>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); execOn(replyEditorRef, 'italic') }}
                            className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic cursor-pointer"
                          >I</button>
                        </div>
                        <div
                          ref={replyEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          className="w-full min-h-[80px] p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white outline-none focus:border-green-500 transition mb-2"
                          style={{ whiteSpace: 'pre-wrap' }}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setShowReply(false)
                              if (replyEditorRef.current) replyEditorRef.current.innerHTML = ''
                            }}
                            className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded-lg cursor-pointer transition text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={sendReply}
                            disabled={replySending}
                            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold px-5 py-1 rounded-xl cursor-pointer transition text-sm"
                          >
                            {replySending ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'friends' && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Friends</h2>
                <div className="text-zinc-400">Friends coming soon...</div>
              </div>
            )}

            {/* ======================== POSTS TAB ======================== */}
            {activeTab === 'posts' && (
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-bold mb-2">Posts</h2>

                  {visibleUserPosts.length > PROFILE_POSTS_PER_PAGE && (
                    <div className="flex items-center justify-end gap-1.5 mb-2">
                      {hasPrevUserPosts && (
                        <button
                          onClick={() => setPostsPage((p) => p - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-green-700 hover:bg-green-600 text-white cursor-pointer transition"
                        >
                          ‹
                        </button>
                      )}
                      <div className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-green-600 text-white select-none">
                        {postsPage}
                      </div>
                      {hasNextUserPosts ? (
                        <button
                          onClick={() => setPostsPage((p) => p + 1)}
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

                  {pageUserPosts.length === 0 ? (
                    <div className="text-zinc-400 italic">No posts yet.</div>
                  ) : (
                    <ul className="flex flex-col">
                      {pageUserPosts.map((post, index) => (
                        <li key={post.id} className="w-full">
                          <div
                            className={`w-full bg-zinc-800 border-x border-zinc-700 px-4 py-2.5 flex items-center justify-between gap-3
                              ${index === 0 ? 'border-t' : ''}
                              ${index === pageUserPosts.length - 1 ? 'border-b' : 'border-b border-zinc-700'}
                            `}
                          >
                            <button
                              onClick={() => router.push(`/posts/${post.id}`)}
                              className="text-white underline underline-offset-2 decoration-zinc-500 hover:text-green-400 transition cursor-pointer text-left text-sm font-semibold truncate"
                            >
                              {post.title || 'Untitled'}
                            </button>

                            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-400">
                              <span className="flex items-center gap-1">
                                <span>❤️</span>
                                <span>{post.likes || 0}</span>
                              </span>
                              <span>
                                {new Date(post.created_at).toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* View toggle buttons — stacked vertically on the far right */}
                <div
                  className="flex flex-col gap-2 flex-shrink-0"
                  style={{
                    marginTop: visibleUserPosts.length > PROFILE_POSTS_PER_PAGE
                      ? 'calc(2rem + 1.75rem + 0.5rem)'
                      : '2rem',
                  }}
                >
                  <button
                    onClick={() => switchPostsView('all')}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer transition ${
                      postsView === 'all'
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-teal-600/50'
                    }`}
                  >
                    All Posts
                  </button>
                  <button
                    onClick={() => switchPostsView('top')}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer transition ${
                      postsView === 'top'
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-teal-600/50'
                    }`}
                  >
                    Top Posts
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'wins' && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Wins</h2>
                <div className="text-zinc-400">Wins coming soon...</div>
              </div>
            )}

            {/* ======================== INVENTORY TAB ======================== */}
            {activeTab === 'inventory' && isOwnProfile && (
              <div>
                <h2 className="text-3xl font-bold mb-6">Inventory</h2>

                {(['Backgrounds', 'Avatars', 'Titles', 'Treasures'] as const).map((section) => (
                  <div key={section} className="mb-6">
                    <h3 className="text-center text-lg font-bold text-zinc-200 mb-3">{section}</h3>
                    <div className="flex gap-3 justify-center">
                      {inventoryPlaceholders.map((_, i) => (
                        <div
                          key={i}
                          className="w-16 h-16 rounded-xl flex-shrink-0"
                          style={{ backgroundColor: '#d4b896', opacity: 0.6 }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
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
                  className="bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 hover:border-orange-400 cursor-pointer"
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
              className="mt-5 w-full bg-zinc-700 hover:bg-zinc-600 rounded-xl py-2 cursor-pointer transition"
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
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white cursor-pointer"
              >
                <option value="small">Small (200px)</option>
                <option value="medium">Medium (400px)</option>
                <option value="large">Large (Full width)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowImageModal(false); setImageUrl(''); setEditImageEl(null) }}
                className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition"
              >Cancel</button>
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-[420px]">
            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Image src="/link.png" alt="Link" width={20} height={20} />
              {editLinkEl ? 'Edit Link' : 'Insert Link'}
            </h2>
            {!editLinkEl && (
              <p className="text-xs text-zinc-400 mb-4">
                Highlight text in the editor before clicking this button to turn it into a link.
              </p>
            )}
            {editLinkEl && (
              <p className="text-xs text-zinc-400 mb-4">Update the URL below, or clear it to remove the link.</p>
            )}
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') insertLink() }}
              placeholder="https://example.com"
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={closeLinkModal} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition">Cancel</button>
              {editLinkEl && (
                <button
                  onClick={() => { const text = document.createTextNode(editLinkEl.innerText); editLinkEl.replaceWith(text); closeLinkModal() }}
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold cursor-pointer transition"
                >Remove</button>
              )}
              <button onClick={insertLink} className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition">
                {editLinkEl ? 'Update' : 'Insert'}
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
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white cursor-pointer"
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
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-white cursor-pointer"
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
                Autoplay when profile is opened
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeYouTubeModal} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition">Cancel</button>
              <button onClick={insertYouTube} className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition">
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
          onMouseLeave={() => { deleteBtnImgRef.current = null; setDeleteBtn(null) }}
          onClick={() => deleteImage(deleteBtn.img)}
          style={{ position: 'fixed', top: deleteBtn.y, left: deleteBtn.x, zIndex: 9999 }}
          className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center shadow-lg cursor-pointer"
        >
          <Image src="/trash.png" alt="Delete" width={14} height={14} />
        </button>
      )}

    </main>
  )
}