import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get authenticated user (allow null for development)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    let userId = user?.id
    
    // If no authenticated user, use a default user ID for development
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000' // Default dev user
    }
    
    const { data: projects, error } = await supabase
      .from('film_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Database error fetching projects:", error)
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
    }

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("Get projects error:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { title, description, genre } = await request.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Get authenticated user (allow null for development)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    let userId = user?.id
    
    // If no authenticated user, use a default user ID for development
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000' // Default dev user
    }

    const { data: project, error } = await supabase
      .from('film_projects')
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description?.trim(),
        genre: genre?.trim(),
        status: 'draft'
      })
      .select()
      .single()

    if (error) {
      console.error("Database error creating project:", error)
      return NextResponse.json({ 
        error: "Failed to create project", 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Create project error:", error)
    return NextResponse.json({ 
      error: "Failed to create project", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}