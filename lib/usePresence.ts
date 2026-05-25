import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export function usePresence(userId: string | null) {
  useEffect(() => {
    if (!userId) return

    const updatePresence = async () => {
      await supabase.from("user_presence").upsert({
        user_id: userId,
        last_seen: new Date().toISOString(),
      })
    }

    updatePresence()
    const interval = setInterval(updatePresence, 30000)

    return () => clearInterval(interval)
  }, [userId])
}