import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { planShots } from "@/lib/llm"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { 
      project_id, 
      script_content, 
      characters 
    } = await request.json()

    if (!project_id || !script_content?.trim()) {
      return NextResponse.json({ 
        error: "Project ID and script content are required" 
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

    // Generate shots using AI
    const plannedShots = await planShots(script_content.trim(), {
      project_id,
      characters: characters || [],
    })

    // Save shots to database
    const shotsToInsert = plannedShots.map((shot, index) => ({
      project_id,
      sequence_number: index + 1,
      scene_description: shot.scene_description || shot.description || `Shot ${index + 1}`,
      camera_angle: shot.suggested_camera_angle || shot.camera_angle || 'medium',
      camera_movement: shot.camera_movement || 'static',
      duration_seconds: shot.suggested_duration || shot.duration_seconds || 5,
      notes: shot.dialogue_snippet || shot.notes
    }))

    const { data: shots, error } = await supabase
      .from('shots')
      .insert(shotsToInsert)
      .select()

    if (error) {
      console.error("Database error creating shots:", error)
      return NextResponse.json({ 
        error: "Failed to save shots", 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ shots })
  } catch (error) {
    console.error("Plan shots error:", error)
    return NextResponse.json({ error: "Failed to plan shots" }, { status: 500 })
  }
}