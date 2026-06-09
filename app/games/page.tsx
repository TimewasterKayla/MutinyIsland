"use client";

import localFont from "next/font/local";

const survivant = localFont({
  src: "../../public/fonts/Survivant.ttf",
  variable: "--font-survivant",
});

export default function GamesPage() {
  return (
    <main
      className={`${survivant.variable} min-h-screen text-white flex flex-col items-center p-10`}
      style={{
        backgroundImage: "url('/gamesbackground.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <h1
        className="text-8xl font-bold mb-16 tracking-widest uppercase text-center"
        style={{ fontFamily: "var(--font-survivant)" }}
      >
        Games
      </h1>

      <a
        href="/survivor"
        className="relative block w-64 h-64 rounded-2xl overflow-hidden transition-transform duration-200 hover:scale-110"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/castawaycove.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
          <h2
            className="text-4xl font-bold text-white text-center"
            style={{
              fontFamily: "var(--font-survivant)",
              textShadow: "2px 4px 8px rgba(0,0,0,0.9)",
            }}
          >
            Castaway Cove
          </h2>
          <p
            className="text-zinc-200 mt-2 text-center text-sm"
            style={{ textShadow: "1px 2px 6px rgba(0,0,0,0.9)" }}
          >
            18 Castaways • 2 Crews • Social Strategy
          </p>
        </div>
      </a>
    </main>
  );
}