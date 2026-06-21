import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import LayoutClient from "@/components/LayoutClient"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Mutiny Island",
  description: "A multiplayer Survivor-style game simulator",
}

export const viewport: Viewport = {
  width: 1280,
  initialScale: 0.5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        <LayoutClient>
          <main className="flex-1">{children}</main>
        </LayoutClient>
      </body>
    </html>
  )
}