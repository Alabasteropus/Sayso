import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const scriptId = params.id
    const updates = await request.json()

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify script ownership through project
    const { data: script, error: scriptError } = await supabase
      .from('scripts')
      .select(`
        id,
        project_id,
        film_projects!inner(user_id)
      `)
      .eq('id', scriptId)
      .eq('film_projects.user_id', user.id)
      .single()

    if (scriptError || !script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    // Update the script
    const { data: updatedScript, error } = await supabase
      .from('scripts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', scriptId)
      .select()
      .single()

    if (error) {
      console.error("Database error updating script:", error)
      return NextResponse.json({ 
        error: "Failed to update script", 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ script: updatedScript })
  } catch (error) {
    console.error("Update script error:", error)
    return NextResponse.json({ error: "Failed to update script" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const scriptId = params.id

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify script ownership through project
    const { data: script, error: scriptError } = await supabase
      .from('scripts')
      .select(`
        id,
        project_id,
        film_projects!inner(user_id)
      `)
      .eq('id', scriptId)
      .eq('film_projects.user_id', user.id)
      .single()

    if (scriptError || !script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    // Delete the script
    const { error } = await supabase
      .from('scripts')
      .delete()
      .eq('id', scriptId)

    if (error) {
      console.error("Database error deleting script:", error)
      return NextResponse.json({ 
        error: "Failed to delete script", 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete script error:", error)
    return NextResponse.json({ error: "Failed to delete script" }, { status: 500 })
  }
}