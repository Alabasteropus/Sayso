import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { generateScript } from "@/lib/llm"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { 
      project_id, 
      prompt, 
      characters, 
      genre, 
      target_duration 
    } = await request.json()

    if (!project_id || !prompt?.trim()) {
      return NextResponse.json({ 
        error: "Project ID and prompt are required" 
      }, { status: 400 })
    }

    // Get authenticated user (allow null for development)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    let userId = user?.id
    
    // If no authenticated user, use a default user ID for development
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000' // Default dev user
    }

    // Try to verify project ownership, but skip for development if it fails
    const { data: project, error: projectError } = await supabase
      .from('film_projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single()

    // Skip project verification for development if database issues
    if (projectError && projectError.code !== '42P01' && projectError.code !== '42501') {
      console.log("Skipping project verification for development:", projectError)
    }

    // Generate script using AI
    const generatedScript = await generateScript({
      project_id,
      prompt: prompt.trim(),
      characters: characters || [],
      genre,
      target_duration,
    })

    // Save to database
    const { data: script, error } = await supabase
      .from('scripts')
      .insert({
        project_id,
        title: generatedScript.title,
        content: generatedScript.content,
        version: 1,
        character_count: generatedScript.character_count,
        estimated_duration: generatedScript.estimated_duration,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error creating script:", error)
      return NextResponse.json({ 
        error: "Failed to save script", 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ script })
  } catch (error) {
    console.error("Generate script error:", error)
    return NextResponse.json({ error: "Failed to generate script" }, { status: 500 })
  }
}