"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MapPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data?.is_admin) {
        setIsAdmin(true);
      }
    }

    checkAdmin();
  }, []);

  type Location = {
    label: string;
    top: string;
    left: string;
    rotate: string;
    icon: string;
    href?: string;
  }

  const locations: Location[] = [
    {
      label: "Events",
      top: "12%",
      left: "18%",
      rotate: "-4deg",
      icon: "/events.png",
    },
    {
      label: "Gem Mine",
      top: "58%",
      left: "8%",
      rotate: "3deg",
      icon: "/gemmine.png",
    },
    {
      label: "Player Shops",
      top: "20%",
      left: "60%",
      rotate: "2deg",
      icon: "/playershops.png",
    },
    {
      label: "Guild Hall",
      top: "65%",
      left: "55%",
      rotate: "-3deg",
      icon: "/guildhall.png",
    },
    {
      label: "Throne Room",
      top: "38%",
      left: "35%",
      rotate: "1deg",
      icon: "/throne.png",
    },
    ...(isAdmin
      ? [
          {
            label: "Admin Cave",
            top: "68%",
            left: "30%",
            rotate: "-2deg",
            icon: "/cave.png",
            href: "/admin-cave",
          },
        ]
      : []),
  ];

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundImage: "url('/worldmap.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
      }}
    >
      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {locations.map((loc) => (
        <div
          key={loc.label}
          style={{
            position: "absolute",
            top: loc.top,
            left: loc.left,
            transform: `rotate(${loc.rotate})`,
            width: "260px",
            zIndex: 10,
            transition: "transform 0.18s ease, filter 0.18s ease",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = `rotate(${loc.rotate}) scale(1.07)`;
            const icon = el.querySelector<HTMLImageElement>("[data-loc-icon]");
            const banner = el.querySelector<HTMLButtonElement>("[data-banner]");
            if (icon) icon.style.filter = "drop-shadow(0 8px 14px rgba(0,0,0,0.85)) brightness(1.12)";
            if (banner) banner.style.filter = "drop-shadow(0 6px 18px rgba(0,0,0,0.75)) brightness(1.12)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = `rotate(${loc.rotate}) scale(1)`;
            const icon = el.querySelector<HTMLImageElement>("[data-loc-icon]");
            const banner = el.querySelector<HTMLButtonElement>("[data-banner]");
            if (icon) icon.style.filter = "drop-shadow(0 5px 10px rgba(0,0,0,0.7))";
            if (banner) banner.style.filter = "drop-shadow(0 4px 10px rgba(0,0,0,0.6))";
          }}
        >
          {/* ICON */}
          <img
            data-loc-icon
            src={loc.icon}
            alt=""
            style={{
              display: "block",
              width: "120px",
              margin: "0 auto",
              marginBottom: "-30px",
              position: "relative",
              zIndex: 1,
              filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.7))",
              transition: "filter 0.18s ease",
              pointerEvents: "none",
            }}
          />

          {/* BANNER */}
          <button
            data-banner
            onClick={() => { if (loc.href) router.push(loc.href) }}
            style={{
              position: "relative",
              zIndex: 2,
              width: "260px",
              height: "110px",
              backgroundImage: "url('/banner.png')",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              border: "none",
              backgroundColor: "transparent",
              cursor: loc.href ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: "18px",
              transition: "filter 0.18s ease",
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
            }}
          >
            <span
              style={{
                fontSize: "17px",
                fontWeight: "700",
                color: "#3b2200",
                letterSpacing: "0.06em",
                textShadow: "0 1px 2px rgba(255,230,160,0.35)",
                userSelect: "none",
                marginTop: "-10px",
              }}
            >
              {loc.label}
            </span>
          </button>
        </div>
      ))}
    </main>
  );
}