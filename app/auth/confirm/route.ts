import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.verifyOtp({
      type: type as 'email',
      token_hash,
    })

    if (!error) {
      return NextResponse.redirect(new URL('/home', req.url))
    }
  }

  return NextResponse.redirect(new URL('/?error=confirmation_failed', req.url))
}