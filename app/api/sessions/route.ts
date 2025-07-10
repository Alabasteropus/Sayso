import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all sessions for the user
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        *,
        images:images(count)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Sessions API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { 
      name, 
      aspect_ratio, 
      original_image_url, 
      original_image_description,
      current_image_description 
    } = await request.json()

    // Create new session
    const { data: session, error } = await supabase
      .from('sessions')
      .insert([
        {
          user_id: user.id,
          name: name || 'Untitled Session',
          aspect_ratio: aspect_ratio || '1:1',
          original_image_url,
          original_image_description,
          current_image_description,
          is_active: true
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    // Set all other sessions to inactive
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .neq('id', session.id)

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Sessions API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}