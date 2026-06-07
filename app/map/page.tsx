"use client";

export default function MapPage() {
  const locations = [
    {
      label: "Pet House",
      top: "12%",
      left: "18%",
      rotate: "-4deg",
    },
    {
      label: "Gem Mine",
      top: "58%",
      left: "8%",
      rotate: "3deg",
    },
    {
      label: "Player Shops",
      top: "20%",
      left: "60%",
      rotate: "2deg",
    },
    {
      label: "Guild Hall",
      top: "65%",
      left: "55%",
      rotate: "-3deg",
    },
    {
      label: "Throne Room",
      top: "38%",
      left: "35%",
      rotate: "1deg",
    },
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
      {/* Vignette overlay for depth */}
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
        <button
          key={loc.label}
          style={{
            position: "absolute",
            top: loc.top,
            left: loc.left,
            transform: `rotate(${loc.rotate})`,
            width: "260px",
            height: "110px",
            backgroundImage: "url('/banner.png')",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // The banner text sits in the upper arc — nudge text upward slightly
            paddingBottom: "18px",
            transition: "transform 0.18s ease, filter 0.18s ease",
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = `rotate(${loc.rotate}) scale(1.07)`;
            el.style.filter =
              "drop-shadow(0 6px 18px rgba(0,0,0,0.75)) brightness(1.12)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = `rotate(${loc.rotate}) scale(1)`;
            el.style.filter = "drop-shadow(0 4px 10px rgba(0,0,0,0.6))";
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
              // Fine-tune vertical alignment to the flat text zone of banner
              marginTop: "-10px",
            }}
          >
            {loc.label}
          </span>
        </button>
      ))}
    </main>
  );
}