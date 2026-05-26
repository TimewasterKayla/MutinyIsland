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
  // POSTS
  // -----------------------------
  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('FETCH ERROR:', error)
      return
    }

    setPosts(data || [])
  }

  // -----------------------------
  // CREATE POST (FIXED)
  // -----------------------------
  async function createPost() {
    if (!postContent.trim() && !imageUrl.trim()) return

    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      alert('Not logged in')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(profileError)
    }

    const { error } = await supabase.from('posts').insert({
      content: postContent,
      image_url: imageUrl || null,
      user_id: user.id,
      username: profile?.username || 'unknown',
      likes: 0,
    })

    if (error) {
      console.error('POST ERROR:', error)
      alert(error.message)
      setLoading(false)
      return
    }

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
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      console.error('DELETE ERROR:', error)
      return
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  // -----------------------------
  // LIKE (FIXED UPDATE FLOW)
  // -----------------------------
  async function toggleLike(post: any) {
    const newLikes = (post.likes || 0) + 1

    const { error } = await supabase
      .from('posts')
      .update({ likes: newLikes })
      .eq('id', post.id)

    if (error) {
      console.error('LIKE ERROR:', error)
      alert(error.message)
      return
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, likes: newLikes } : p
      )
    )
  }

  // -----------------------------
  // DATE FORMAT
  // -----------------------------
  function formatDate(dateString: string) {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <main className="min-h-screen flex justify-center text-white bg-zinc-950">

      <div className="w-full max-w-2xl px-4 py-8">

        {/* TOP */}
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

              {/* DELETE */}
              {currentUserId === post.user_id && (
                <button
                  onClick={() => deletePost(post.id)}
                  className="absolute top-3 right-12 bg-red-600 p-2 rounded cursor-pointer"
                >
                  🗑
                </button>
              )}

              {/* LIKE */}
              <button
                onClick={() => toggleLike(post)}
                className="absolute top-3 right-3 flex items-center gap-1 cursor-pointer"
              >
                🤍 <span>{post.likes || 0}</span>
              </button>

              {/* USER */}
              <p className="text-sm text-zinc-400 mb-2">
                {post.username} • {formatDate(post.created_at)}
              </p>

              {/* CONTENT */}
              {post.content && <p>{post.content}</p>}

              {/* IMAGE */}
              {post.image_url && (
                <img
                  src={post.image_url}
                  className="mt-2 rounded border border-zinc-700"
                />
              )}

            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md space-y-3">

            <textarea
              className="w-full p-3 bg-zinc-800 rounded"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="What's happening?"
            />

            <input
              className="w-full p-3 bg-zinc-800 rounded"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Image URL"
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