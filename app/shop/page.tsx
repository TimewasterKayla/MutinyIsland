export default function ShopPage() {
  return (
    <main
      className="min-h-screen p-10 text-white"
      style={{
        backgroundImage: "url('/shoppage.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <h1 className="text-3xl font-bold">Shop</h1>
      <p className="text-zinc-400 mt-2">
        Buy advantages and cosmetics (coming soon).
      </p>
    </main>
  )
}