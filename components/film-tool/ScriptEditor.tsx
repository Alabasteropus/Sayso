"use client"

import React, { useState, useEffect } from "react"
import { Plus, FileText, Edit2, Trash2, Save, Wand2, Camera, Download, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Script, FilmProject, Character, Shot } from "@/lib/types"

interface ScriptEditorProps {
  project: FilmProject
  characters: Character[]
  onScriptCreate: (script: Script) => void
  onScriptUpdate: (script: Script) => void
  onScriptDelete: (scriptId: string) => void
  onShotsGenerated: (shots: Shot[]) => void
}

export default function ScriptEditor({
  project,
  characters,
  onScriptCreate,
  onScriptUpdate,
  onScriptDelete,
  onShotsGenerated,
}: ScriptEditorProps) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [currentScript, setCurrentScript] = useState<Script | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [planningShots, setPlanningShots] = useState(false)
  const { toast } = useToast()

  // Form state
  const [scriptContent, setScriptContent] = useState("")
  const [scriptTitle, setScriptTitle] = useState("")
  const [generatePrompt, setGeneratePrompt] = useState("")
  const [targetDuration, setTargetDuration] = useState(300) // 5 minutes default

  useEffect(() => {
    if (project?.id) {
      loadScripts()
    }
  }, [project?.id])

  const loadScripts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/film/scripts?project_id=${project.id}`)
      if (!response.ok) throw new Error('Failed to load scripts')
      
      const data = await response.json()
      setScripts(data.scripts || [])
      
      // Auto-select the latest script
      if (data.scripts && data.scripts.length > 0) {
        setCurrentScript(data.scripts[0])
        setScriptContent(data.scripts[0].content)
        setScriptTitle(data.scripts[0].title)
      }
    } catch (error) {
      toast({
        title: "Failed to load scripts",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateScript = async () => {
    if (!scriptTitle.trim() || !scriptContent.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both title and content",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch('/api/film/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          title: scriptTitle,
          content: scriptContent,
        }),
      })

      if (!response.ok) throw new Error('Failed to create script')

      const { script } = await response.json()
      setScripts(prev => [script, ...prev])
      setCurrentScript(script)
      onScriptCreate(script)
      
      setIsCreateModalOpen(false)
      
      toast({
        title: "Script created",
        description: `${script.title} has been saved successfully`,
      })
    } catch (error) {
      toast({
        title: "Failed to create script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateScript = async () => {
    if (!generatePrompt.trim()) {
      toast({
        title: "Missing prompt",
        description: "Please provide a description for your script",
        variant: "destructive",
      })
      return
    }

    try {
      setGenerating(true)
      
      const response = await fetch('/api/film/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          prompt: generatePrompt,
          characters: characters,
          genre: project.genre,
          target_duration: targetDuration,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate script')

      const { script } = await response.json()
      setScripts(prev => [script, ...prev])
      setCurrentScript(script)
      setScriptContent(script.content)
      setScriptTitle(script.title)
      onScriptCreate(script)
      
      setIsGenerateModalOpen(false)
      setGeneratePrompt("")
      
      toast({
        title: "Script generated",
        description: `AI has created "${script.title}" for your project`,
      })
    } catch (error) {
      toast({
        title: "Failed to generate script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveScript = async () => {
    if (!currentScript) return

    try {
      setSaving(true)
      
      const response = await fetch(`/api/film/scripts/${currentScript.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scriptTitle,
          content: scriptContent,
        }),
      })

      if (!response.ok) throw new Error('Failed to save script')

      const { script } = await response.json()
      setScripts(prev => prev.map(s => s.id === script.id ? script : s))
      setCurrentScript(script)
      onScriptUpdate(script)
      
      toast({
        title: "Script saved",
        description: "Changes have been saved successfully",
      })
    } catch (error) {
      toast({
        title: "Failed to save script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteScript = async (script: Script) => {
    if (!confirm(`Are you sure you want to delete "${script.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/film/scripts/${script.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete script')

      setScripts(prev => prev.filter(s => s.id !== script.id))
      
      if (currentScript?.id === script.id) {
        const remainingScripts = scripts.filter(s => s.id !== script.id)
        if (remainingScripts.length > 0) {
          setCurrentScript(remainingScripts[0])
          setScriptContent(remainingScripts[0].content)
          setScriptTitle(remainingScripts[0].title)
        } else {
          setCurrentScript(null)
          setScriptContent("")
          setScriptTitle("")
        }
      }
      
      onScriptDelete(script.id)
      
      toast({
        title: "Script deleted",
        description: `${script.title} has been removed from your project`,
      })
    } catch (error) {
      toast({
        title: "Failed to delete script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handlePlanShots = async () => {
    if (!currentScript) return

    try {
      setPlanningShots(true)
      
      const response = await fetch('/api/film/shots/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_id: currentScript.id,
          project_id: project.id,
          script_content: scriptContent,
          characters: characters,
          target_shot_count: 20,
          include_character_close_ups: true,
        }),
      })

      if (!response.ok) throw new Error('Failed to plan shots')

      const { shots } = await response.json()
      onShotsGenerated(shots)
      
      toast({
        title: "Shots planned",
        description: `Created ${shots.length} shots from your script`,
      })
    } catch (error) {
      toast({
        title: "Failed to plan shots",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setPlanningShots(false)
    }
  }

  const selectScript = (script: Script) => {
    setCurrentScript(script)
    setScriptContent(script.content)
    setScriptTitle(script.title)
  }

  const resetCreateForm = () => {
    setScriptTitle("")
    setScriptContent("")
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 ? `${minutes} min` : `${seconds} sec`
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Scripts</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-600 rounded w-1/3" />
          <div className="h-64 bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Scripts</h3>
          <p className="text-neutral-400">Write and manage scripts for {project.title}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Wand2 className="w-4 h-4" />
                Generate with AI
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800">
              <DialogHeader>
                <DialogTitle className="text-white">Generate Script with AI</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Describe your story and let AI create a professional script.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white">Story Description</label>
                  <Textarea
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    placeholder="Describe your story, plot, themes, and key scenes..."
                    className="bg-neutral-800 border-neutral-700 text-white"
                    rows={4}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-white">Target Duration (seconds)</label>
                  <Input
                    type="number"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(parseInt(e.target.value) || 300)}
                    className="bg-neutral-800 border-neutral-700 text-white"
                    min={60}
                    max={3600}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Approximately {formatDuration(targetDuration)}
                  </p>
                </div>

                {characters.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-white">Available Characters</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {characters.map(char => (
                        <Badge key={char.id} variant="outline" className="text-xs border-neutral-600 text-neutral-300">
                          {char.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      AI will incorporate these characters into the script
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleGenerateScript} 
                    className="flex-1 gap-2"
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Generate Script
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsGenerateModalOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetCreateForm}>
                <Plus className="w-4 h-4" />
                New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Script</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Write a new script for your film project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white">Script Title</label>
                  <Input
                    value={scriptTitle}
                    onChange={(e) => setScriptTitle(e.target.value)}
                    placeholder="Enter script title"
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-white">Script Content</label>
                  <Textarea
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                    placeholder="Write your script here..."
                    className="bg-neutral-800 border-neutral-700 text-white font-mono"
                    rows={12}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleCreateScript} 
                    className="flex-1 gap-2"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Create Script
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {currentScript ? (
        <div className="space-y-4">
          {/* Script Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {scripts.map(script => (
              <Button
                key={script.id}
                variant={currentScript.id === script.id ? "default" : "outline"}
                size="sm"
                onClick={() => selectScript(script)}
                className="whitespace-nowrap"
              >
                {script.title}
              </Button>
            ))}
          </div>

          {/* Script Editor */}
          <Tabs defaultValue="edit" className="space-y-4">
            <TabsList className="bg-neutral-800">
              <TabsTrigger value="edit" className="gap-2">
                <Edit2 className="w-4 h-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Input
                    value={scriptTitle}
                    onChange={(e) => setScriptTitle(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white font-semibold text-lg w-64"
                  />
                  {currentScript.estimated_duration && (
                    <Badge variant="outline" className="border-neutral-600 text-neutral-300">
                      {formatDuration(currentScript.estimated_duration)}
                    </Badge>
                  )}
                  {currentScript.character_count && (
                    <Badge variant="outline" className="border-neutral-600 text-neutral-300">
                      {currentScript.character_count} characters
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlanShots}
                    disabled={planningShots}
                    className="gap-2"
                  >
                    {planningShots ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Planning...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        Plan Shots
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSaveScript}
                    disabled={saving}
                    size="sm"
                    className="gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteScript(currentScript)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <Textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white font-mono resize-none"
                style={{ minHeight: "600px" }}
                placeholder="Write your script here..."
              />
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card className="bg-neutral-800/50 border-neutral-700/50">
                <CardHeader>
                  <CardTitle className="text-white">{scriptTitle}</CardTitle>
                  <CardDescription className="text-neutral-400">
                    {project.genre && `${project.genre} • `}
                    {currentScript.estimated_duration && formatDuration(currentScript.estimated_duration)}
                    {currentScript.character_count && ` • ${currentScript.character_count} characters`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-neutral-300 font-mono text-sm leading-relaxed">
                    {scriptContent}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-white mb-2">No scripts yet</h4>
          <p className="text-neutral-400 mb-6">Create your first script to start building your story</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setIsGenerateModalOpen(true)} className="gap-2">
              <Wand2 className="w-4 h-4" />
              Generate with AI
            </Button>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Write Manually
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}