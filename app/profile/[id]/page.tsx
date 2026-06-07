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

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  title: string
  body: string
  read: boolean
  created_at: string
  sender_username?: string
}

type TabType = 'about' | 'inbox' | 'posts' | 'friends' | 'wins' | 'inventory'

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
  const [openMessage, setOpenMessage] = useState<Message | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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
    if (user) setCurrentUserId(user.id)

    setActiveTab((prev: TabType) => {
      if (!own && (prev === 'inbox' || prev === 'inventory')) return 'about'
      return prev
    })

    setLoading(false)
  }

  // -----------------------------
  // LOAD MESSAGES (own profile only)
  // -----------------------------
  useEffect(() => {
    if (!isOwnProfile || !currentUserId) return
    loadMessages()

    // Realtime subscription for new messages
    const channel = supabase
      .channel('inbox-' + currentUserId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
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
      .order('created_at', { ascending: false })

    if (error) { console.error(error); return }

    const msgs: Message[] = (data || []).map((m: any) => ({
      ...m,
      sender_username: m.profiles?.username ?? 'Unknown',
    }))

    setMessages(msgs)
    setUnreadCount(msgs.filter((m) => !m.read).length)
  }

  async function markMessageRead(msg: Message) {
    if (msg.read) return
    await supabase.from('inbox_messages').update({ read: true }).eq('id', msg.id)
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  async function sendMessage() {
    if (!composeRecipient.trim() || !composeTitle.trim() || !composeBody.trim()) return
    setComposeSending(true)
    setRecipientError('')

    // Look up recipient
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

    const { error: sendErr } = await supabase.from('inbox_messages').insert({
      sender_id: currentUserId,
      recipient_id: recipientProfile.id,
      title: composeTitle.trim().slice(0, 60),
      body: composeBody.trim(),
      read: false,
    })

    if (sendErr) {
      console.error(sendErr)
      alert('Failed to send message.')
      setComposeSending(false)
      return
    }

    setComposeSending(false)
    setShowCompose(false)
    setComposeRecipient('')
    setComposeTitle('')
    setComposeBody('')
    setRecipientError('')
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
                className={`relative px-3 py-1 text-xs rounded-t-md border border-zinc-700 transition capitalize cursor-pointer ${
                  activeTab === tab
                    ? 'bg-green-500 text-black font-bold'
                    : 'bg-green-200 text-black hover:bg-green-300'
                }`}
              >
                {tab}
                {/* Unread badge on inbox tab */}
                {tab === 'inbox' && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none z-20">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-2xl p-6 min-h-[550px] relative overflow-hidden">

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
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs font-bold cursor-pointer"
                      >
                        B
                      </button>

                      {/* ITALIC */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); exec('italic') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-xs italic cursor-pointer"
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
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Insert image"
                      >
                        <Image src="/picture.png" alt="img" width={14} height={14} />
                      </button>

                      {/* LINK */}
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

                      {/* ALIGN LEFT */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('left') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Align left"
                      >
                        <Image src="/left.png" alt="left" width={14} height={14} />
                      </button>

                      {/* ALIGN CENTER */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('center') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
                        title="Align center"
                      >
                        <Image src="/center.png" alt="center" width={14} height={14} />
                      </button>

                      {/* ALIGN RIGHT */}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleAlign('right') }}
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
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
                        className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center cursor-pointer"
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
                    }}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-white font-bold px-4 py-2 rounded-xl cursor-pointer transition shadow-md"
                  >
                    New Message
                    <span className="text-lg leading-none font-bold">+</span>
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
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {!msg.read && (
                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          )}
                          <button
                            onClick={() => {
                              setOpenMessage(msg)
                              markMessageRead(msg)
                            }}
                            className="text-white underline hover:text-green-400 transition text-left truncate cursor-pointer font-medium"
                          >
                            {msg.title}
                          </button>
                        </div>
                        <div className="text-xs text-zinc-500 flex-shrink-0">
                          from <span className="text-zinc-300">{msg.sender_username}</span>
                          {' · '}
                          {new Date(msg.created_at).toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: '2-digit',
                          })}
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
                        ← Back
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

                    <div className="flex-1 flex flex-col mb-4">
                      <label className="text-xs text-zinc-400 block mb-1">Message</label>
                      <textarea
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Write your message..."
                        className="flex-1 w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white outline-none focus:border-green-500 transition resize-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={sendMessage}
                        disabled={composeSending || !composeRecipient.trim() || !composeTitle.trim() || !composeBody.trim()}
                        className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-6 py-2 rounded-xl cursor-pointer transition"
                      >
                        {composeSending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ---- VIEW MESSAGE OVERLAY ---- */}
                {openMessage && (
                  <div className="absolute inset-0 bg-zinc-900 rounded-2xl p-6 z-20 flex flex-col">
                    <div className="flex items-center gap-3 mb-5">
                      <button
                        onClick={() => setOpenMessage(null)}
                        className="bg-yellow-500 hover:bg-yellow-400 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer transition text-sm"
                      >
                        ← Back
                      </button>
                      <div>
                        <h2 className="text-xl font-bold">{openMessage.title}</h2>
                        <p className="text-xs text-zinc-400">
                          From <span className="text-zinc-200">{openMessage.sender_username}</span>
                          {' · '}
                          {new Date(openMessage.created_at).toLocaleString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 bg-zinc-800 rounded-xl p-4 text-white overflow-y-auto whitespace-pre-wrap border border-zinc-700">
                      {openMessage.body}
                    </div>
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

            {activeTab === 'posts' && (
              <div>
                <h2 className="text-3xl font-bold mb-4">Posts</h2>
                <div className="text-zinc-400">Posts coming soon...</div>
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
                onClick={() => {
                  setShowImageModal(false)
                  setImageUrl('')
                  setEditImageEl(null)
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition"
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
              <p className="text-xs text-zinc-400 mb-4">
                Update the URL below, or clear it to remove the link.
              </p>
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
              <button
                onClick={closeLinkModal}
                className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition"
              >
                Cancel
              </button>

              {editLinkEl && (
                <button
                  onClick={() => {
                    const text = document.createTextNode(editLinkEl.innerText)
                    editLinkEl.replaceWith(text)
                    closeLinkModal()
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold cursor-pointer transition"
                >
                  Remove
                </button>
              )}

              <button
                onClick={insertLink}
                className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition"
              >
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
              <button
                onClick={closeYouTubeModal}
                className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded cursor-pointer transition"
              >
                Cancel
              </button>

              <button
                onClick={insertYouTube}
                className="bg-green-500 hover:bg-green-400 text-black px-4 py-1 rounded font-bold cursor-pointer transition"
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
          className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center shadow-lg cursor-pointer"
        >
          <Image src="/trash.png" alt="Delete" width={14} height={14} />
        </button>
      )}

    </main>
  )
}