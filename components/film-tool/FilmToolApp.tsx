"use client"

import React, { useState, useEffect } from "react"
import { Film, X, Image, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import ProjectManager from "./ProjectManager"
import CharacterSheet from "./CharacterSheet"
import ScriptEditor from "./ScriptEditor"
import { FilmProject, Character, Script, Shot } from "@/lib/types"

interface FilmToolAppProps {
  onClose: () => void
}

export default function FilmToolApp({ onClose }: FilmToolAppProps) {
  const [currentProject, setCurrentProject] = useState<FilmProject | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [shots, setShots] = useState<Shot[]>([])
  const [activeTab, setActiveTab] = useState("projects")
  const { toast } = useToast()

  useEffect(() => {
    if (currentProject) {
      loadProjectData()
    }
  }, [currentProject])

  const loadProjectData = async () => {
    if (!currentProject) return

    try {
      // Load characters
      const charactersResponse = await fetch(`/api/film/characters?project_id=${currentProject.id}`)
      if (charactersResponse.ok) {
        const charactersData = await charactersResponse.json()
        setCharacters(charactersData.characters || [])
      }

      // Load scripts
      const scriptsResponse = await fetch(`/api/film/scripts?project_id=${currentProject.id}`)
      if (scriptsResponse.ok) {
        const scriptsData = await scriptsResponse.json()
        setScripts(scriptsData.scripts || [])
      }

      // Load shots
      const shotsResponse = await fetch(`/api/film/shots?project_id=${currentProject.id}`)
      if (shotsResponse.ok) {
        const shotsData = await shotsResponse.json()
        setShots(shotsData.shots || [])
      }

      // Auto-navigate to characters tab when project is selected
      setActiveTab("characters")
    } catch (error) {
      console.error('Failed to load project data:', error)
    }
  }

  const handleProjectSelect = (project: FilmProject) => {
    setCurrentProject(project)
    toast({
      title: "Project selected",
      description: `Switched to ${project.title}`,
    })
  }

  const handleProjectCreate = (project: FilmProject) => {
    setCurrentProject(project)
    setActiveTab("characters")
    toast({
      title: "Project created",
      description: `${project.title} is ready to go`,
    })
  }

  const handleProjectUpdate = (project: FilmProject) => {
    setCurrentProject(project)
  }

  const handleProjectDelete = (projectId: string) => {
    if (currentProject?.id === projectId) {
      setCurrentProject(null)
      setCharacters([])
      setScripts([])
      setShots([])
      setActiveTab("projects")
    }
  }

  const handleCharacterCreate = (character: Character) => {
    setCharacters(prev => [character, ...prev])
    toast({
      title: "Character created",
      description: `${character.name} added to your project`,
    })
  }

  const handleCharacterUpdate = (character: Character) => {
    setCharacters(prev => prev.map(c => c.id === character.id ? character : c))
  }

  const handleCharacterDelete = (characterId: string) => {
    setCharacters(prev => prev.filter(c => c.id !== characterId))
  }

  const handleScriptCreate = (script: Script) => {
    setScripts(prev => [script, ...prev])
    setActiveTab("scripts")
    toast({
      title: "Script created",
      description: `${script.title} is ready for editing`,
    })
  }

  const handleScriptUpdate = (script: Script) => {
    setScripts(prev => prev.map(s => s.id === script.id ? script : s))
  }

  const handleScriptDelete = (scriptId: string) => {
    setScripts(prev => prev.filter(s => s.id !== scriptId))
  }

  const handleShotsGenerated = (newShots: Shot[]) => {
    setShots(prev => [...newShots, ...prev])
    toast({
      title: "Shots planned",
      description: `Generated ${newShots.length} shots for your storyboard`,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Film className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Film Tool</h1>
            {currentProject && (
              <p className="text-sm text-neutral-400">{currentProject.title}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-neutral-800 px-4">
          <TabsList className="bg-transparent h-12">
            <TabsTrigger value="projects" className="data-[state=active]:bg-neutral-800">
              Projects
            </TabsTrigger>
            <TabsTrigger 
              value="characters" 
              disabled={!currentProject}
              className="data-[state=active]:bg-neutral-800"
            >
              Characters
              {characters.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-neutral-700 rounded">
                  {characters.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="scripts" 
              disabled={!currentProject}
              className="data-[state=active]:bg-neutral-800"
            >
              Scripts
              {scripts.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-neutral-700 rounded">
                  {scripts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="storyboard" 
              disabled={!currentProject || shots.length === 0}
              className="data-[state=active]:bg-neutral-800"
            >
              Storyboard
              {shots.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-neutral-700 rounded">
                  {shots.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="projects" className="h-full overflow-y-auto">
            <ProjectManager
              currentProject={currentProject}
              onProjectSelect={handleProjectSelect}
              onProjectCreate={handleProjectCreate}
              onProjectUpdate={handleProjectUpdate}
              onProjectDelete={handleProjectDelete}
            />
          </TabsContent>

          <TabsContent value="characters" className="h-full overflow-y-auto">
            {currentProject ? (
              <CharacterSheet
                project={currentProject}
                onCharacterCreate={handleCharacterCreate}
                onCharacterUpdate={handleCharacterUpdate}
                onCharacterDelete={handleCharacterDelete}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-neutral-500">Select a project to manage characters</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scripts" className="h-full overflow-y-auto">
            {currentProject ? (
              <ScriptEditor
                project={currentProject}
                characters={characters}
                onScriptCreate={handleScriptCreate}
                onScriptUpdate={handleScriptUpdate}
                onScriptDelete={handleScriptDelete}
                onShotsGenerated={handleShotsGenerated}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-neutral-500">Select a project to write scripts</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="storyboard" className="h-full overflow-y-auto">
            {currentProject && shots.length > 0 ? (
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-white">Storyboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                  {shots.map(shot => (
                    <ShotCard 
                      key={shot.id} 
                      shot={shot} 
                      characters={characters}
                      onImageGenerated={(shotId, imageUrl) => {
                        setShots(prev => prev.map(s => 
                          s.id === shotId ? { ...s, image_url: imageUrl } : s
                        ))
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-neutral-500 mb-2">No shots planned yet</p>
                  <p className="text-xs text-neutral-600">
                    Create scripts and use "Plan Shots" to generate storyboard
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Project Status Bar */}
      {currentProject && (
        <div className="border-t border-neutral-800 p-3 bg-neutral-900/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-neutral-400">
                {characters.length} characters
              </span>
              <span className="text-neutral-400">
                {scripts.length} scripts  
              </span>
              <span className="text-neutral-400">
                {shots.length} shots
              </span>
            </div>
            <div className="text-neutral-500">
              {currentProject.genre && `${currentProject.genre} • `}
              {currentProject.status}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ShotCardProps {
  shot: Shot
  characters: Character[]
  onImageGenerated: (shotId: string, imageUrl: string) => void
}

function ShotCard({ shot, characters, onImageGenerated }: ShotCardProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  const generateImage = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/film/shots/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shot_id: shot.id,
          scene_description: shot.scene_description,
          camera_angle: shot.camera_angle,
          camera_movement: shot.camera_movement,
          characters: characters
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate image')
      }

      const data = await response.json()
      onImageGenerated(shot.id, data.image_url)
      
      toast({
        title: "Image generated",
        description: `Shot ${shot.sequence_number} image created successfully`,
      })
    } catch (error) {
      console.error('Image generation error:', error)
      toast({
        title: "Generation failed",
        description: "Failed to generate shot image",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-400">
          Shot {shot.sequence_number}
        </span>
        <span className="text-xs text-neutral-500">
          {shot.camera_angle}
        </span>
      </div>
      
      <div className="relative mb-3">
        {shot.image_url ? (
          <img 
            src={shot.image_url} 
            alt={`Shot ${shot.sequence_number}`}
            className="w-full h-32 object-cover rounded"
          />
        ) : (
          <div className="w-full h-32 bg-neutral-700 rounded flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={generateImage}
              disabled={isGenerating}
              className="text-neutral-400 hover:text-white"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
              <span className="ml-1">
                {isGenerating ? 'Generating...' : 'Generate Image'}
              </span>
            </Button>
          </div>
        )}
      </div>
      
      <p className="text-sm text-neutral-300 line-clamp-3 mb-2">
        {shot.scene_description}
      </p>
      
      <div className="flex items-center justify-between text-xs text-neutral-500">
        {shot.duration_seconds && (
          <span>{shot.duration_seconds}s</span>
        )}
        {shot.camera_movement && (
          <span>{shot.camera_movement}</span>
        )}
      </div>
      
      {shot.notes && (
        <p className="text-xs text-neutral-600 mt-2 italic">
          {shot.notes}
        </p>
      )}
    </div>
  )
}