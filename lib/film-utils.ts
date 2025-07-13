import { Script, Character, Shot, BreakdownShot, ShotPlanningOptions } from './types'

// Script parsing and shot breakdown utilities
export function breakScriptIntoShots(
  scriptContent: string, 
  options: ShotPlanningOptions = {}
): BreakdownShot[] {
  const {
    characters = [],
    target_shot_count = 20,
    preferred_shot_types = ['wide', 'medium', 'close-up'],
    include_character_close_ups = true
  } = options

  // Split script into scenes and dialogue blocks
  const scenes = scriptContent
    .split(/(?=(?:INT\.|EXT\.|SCENE \d+|Scene \d+))/gi)
    .filter(scene => scene.trim().length > 0)

  const shots: BreakdownShot[] = []
  let sequenceNumber = 1

  scenes.forEach((scene, sceneIndex) => {
    const lines = scene.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) return

    // Extract scene header and setting
    const sceneHeader = lines[0]
    const isInterior = sceneHeader.toLowerCase().includes('int.')
    const sceneDescription = extractSceneDescription(lines)
    
    // Find character mentions in this scene
    const charactersInScene = findCharactersInScene(scene, characters)
    
    // Determine shot breakdown strategy based on scene length
    const dialogueLines = lines.filter(line => isDialogueLine(line))
    const actionLines = lines.filter(line => isActionLine(line))
    
    // Start with establishing shot
    shots.push({
      sequence_number: sequenceNumber++,
      scene_description: `${sceneHeader} - Establishing shot showing ${sceneDescription}`,
      suggested_camera_angle: 'wide',
      suggested_duration: 3,
      characters_mentioned: charactersInScene,
    })

    // Add shots for significant actions
    actionLines.forEach((actionLine, index) => {
      if (actionLine.length > 20) { // Only significant actions
        shots.push({
          sequence_number: sequenceNumber++,
          scene_description: actionLine.trim(),
          suggested_camera_angle: determineActionShotAngle(actionLine),
          suggested_duration: 4,
          characters_mentioned: findCharactersInLine(actionLine, characters),
        })
      }
    })

    // Add shots for dialogue exchanges
    let currentSpeaker: string | null = null
    dialogueLines.forEach((dialogueLine, index) => {
      const speaker = extractSpeaker(dialogueLine)
      if (speaker && speaker !== currentSpeaker) {
        currentSpeaker = speaker
        
        // Add character introduction shot if first time speaking
        const characterData = characters.find(c => 
          c.name.toLowerCase() === speaker.toLowerCase()
        )
        
        if (include_character_close_ups && characterData) {
          shots.push({
            sequence_number: sequenceNumber++,
            scene_description: `${speaker} speaking: ${extractDialogue(dialogueLine)}`,
            suggested_camera_angle: index < 2 ? 'medium' : 'close-up',
            suggested_duration: calculateDialogueDuration(dialogueLine),
            characters_mentioned: [characterData.id],
            dialogue_snippet: extractDialogue(dialogueLine),
          })
        }
      }
    })
  })

  // Optimize shot count if needed
  if (shots.length > target_shot_count) {
    return optimizeShotCount(shots, target_shot_count)
  }

  return shots
}

function extractSceneDescription(lines: string[]): string {
  const sceneSetup = lines.slice(1, 3).join(' ').trim()
  return sceneSetup || 'the scene'
}

function findCharactersInScene(scene: string, characters: Character[]): string[] {
  const characterIds: string[] = []
  const sceneLower = scene.toLowerCase()
  
  characters.forEach(character => {
    if (sceneLower.includes(character.name.toLowerCase())) {
      characterIds.push(character.id)
    }
  })
  
  return characterIds
}

function findCharactersInLine(line: string, characters: Character[]): string[] {
  const characterIds: string[] = []
  const lineLower = line.toLowerCase()
  
  characters.forEach(character => {
    if (lineLower.includes(character.name.toLowerCase())) {
      characterIds.push(character.id)
    }
  })
  
  return characterIds
}

function isDialogueLine(line: string): boolean {
  // Check if line starts with character name in caps or has dialogue format
  return /^[A-Z][A-Z\s]+$/.test(line.trim()) || 
         line.includes(':') ||
         /^\s*[A-Z]+\s*\n/.test(line)
}

function isActionLine(line: string): boolean {
  // Action lines are typically in present tense and describe what happens
  const trimmed = line.trim()
  return trimmed.length > 0 && 
         !isDialogueLine(line) &&
         !trimmed.startsWith('(') && // Not stage direction
         !trimmed.toLowerCase().startsWith('int.') &&
         !trimmed.toLowerCase().startsWith('ext.')
}

function extractSpeaker(line: string): string | null {
  const match = line.match(/^([A-Z][A-Z\s]+)(?:\s|:)/)
  return match ? match[1].trim() : null
}

function extractDialogue(line: string): string {
  // Remove character name and extract actual dialogue
  const withoutSpeaker = line.replace(/^[A-Z][A-Z\s]+:?\s*/, '')
  return withoutSpeaker.trim()
}

function calculateDialogueDuration(dialogueLine: string): number {
  const dialogue = extractDialogue(dialogueLine)
  const wordCount = dialogue.split(' ').length
  // Rough estimate: 150 words per minute average speaking pace
  return Math.max(2, Math.round((wordCount / 150) * 60))
}

function determineActionShotAngle(actionLine: string): Shot['camera_angle'] {
  const action = actionLine.toLowerCase()
  
  if (action.includes('runs') || action.includes('chase') || action.includes('room')) {
    return 'wide'
  }
  if (action.includes('face') || action.includes('eyes') || action.includes('expression')) {
    return 'close-up'
  }
  if (action.includes('picks up') || action.includes('grabs') || action.includes('hand')) {
    return 'medium'
  }
  
  return 'medium' // Default
}

function optimizeShotCount(shots: BreakdownShot[], targetCount: number): BreakdownShot[] {
  if (shots.length <= targetCount) return shots
  
  // Prioritize key shots: establishing shots, character introductions, climactic moments
  const prioritizedShots = shots.map(shot => ({
    ...shot,
    priority: calculateShotPriority(shot)
  }))
  
  return prioritizedShots
    .sort((a, b) => b.priority - a.priority)
    .slice(0, targetCount)
    .sort((a, b) => a.sequence_number - b.sequence_number)
    .map(({ priority, ...shot }) => shot)
}

function calculateShotPriority(shot: BreakdownShot): number {
  let priority = 1
  
  // Higher priority for establishing shots
  if (shot.suggested_camera_angle === 'wide') priority += 2
  
  // Higher priority for character close-ups
  if (shot.suggested_camera_angle === 'close-up') priority += 1
  
  // Higher priority for shots with dialogue
  if (shot.dialogue_snippet) priority += 1
  
  // Higher priority for longer shots
  if (shot.suggested_duration > 5) priority += 1
  
  return priority
}

// Character consistency utilities
export function generateCharacterReference(character: Character): string {
  const traits = character.personality_traits?.join(', ') || ''
  const visual = character.visual_description || character.description
  
  return `${character.name}: ${visual}. Personality: ${traits}. ${character.backstory || ''}`
}

export function buildConsistencyPrompt(
  shot: Shot,
  characters: Character[],
  sceneContext?: string
): string {
  const shotCharacters = characters.filter(c => 
    shot.characters_in_shot.includes(c.id)
  )
  
  const characterDescriptions = shotCharacters
    .map(c => generateCharacterReference(c))
    .join('\n')
  
  const cameraDirection = shot.camera_angle ? 
    `Shot as ${shot.camera_angle} angle` : ''
  
  const movement = shot.camera_movement ? 
    `with ${shot.camera_movement} camera movement` : ''
  
  return `${shot.scene_description}

Characters in shot:
${characterDescriptions}

${cameraDirection} ${movement}. ${sceneContext || ''}

Cinematic, professional lighting, film quality.`
}

// Duration and pacing utilities
export function calculateProjectDuration(shots: Shot[]): number {
  return shots.reduce((total, shot) => total + (shot.duration_seconds || 0), 0)
}

export function estimateScriptDuration(scriptContent: string): number {
  // Rough estimate: 1 page ≈ 1 minute, 250 words ≈ 1 page
  const wordCount = scriptContent.split(/\s+/).length
  const estimatedMinutes = wordCount / 250
  return Math.round(estimatedMinutes * 60) // Return in seconds
}

// Project organization utilities
export function generateProjectSummary(
  project: any,
  characters: Character[],
  scripts: Script[],
  shots: Shot[]
): string {
  const characterCount = characters.length
  const scriptCount = scripts.length
  const shotCount = shots.length
  const totalDuration = calculateProjectDuration(shots)
  
  return `Project: ${project.title}
Genre: ${project.genre || 'Unspecified'}
Characters: ${characterCount}
Scripts: ${scriptCount}
Shots: ${shotCount}
Estimated Duration: ${Math.round(totalDuration / 60)} minutes
Status: ${project.status}`
}