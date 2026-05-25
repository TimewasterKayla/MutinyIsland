import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import { usePathname } from "next/navigation"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Survivor Simulator",
  description: "A multiplayer Survivor-style game simulator",
}

function LayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Hide navbar on login/home page
  const hideNavbar = pathname === "/"

  return (
    <>
      {!hideNavbar && <Navbar />}

      <main className="flex-1">
        {children}
      </main>
    </>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  )
}