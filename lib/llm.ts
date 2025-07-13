import { GoogleGenerativeAI } from "@google/generative-ai"
import { 
  FilmProject, 
  Character, 
  Script, 
  Shot, 
  GenerateScriptRequest, 
  FilmAssistantRequest,
  FilmAssistantContext,
  ShotPlanningOptions,
  BreakdownShot
} from './types'
import { 
  breakScriptIntoShots, 
  generateProjectSummary, 
  estimateScriptDuration 
} from './film-utils'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// System prompts for different film tasks
const SCRIPT_GENERATION_PROMPT = `You are an expert screenwriter and film consultant. Generate detailed, professional film scripts with proper formatting and structure.

Guidelines for script generation:
- Use proper screenplay format with scene headers (INT./EXT. LOCATION - TIME)
- Include clear character introductions
- Write natural, engaging dialogue
- Add necessary action lines and stage directions
- Consider genre conventions and pacing
- Ensure scenes flow logically and build tension
- Include visual elements that translate well to film
- Keep descriptions concise but evocative

Format the script with:
- Scene headers in ALL CAPS
- Character names in ALL CAPS when speaking
- Action lines in present tense
- Dialogue properly indented
- Parentheticals sparingly used

Generate a complete, production-ready script.`

const CHARACTER_CREATION_PROMPT = `You are an expert character designer for film and television. Create detailed, memorable characters with distinct personalities and clear visual characteristics.

Guidelines for character creation:
- Develop unique, interesting personalities with clear motivations
- Create distinctive visual appearances that are memorable and filmable
- Include relevant backstory that informs character behavior
- Consider how the character serves the story
- Make characters feel authentic and three-dimensional
- Include specific physical details for consistent visual representation
- Consider character arcs and growth potential

Provide comprehensive character profiles suitable for film production.`

const SHOT_PLANNING_PROMPT = `You are an expert cinematographer and director. Analyze scripts and create detailed shot breakdowns for film production.

Guidelines for shot planning:
- Consider visual storytelling and emotional impact
- Plan appropriate camera angles for each scene's purpose
- Balance wide shots (establishing) with medium and close-ups
- Consider character focus and dialogue delivery
- Plan for smooth visual flow between shots
- Account for practical filming considerations
- Include variety in shot types to maintain engagement
- Consider lighting and composition needs

Create detailed shot lists suitable for professional film production.`

const FILM_ASSISTANT_PROMPT = `You are an AI assistant specialized in film production, helping creators with all aspects of filmmaking from concept to completion.

Your expertise includes:
- Script writing and story development
- Character creation and development
- Shot planning and cinematography
- Visual storytelling techniques
- Production planning and workflow
- Creative problem-solving
- Industry best practices

Provide helpful, actionable advice and assist with specific film production tasks. Be encouraging while maintaining professional standards.`

export async function generateScript(request: GenerateScriptRequest): Promise<Script> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    // Build context for script generation
    let contextInfo = ""
    if (request.characters && request.characters.length > 0) {
      contextInfo += "\nExisting Characters:\n"
      request.characters.forEach(char => {
        contextInfo += `- ${char.name}: ${char.description}\n`
        if (char.personality_traits && char.personality_traits.length > 0) {
          contextInfo += `  Personality: ${char.personality_traits.join(', ')}\n`
        }
      })
    }

    const genreContext = request.genre ? `\nGenre: ${request.genre}` : ""
    const durationContext = request.target_duration ? 
      `\nTarget Duration: ${request.target_duration} seconds (approximately ${Math.round(request.target_duration / 60)} minutes)` : ""

    const prompt = `${SCRIPT_GENERATION_PROMPT}

Project Brief: ${request.prompt}${genreContext}${durationContext}${contextInfo}

Generate a complete screenplay that incorporates the existing characters (if any) and matches the requested genre and duration. The script should be production-ready and properly formatted.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const scriptContent = response.text()

    // Calculate estimated duration and character count
    const estimatedDuration = estimateScriptDuration(scriptContent)
    const characterCount = request.characters ? request.characters.length : 0

    // Create script object (will be saved by the API route)
    const script: Script = {
      id: '', // Will be set by database
      project_id: request.project_id,
      title: extractScriptTitle(scriptContent) || 'Untitled Script',
      content: scriptContent,
      version: 1,
      character_count: characterCount,
      estimated_duration: estimatedDuration,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return script
  } catch (error) {
    console.error('Script generation error:', error)
    throw new Error(`Failed to generate script: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function generateCharacterDescription(
  name: string,
  basicDescription: string,
  projectContext?: string,
  genre?: string
): Promise<{
  visual_description: string
  personality_traits: string[]
  backstory: string
}> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const genreContext = genre ? `Genre: ${genre}` : ""
    const projectInfo = projectContext ? `Project Context: ${projectContext}` : ""

    const prompt = `${CHARACTER_CREATION_PROMPT}

Character Name: ${name}
Basic Description: ${basicDescription}
${genreContext}
${projectInfo}

Create a detailed character profile with:
1. Visual description (physical appearance, clothing style, distinctive features)
2. Personality traits (list 3-5 key traits)
3. Backstory (brief but informative background)

Format as JSON:
{
  "visual_description": "detailed physical appearance...",
  "personality_traits": ["trait1", "trait2", "trait3"],
  "backstory": "character background..."
}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()

    // Parse JSON response
    try {
      const parsed = JSON.parse(responseText)
      return {
        visual_description: parsed.visual_description,
        personality_traits: parsed.personality_traits || [],
        backstory: parsed.backstory,
      }
    } catch (parseError) {
      // Fallback parsing if JSON is malformed
      console.warn('JSON parsing failed, using fallback parsing')
      return {
        visual_description: responseText.split('\n')[0] || basicDescription,
        personality_traits: ['mysterious', 'determined'],
        backstory: 'A character with an intriguing past.',
      }
    }
  } catch (error) {
    console.error('Character description generation error:', error)
    throw new Error(`Failed to generate character description: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function planShots(
  scriptContent: string,
  options: ShotPlanningOptions
): Promise<BreakdownShot[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    const characterContext = options.characters && options.characters.length > 0 ? 
      `\nCharacters: ${options.characters.map(c => `${c.name} - ${c.description}`).join('; ')}` : ""

    const shotPreferences = options.preferred_shot_types ? 
      `\nPreferred shot types: ${options.preferred_shot_types.join(', ')}` : ""

    const targetCount = options.target_shot_count || 20

    const prompt = `${SHOT_PLANNING_PROMPT}

Script to analyze:
${scriptContent}${characterContext}${shotPreferences}

Target number of shots: ${targetCount}
Include character close-ups: ${options.include_character_close_ups ? 'Yes' : 'No'}

Create a detailed shot breakdown. For each shot, provide:
1. Sequence number
2. Scene description
3. Suggested camera angle (wide, medium, close-up, extreme-close-up, overhead, low-angle, high-angle)
4. Estimated duration in seconds
5. Characters mentioned in the shot
6. Any dialogue snippet if applicable

Focus on visual storytelling and ensuring smooth narrative flow.

Format as JSON array:
[
  {
    "sequence_number": 1,
    "scene_description": "description",
    "suggested_camera_angle": "wide",
    "suggested_duration": 5,
    "characters_mentioned": ["character_id_1"],
    "dialogue_snippet": "optional dialogue"
  }
]`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()

    try {
      const parsed = JSON.parse(responseText)
      return parsed.map((shot: any, index: number) => ({
        sequence_number: shot.sequence_number || index + 1,
        scene_description: shot.scene_description,
        suggested_camera_angle: shot.suggested_camera_angle || 'medium',
        suggested_duration: shot.suggested_duration || 5,
        characters_mentioned: shot.characters_mentioned || [],
        dialogue_snippet: shot.dialogue_snippet,
      }))
    } catch (parseError) {
      console.warn('JSON parsing failed for shot planning, using fallback')
      // Use the utility function as fallback
      return breakScriptIntoShots(scriptContent, options)
    }
  } catch (error) {
    console.error('Shot planning error:', error)
    // Fallback to utility function
    return breakScriptIntoShots(scriptContent, options)
  }
}

export async function getFilmAssistantResponse(request: FilmAssistantRequest): Promise<{
  response: string
  suggested_actions?: {
    type: 'create_character' | 'generate_script' | 'create_shot' | 'review_storyboard'
    description: string
    data?: any
  }[]
}> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Build comprehensive context
    const projectSummary = generateProjectSummary(
      request.context.project,
      request.context.characters,
      request.context.scripts,
      request.context.shots
    )

    const contextDetails = `
Current Project Status:
${projectSummary}

Current Task: ${request.context.currentTask || 'General assistance'}

Characters: ${request.context.characters.length} created
Scripts: ${request.context.scripts.length} written  
Shots: ${request.context.shots.length} planned/generated
`

    const prompt = `${FILM_ASSISTANT_PROMPT}

${contextDetails}

User Query: ${request.query}

Provide helpful assistance with this film production query. Consider the current project state and suggest specific next steps if appropriate.

If you suggest actionable next steps, include them in the response but keep the main response conversational and helpful.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()

    // Analyze response for suggested actions
    const suggestedActions = extractSuggestedActions(responseText, request.context)

    return {
      response: responseText,
      suggested_actions: suggestedActions.length > 0 ? suggestedActions : undefined,
    }
  } catch (error) {
    console.error('Film assistant error:', error)
    return {
      response: "I'm sorry, I encountered an error while processing your request. Please try again.",
    }
  }
}

export async function improveScript(
  script: Script,
  improvementRequest: string,
  context: FilmAssistantContext
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    const prompt = `${SCRIPT_GENERATION_PROMPT}

Current Script:
${script.content}

Improvement Request: ${improvementRequest}

Project Context:
- Genre: ${context.project.genre || 'Unspecified'}
- Characters: ${context.characters.map(c => `${c.name} - ${c.description}`).join('; ')}

Revise and improve the script based on the request. Maintain the overall structure while implementing the requested changes. Return the complete improved script.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Script improvement error:', error)
    throw new Error(`Failed to improve script: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility functions
function extractScriptTitle(scriptContent: string): string | null {
  const lines = scriptContent.split('\n')
  
  // Look for title in first few lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim()
    if (line.length > 0 && line.length < 50 && !line.startsWith('INT.') && !line.startsWith('EXT.')) {
      return line
    }
  }
  
  return null
}

function extractSuggestedActions(
  responseText: string,
  context: FilmAssistantContext
): Array<{
  type: 'create_character' | 'generate_script' | 'create_shot' | 'review_storyboard'
  description: string
  data?: any
}> {
  const actions: Array<{
    type: 'create_character' | 'generate_script' | 'create_shot' | 'review_storyboard'
    description: string
    data?: any
  }> = []

  const lower = responseText.toLowerCase()

  // Suggest character creation if mentioned and few characters exist
  if (lower.includes('character') && lower.includes('create') && context.characters.length < 3) {
    actions.push({
      type: 'create_character',
      description: 'Create a new character for your project',
    })
  }

  // Suggest script generation if mentioned and no scripts exist
  if (lower.includes('script') && lower.includes('write') && context.scripts.length === 0) {
    actions.push({
      type: 'generate_script',
      description: 'Generate a script for your project',
    })
  }

  // Suggest shot creation if script exists but few shots
  if (context.scripts.length > 0 && context.shots.length < 5) {
    if (lower.includes('shot') || lower.includes('storyboard')) {
      actions.push({
        type: 'create_shot',
        description: 'Create shots for your storyboard',
      })
    }
  }

  // Suggest storyboard review if many shots exist
  if (context.shots.length > 10) {
    if (lower.includes('review') || lower.includes('storyboard')) {
      actions.push({
        type: 'review_storyboard',
        description: 'Review your complete storyboard',
      })
    }
  }

  return actions
}