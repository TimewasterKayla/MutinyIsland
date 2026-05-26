'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // -----------------------------
  // GET USER
  // -----------------------------
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setCurrentUserId(data.user?.id || null)
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

    if (!error && data) {
      setPosts(data)
    }
  }

  // -----------------------------
  // CREATE POST
  // -----------------------------
  async function createPost() {
    if (!postContent.trim() && !imageUrl.trim()) return

    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const { error } = await supabase.from('posts').insert({
      content: postContent,
      image_url: imageUrl || null,
      user_id: user.id,
      username: profile?.username || 'unknown',
      likes: 0,
    })

    if (!error) {
      setPostContent('')
      setImageUrl('')
      setShowModal(false)
      fetchPosts()
    }

    setLoading(false)
  }

  // -----------------------------
  // DELETE POST
  // -----------------------------
  async function deletePost(postId: string) {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    }
  }

  // -----------------------------
  // LIKE TOGGLE (simple version)
  // -----------------------------
  async function toggleLike(post: any) {
    const newLikes = (post.likes || 0) + 1

    const { error } = await supabase
      .from('posts')
      .update({ likes: newLikes })
      .eq('id', post.id)

    if (!error) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likes: newLikes } : p
        )
      )
    }
  }

  return (
    <main className="min-h-screen flex justify-center text-white bg-zinc-950">

      {/* CENTER COLUMN */}
      <div className="w-full max-w-2xl relative px-4 py-8">

        {/* TOP BAR */}
        <div className="flex justify-between items-center mb-6">

          <h1 className="text-3xl font-bold">Mutiny Island</h1>

          <button
            onClick={() => setShowModal(true)}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-lg cursor-pointer transition"
          >
            New Post
          </button>

        </div>

        {/* FEED */}
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="relative bg-zinc-900 p-4 rounded-xl border border-zinc-800"
            >

              {/* DELETE */}
              {currentUserId === post.user_id && (
                <button
                  onClick={() => deletePost(post.id)}
                  className="absolute top-3 right-12 bg-red-600 hover:bg-red-500 rounded-lg p-2 cursor-pointer"
                >
                  <img src="/trash.png" className="w-4 h-4" />
                </button>
              )}

              {/* LIKE BUTTON */}
              <button
                onClick={() => toggleLike(post)}
                className="absolute top-3 right-3 flex items-center gap-1 cursor-pointer"
              >
                <span className="text-xl">
                  {post.liked ? '❤️' : '🤍'}
                </span>
                <span className="text-sm text-zinc-300">
                  {post.likes || 0}
                </span>
              </button>

              <p className="text-sm text-zinc-400 mb-2">
                {post.username}
              </p>

              {post.content && (
                <p className="mb-2">{post.content}</p>
              )}

              {post.image_url && (
                <img
                  src={post.image_url}
                  className="rounded-lg max-w-full mt-2 border border-zinc-700"
                />
              )}

            </div>
          ))}
        </div>

      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md space-y-4">

            <h2 className="text-xl font-bold">Create Post</h2>

            <textarea
              className="w-full p-3 rounded bg-zinc-800"
              placeholder="What's happening?"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
            />

            <input
              className="w-full p-3 rounded bg-zinc-800"
              placeholder="Image URL (optional)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />

            <div className="flex justify-end gap-2">

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-700 rounded cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={createPost}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-black font-bold rounded cursor-pointer"
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