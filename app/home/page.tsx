'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [loading, setLoading] = useState(false)

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
    if (!postContent.trim()) return

    setLoading(true)

    const user = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.data.user?.id)
      .single()

    const { error } = await supabase.from('posts').insert({
      content: postContent,
      user_id: user.data.user?.id,
      username: profile?.username || 'unknown',
    })

    if (!error) {
      setPostContent('')
      setShowModal(false)
      fetchPosts()
    }

    setLoading(false)
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
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-lg transition active:scale-95"
          >
            New Post
          </button>

        </div>

        {/* FEED */}
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"
            >
              <p className="text-sm text-zinc-400 mb-2">
                {post.username}
              </p>
              <p>{post.content}</p>
            </div>
          ))}
        </div>

      </div>

      {/* -----------------------------
          NEW POST MODAL
      ----------------------------- */}
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

            <div className="flex justify-end gap-2">

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={createPost}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-black font-bold rounded disabled:opacity-50"
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