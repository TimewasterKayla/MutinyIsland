export default function HomePage() {
  return (
  <main className="min-h-screen flex justify-center text-white bg-zinc-950">

    {/* CENTER COLUMN */}
    <div className="w-full max-w-2xl relative px-4 py-8">

      {/* TOP BAR */}
      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">Mutiny Island</h1>

        <button
          className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-lg transition active:scale-95"
        >
          New Post
        </button>

      </div>

      {/* POST INPUT AREA (placeholder feed) */}
      <div className="space-y-4">

        {/* Example post card */}
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-2">User123</p>
          <p>This is an example post on Mutiny Island 🌊</p>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-2">CaptainRed</p>
          <p>Welcome to the island. First post!</p>
        </div>

      </div>

    </div>
  </main>
)
}