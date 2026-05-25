'use client'

import { usePathname } from "next/navigation"
import Navbar from "@/components/navbar"

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const hideNavbar = pathname === "/"

  return (
    <>
      {!hideNavbar && <Navbar />}
      {children}
    </>
  )
}