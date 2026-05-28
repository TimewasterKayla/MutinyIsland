export default function GamesPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-10">
      <h1 className="text-5xl font-bold mb-10">Games</h1>

      <a
        href="/survivor"
        className="block bg-zinc-900 p-8 rounded-2xl hover:bg-zinc-800 transition"
      >
        <h2 className="text-3xl font-bold">Castaway Cove</h2>
        <p className="text-zinc-400 mt-2">
          16 Castaways • 2 Crews • Social Strategy
        </p>
      </a>
    </main>
  )
}