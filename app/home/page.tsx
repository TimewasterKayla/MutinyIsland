'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  const [posts, setPosts] = useState<any[]>([])
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({})
  const [showModal, setShowModal] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // -----------------------------
  // USER
  // -----------------------------
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      setCurrentUserId(user?.id || null)
      if (user) fetchLikedPosts(user.id)
    }
    getUser()
  }, [])

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
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // -----------------------------
  // CREATE POST
  // -----------------------------
  async function createPost() {
    if (!postTitle.trim() && !postContent.trim() && !imageUrl.trim()) return

    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user.id)
      .single()

    await supabase.from('posts').insert({
      title: postTitle || null,
      content: postContent,
      image_url: imageUrl || null,
      user_id: user.id,
      username: profile?.username || 'unknown',
      avatar: profile?.avatar || null,
      likes: 0,
    })

    setPostTitle('')
    setPostContent('')
    setImageUrl('')
    setShowModal(false)
    fetchPosts()
    setLoading(false)
  }

  // -----------------------------
  // DELETE POST
  // -----------------------------
  async function deletePost(postId: string) {
    await supabase.from('posts').delete().eq('id', postId)
    setPosts((p) => p.filter((x) => x.id !== postId))
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
              className="relative bg-zinc-900 p-4 rounded-xl border border-zinc-800"
            >

              {/* RIGHT SIDE STACK */}
              <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                <button
                  onClick={() => toggleLike(post)}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <span className="text-xl">{likedPosts[post.id] ? '❤️' : '🤍'}</span>
                  <span className="text-sm text-zinc-300">{post.likes || 0}</span>
                </button>

                {currentUserId === post.user_id && (
                  <button
                    onClick={() => deletePost(post.id)}
                    className="bg-red-600 hover:bg-red-500 p-2 rounded cursor-pointer"
                  >
                    🗑
                  </button>
                )}
              </div>

              {/* AVATAR + USER + DATE */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-700 border border-zinc-600 flex-shrink-0">
                  {post.avatar ? (
                    <Image
                      src={post.avatar}
                      alt={post.username}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-600" />
                  )}
                </div>
                <p className="text-sm text-zinc-400">
                  {post.username} • {formatDate(post.created_at)}
                </p>
              </div>

              {/* TITLE — clickable */}
              {post.title && (
                <button
                  onClick={() => router.push(`/posts/${post.id}`)}
                  className="text-left w-full pr-16"
                >
                  <h2 className="text-lg font-bold text-white hover:text-green-400 transition-colors leading-snug mb-1">
                    {post.title}
                  </h2>
                </button>
              )}

              {/* CONTENT PREVIEW — 3 lines max */}
              {post.content && (
                <p
                  className="text-zinc-300 text-sm pr-16"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.content}
                </p>
              )}

              {/* IMAGE PREVIEW */}
              {post.image_url && (
                <img
                  src={post.image_url}
                  className="mt-2 rounded border border-zinc-700 max-h-48 object-cover w-full"
                />
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

      {/* NEW POST MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl w-full max-w-md space-y-3">

            <h2 className="text-xl font-bold mb-1">New Post</h2>

            {/* TITLE INPUT */}
            <div>
              <input
                className="w-full p-3 bg-zinc-800 rounded border border-zinc-700 text-white placeholder-zinc-500"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value.slice(0, 80))}
                placeholder="Title (required)"
              />
              <div className="text-right text-xs text-zinc-500 mt-1">
                {postTitle.length}/80
              </div>
            </div>

            <textarea
              className="w-full p-3 bg-zinc-800 rounded border border-zinc-700 text-white placeholder-zinc-500"
              rows={4}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="What's happening?"
            />

            <input
              className="w-full p-3 bg-zinc-800 rounded border border-zinc-700 text-white placeholder-zinc-500"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Image URL (optional)"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false)
                  setPostTitle('')
                  setPostContent('')
                  setImageUrl('')
                }}
                className="px-4 py-2 bg-zinc-700 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                disabled={loading || !postTitle.trim()}
                className="px-4 py-2 bg-green-500 text-black font-bold rounded cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  )
}