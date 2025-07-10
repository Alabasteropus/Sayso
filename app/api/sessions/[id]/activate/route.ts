import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Set all sessions to inactive first
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)

    // Activate the selected session
    const { data: session, error } = await supabase
      .from('sessions')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error activating session:', error)
      return NextResponse.json({ error: "Failed to activate session" }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Session activation API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}