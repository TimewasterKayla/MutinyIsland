const shops = [
  {
    name: "Mepole's Mischief",
    theme: {
      bg: "linear-gradient(155deg, #2a1a3d 0%, #1c1024 55%, #0d0712 100%)",
      border: "#c9a227",
      glow: "rgba(168, 85, 247, 0.35)",
      text: "#e9c75f",
      accent: "#a855f7",
    },
  },
  {
    name: "Richard's Rankups",
    theme: {
      bg: "linear-gradient(155deg, #1e3a6e 0%, #142850 55%, #0a1530 100%)",
      border: "#c7ccd6",
      glow: "rgba(148, 178, 230, 0.35)",
      text: "#dfe4ee",
      accent: "#9fb4d9",
    },
  },
  {
    name: "Patty's Potions",
    theme: {
      bg: "linear-gradient(155deg, #1c3a25 0%, #14291b 55%, #0a160f 100%)",
      border: "#c9a227",
      glow: "rgba(74, 222, 128, 0.3)",
      text: "#e9c75f",
      accent: "#4ade80",
    },
  },
  {
    name: "Victoria's VIP Badges",
    theme: {
      bg: "linear-gradient(155deg, #3d1414 0%, #2a0d0d 55%, #150606 100%)",
      border: "#e3b23c",
      glow: "rgba(227, 178, 60, 0.35)",
      text: "#f1d27a",
      accent: "#dc2626",
    },
  },
  {
    name: "Player Shops",
    theme: {
      bg: "linear-gradient(155deg, #3e2b1a 0%, #2c1f13 55%, #190f08 100%)",
      border: "#9fb4c2",
      glow: "rgba(159, 180, 194, 0.3)",
      text: "#d8c7ad",
      accent: "#a9c4d4",
    },
  },
  {
    name: "Davy's Doubloons",
    theme: {
      bg: "linear-gradient(155deg, #1a1a1a 0%, #0f0f0f 55%, #050505 100%)",
      border: "#d4af37",
      glow: "rgba(212, 175, 55, 0.4)",
      text: "#e6c869",
      accent: "#d4af37",
    },
  },
  {
    name: "Cassidy's Cosmetics",
    theme: {
      bg: "linear-gradient(155deg, #3a1f4d 0%, #281335 55%, #140a1c 100%)",
      border: "#e7e2d8",
      glow: "rgba(231, 226, 216, 0.3)",
      text: "#f2efe9",
      accent: "#c9a227",
    },
  },
]

export default function ShopPage() {
  return (
    <main
      className="min-h-screen p-10 text-white"
      style={{
        backgroundImage: "url('/shoppage.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <h1
        className="text-5xl font-bold text-center"
        style={{
          fontFamily: "Survivant, serif",
          textShadow: "0 2px 8px rgba(0,0,0,1), 0 1px 2px rgba(0,0,0,1)",
        }}
      >
        Shops
      </h1>

      <div className="max-w-5xl mx-auto mt-10 flex flex-wrap justify-center gap-5">
        {shops.map((shop) => (
          <button
            key={shop.name}
            className="group relative aspect-square rounded-2xl p-4 flex items-center justify-center text-center cursor-pointer transition-transform duration-200 hover:-translate-y-1 w-[44%] sm:w-[30%] lg:w-[22%]"
            style={{
              background: shop.theme.bg,
              border: `2px solid ${shop.theme.border}`,
              boxShadow: `0 10px 25px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 28px ${shop.theme.glow}`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{
                boxShadow: `0 0 36px ${shop.theme.glow}`,
              }}
            />
            <span
              className="relative text-lg font-bold leading-snug"
              style={{
                fontFamily: "Survivant, serif",
                color: shop.theme.text,
                textShadow: "0 2px 6px rgba(0,0,0,0.8)",
              }}
            >
              {shop.name}
            </span>
            <span
              aria-hidden
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full"
              style={{ backgroundColor: shop.theme.accent }}
            />
          </button>
        ))}
      </div>
    </main>
  )
}