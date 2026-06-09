"use client";

import localFont from "next/font/local";
import { useEffect } from "react";

const survivant = localFont({
  src: "/fonts/Survivant.ttf",
  variable: "--font-survivant",
});

export default function GamesPage() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = [
      "@keyframes pulseGlow {",
      "  0%, 100% { box-shadow: 0 0 16px 4px rgba(234, 179, 8, 0.6); }",
      "  50% { box-shadow: 0 0 32px 12px rgba(234, 179, 8, 0.95); }",
      "}",
      ".pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }",
    ].join("\n");
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
      <h1 className="text-5xl font-bold mb-16 tracking-widest uppercase text-center">
        Games
      </h1>

      <a
        href="/survivor"
        className="pulse-glow relative block w-80 h-80 rounded-2xl overflow-hidden"
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
        <div className="relative z-10 flex flex-col items-center justify-end h-full p-6">
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
            16 Castaways • 2 Crews • Social Strategy
          </p>
        </div>
      </a>
    </main>
  );
}