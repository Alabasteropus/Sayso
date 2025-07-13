import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createCharacterWithImage } from "@/lib/fal-ai"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const { data: characters, error } = await supabase
      .from('characters')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ characters })
  } catch (error) {
    console.error("Get characters error:", error)
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { 
      project_id, 
      name, 
      description, 
      visual_description, 
      personality_traits, 
      backstory 
    } = await request.json()

    if (!project_id || !name?.trim() || !description?.trim()) {
      return NextResponse.json({ 
        error: "Project ID, name, and description are required" 
      }, { status: 400 })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('film_projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Create character with image
    const character = await createCharacterWithImage({
      project_id,
      name: name.trim(),
      description: description.trim(),
      visual_description: visual_description?.trim() || description.trim(),
      personality_traits: personality_traits || [],
      backstory: backstory?.trim(),
    })

    return NextResponse.json({ character })
  } catch (error) {
    console.error("Create character error:", error)
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 })
  }
}