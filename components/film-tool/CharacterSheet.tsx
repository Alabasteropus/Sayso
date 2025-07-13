"use client"

import React, { useState, useEffect } from "react"
import { Plus, User, Edit2, Trash2, Image, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Character, FilmProject } from "@/lib/types"

interface CharacterSheetProps {
  project: FilmProject
  onCharacterCreate: (character: Character) => void
  onCharacterUpdate: (character: Character) => void
  onCharacterDelete: (characterId: string) => void
}

export default function CharacterSheet({
  project,
  onCharacterCreate,
  onCharacterUpdate,
  onCharacterDelete,
}: CharacterSheetProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visual_description: "",
    personality_traits: "",
    backstory: "",
  })

  useEffect(() => {
    if (project?.id) {
      loadCharacters()
    }
  }, [project?.id])

  const loadCharacters = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/film/characters?project_id=${project.id}`)
      if (!response.ok) throw new Error('Failed to load characters')
      
      const data = await response.json()
      setCharacters(data.characters || [])
    } catch (error) {
      toast({
        title: "Failed to load characters",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCharacter = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide at least a name and description",
        variant: "destructive",
      })
      return
    }

    try {
      setGenerating(true)
      
      // Generate enhanced character details using AI if visual_description is empty
      let enhancedFormData = { ...formData }
      if (!formData.visual_description.trim()) {
        const enhanceResponse = await fetch('/api/film/characters/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            genre: project.genre,
            project_context: project.description,
          }),
        })

        if (enhanceResponse.ok) {
          const enhancedData = await enhanceResponse.json()
          enhancedFormData = {
            ...formData,
            visual_description: enhancedData.visual_description || formData.description,
            personality_traits: enhancedData.personality_traits?.join(', ') || formData.personality_traits,
            backstory: enhancedData.backstory || formData.backstory,
          }
        }
      }

      const response = await fetch('/api/film/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          name: enhancedFormData.name,
          description: enhancedFormData.description,
          visual_description: enhancedFormData.visual_description,
          personality_traits: enhancedFormData.personality_traits.split(',').map(t => t.trim()).filter(Boolean),
          backstory: enhancedFormData.backstory,
        }),
      })

      if (!response.ok) throw new Error('Failed to create character')

      const { character } = await response.json()
      setCharacters(prev => [character, ...prev])
      onCharacterCreate(character)
      
      setFormData({ name: "", description: "", visual_description: "", personality_traits: "", backstory: "" })
      setIsCreateModalOpen(false)
      
      toast({
        title: "Character created",
        description: `${character.name} has been added to your project`,
      })
    } catch (error) {
      toast({
        title: "Failed to create character",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleEditCharacter = async () => {
    if (!editingCharacter || !formData.name.trim()) return

    try {
      const response = await fetch(`/api/film/characters/${editingCharacter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          visual_description: formData.visual_description,
          personality_traits: formData.personality_traits.split(',').map(t => t.trim()).filter(Boolean),
          backstory: formData.backstory,
        }),
      })

      if (!response.ok) throw new Error('Failed to update character')

      const { character } = await response.json()
      setCharacters(prev => prev.map(c => c.id === character.id ? character : c))
      onCharacterUpdate(character)
      
      setIsEditModalOpen(false)
      setEditingCharacter(null)
      setFormData({ name: "", description: "", visual_description: "", personality_traits: "", backstory: "" })
      
      toast({
        title: "Character updated",
        description: `${character.name} has been updated successfully`,
      })
    } catch (error) {
      toast({
        title: "Failed to update character",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCharacter = async (character: Character) => {
    if (!confirm(`Are you sure you want to delete "${character.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/film/characters/${character.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete character')

      setCharacters(prev => prev.filter(c => c.id !== character.id))
      onCharacterDelete(character.id)
      
      toast({
        title: "Character deleted",
        description: `${character.name} has been removed from your project`,
      })
    } catch (error) {
      toast({
        title: "Failed to delete character",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleRegenerateImage = async (character: Character) => {
    try {
      setGenerating(true)
      
      const response = await fetch(`/api/film/characters/${character.id}/regenerate-image`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to regenerate image')

      const { character: updatedCharacter } = await response.json()
      setCharacters(prev => prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c))
      onCharacterUpdate(updatedCharacter)
      
      toast({
        title: "Image regenerated",
        description: `New image generated for ${updatedCharacter.name}`,
      })
    } catch (error) {
      toast({
        title: "Failed to regenerate image",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const openEditModal = (character: Character) => {
    setEditingCharacter(character)
    setFormData({
      name: character.name,
      description: character.description,
      visual_description: character.visual_description,
      personality_traits: character.personality_traits?.join(', ') || '',
      backstory: character.backstory || '',
    })
    setIsEditModalOpen(true)
  }

  const resetForm = () => {
    setFormData({ name: "", description: "", visual_description: "", personality_traits: "", backstory: "" })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Characters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse bg-neutral-800/50">
              <CardHeader>
                <div className="h-6 bg-gray-600 rounded w-3/4" />
                <div className="h-4 bg-gray-700 rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-full" />
                  <div className="h-4 bg-gray-700 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Characters</h3>
          <p className="text-neutral-400">Manage characters for {project.title}</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetForm}>
              <Plus className="w-4 h-4" />
              Add Character
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Character</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Add a new character to your film project. AI will help enhance the details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-white">Character Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter character name"
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-white">Role/Archetype</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Hero, villain, mentor, etc."
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-white">Visual Description</label>
                <Textarea
                  value={formData.visual_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, visual_description: e.target.value }))}
                  placeholder="Physical appearance, clothing, distinctive features..."
                  className="bg-neutral-800 border-neutral-700 text-white"
                  rows={3}
                />
                <p className="text-xs text-neutral-500 mt-1">Leave empty to auto-generate with AI</p>
              </div>

              <div>
                <label className="text-sm font-medium text-white">Personality Traits</label>
                <Input
                  value={formData.personality_traits}
                  onChange={(e) => setFormData(prev => ({ ...prev, personality_traits: e.target.value }))}
                  placeholder="brave, cunning, mysterious (comma-separated)"
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white">Backstory</label>
                <Textarea
                  value={formData.backstory}
                  onChange={(e) => setFormData(prev => ({ ...prev, backstory: e.target.value }))}
                  placeholder="Character background and history..."
                  className="bg-neutral-800 border-neutral-700 text-white"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateCharacter} 
                  className="flex-1 gap-2"
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Create Character
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

      {/* Characters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map(character => (
          <Card key={character.id} className="bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-800/70 transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={character.image_url} alt={character.name} />
                    <AvatarFallback className="bg-neutral-700 text-white">
                      {character.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-white truncate">{character.name}</CardTitle>
                    <CardDescription className="text-neutral-400 truncate">
                      {character.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
                    onClick={() => openEditModal(character)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400"
                    onClick={() => handleDeleteCharacter(character)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {character.visual_description && (
                <p className="text-neutral-300 text-sm mb-3 line-clamp-2">
                  {character.visual_description}
                </p>
              )}
              
              {character.personality_traits && character.personality_traits.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {character.personality_traits.slice(0, 3).map(trait => (
                    <Badge key={trait} variant="outline" className="text-xs border-neutral-600 text-neutral-300">
                      {trait}
                    </Badge>
                  ))}
                  {character.personality_traits.length > 3 && (
                    <Badge variant="outline" className="text-xs border-neutral-600 text-neutral-500">
                      +{character.personality_traits.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-xs"
                  onClick={() => handleRegenerateImage(character)}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Image className="w-3 h-3" />
                  )}
                  New Image
                </Button>
              </div>
              
              <div className="mt-3 text-xs text-neutral-500">
                Created {new Date(character.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {characters.length === 0 && (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-white mb-2">No characters yet</h4>
          <p className="text-neutral-400 mb-6">Add characters to bring your story to life</p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Your First Character
          </Button>
        </div>
      )}

      {/* Edit Character Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Character</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update character details for your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white">Character Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter character name"
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white">Role/Archetype</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Hero, villain, mentor, etc."
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-white">Visual Description</label>
              <Textarea
                value={formData.visual_description}
                onChange={(e) => setFormData(prev => ({ ...prev, visual_description: e.target.value }))}
                placeholder="Physical appearance, clothing, distinctive features..."
                className="bg-neutral-800 border-neutral-700 text-white"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white">Personality Traits</label>
              <Input
                value={formData.personality_traits}
                onChange={(e) => setFormData(prev => ({ ...prev, personality_traits: e.target.value }))}
                placeholder="brave, cunning, mysterious (comma-separated)"
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white">Backstory</label>
              <Textarea
                value={formData.backstory}
                onChange={(e) => setFormData(prev => ({ ...prev, backstory: e.target.value }))}
                placeholder="Character background and history..."
                className="bg-neutral-800 border-neutral-700 text-white"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleEditCharacter} className="flex-1">
                Update Character
              </Button>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}