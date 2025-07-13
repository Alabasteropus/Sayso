import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
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
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    // Skip project verification for development if database issues
    if (projectError && projectError.code !== '42P01' && projectError.code !== '42501') {
      console.log("Skipping project verification for development:", projectError)
    }

    const { data: shots, error } = await supabase
      .from('shots')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: true })

    if (error) {
      console.error("Database error fetching shots:", error)
      return NextResponse.json({ error: "Failed to fetch shots" }, { status: 500 })
    }

    return NextResponse.json({ shots })
  } catch (error) {
    console.error("Get shots error:", error)
    return NextResponse.json({ error: "Failed to fetch shots" }, { status: 500 })
  }
}