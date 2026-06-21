import type { Metadata } from "next"
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
      <head>
        <meta name="viewport" content="width=1280, initial-scale=0.5" />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white">
        <LayoutClient>
          <main className="flex-1">{children}</main>
        </LayoutClient>
      </body>
    </html>
  )
}