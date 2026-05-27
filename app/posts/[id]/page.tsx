'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

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
  const [isLiked, setIsLiked] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // -----------------------------
  // PARAMS
  // -----------------------------
  useEffect(() => {
    Promise.resolve(params).then((p) => setPostId(p.id))
  }, [params])

  // -----------------------------
  // USER
  // -----------------------------
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setCurrentUserId(data.user?.id || null)
    }
    getUser()
  }, [])

  // -----------------------------
  // FETCH POST
  // -----------------------------
  useEffect(() => {
    if (!postId) return
    fetchPost()
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
    if (!editTitle.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('posts')
      .update({ title: editTitle, content: editContent })
      .eq('id', post.id)
    if (!error) {
      setPost({ ...post, title: editTitle, content: editContent })
      setEditing(false)
    }
    setSaving(false)
  }

  // -----------------------------
  // FORMAT DATE
  // -----------------------------
  function formatDate(dateString: string) {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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

            {/* LIKE + OWNER BUTTONS */}
            <div className="flex items-center gap-3">
              <button onClick={toggleLike} className="flex items-center gap-1 cursor-pointer">
                <span className="text-xl">{isLiked ? '❤️' : '🤍'}</span>
                <span className="text-sm text-zinc-300">{post.likes || 0}</span>
              </button>

              {isOwner && !editing && (
                <>
                  <button
                    onClick={() => {
                      setEditTitle(post.title || '')
                      setEditContent(post.content || '')
                      setEditing(true)
                    }}
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

              {isOwner && editing && (
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
                <h1 className="text-3xl font-bold text-white mb-5 leading-snug">
                  {post.title}
                </h1>
              )}
              {post.content && (
                <div
                  className="text-zinc-200 leading-relaxed prose-invert"
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
              <textarea
                className="w-full p-3 bg-zinc-800 rounded-xl border border-zinc-700 text-white placeholder-zinc-500 min-h-[300px] resize-y"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Post content..."
              />
              <p className="text-xs text-zinc-500">
                Note: editing replaces rich content with plain text.
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}