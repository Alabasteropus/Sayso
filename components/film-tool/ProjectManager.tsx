"use client"

import React, { useState, useEffect } from "react"
import { Plus, Film, Calendar, Users, FileText, Camera, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { FilmProject } from "@/lib/types"

interface ProjectManagerProps {
  currentProject: FilmProject | null
  onProjectSelect: (project: FilmProject) => void
  onProjectCreate: (project: FilmProject) => void
  onProjectUpdate: (project: FilmProject) => void
  onProjectDelete: (projectId: string) => void
}

interface ProjectStats {
  characters: number
  scripts: number
  shots: number
  totalDuration: number
}

export default function ProjectManager({
  currentProject,
  onProjectSelect,
  onProjectCreate,
  onProjectUpdate,
  onProjectDelete,
}: ProjectManagerProps) {
  const [projects, setProjects] = useState<FilmProject[]>([])
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({})
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<FilmProject | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    genre: "",
  })

  const genres = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", 
    "Mystery", "Romance", "Sci-Fi", "Thriller", "Documentary", "Animation"
  ]

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/film/projects')
      if (!response.ok) throw new Error('Failed to load projects')
      
      const data = await response.json()
      setProjects(data.projects)
      
      // Load stats for each project
      const statsPromises = data.projects.map((project: FilmProject) => 
        loadProjectStats(project.id)
      )
      const statsResults = await Promise.all(statsPromises)
      
      const statsMap: Record<string, ProjectStats> = {}
      data.projects.forEach((project: FilmProject, index: number) => {
        statsMap[project.id] = statsResults[index]
      })
      setProjectStats(statsMap)
    } catch (error) {
      toast({
        title: "Failed to load projects",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadProjectStats = async (projectId: string): Promise<ProjectStats> => {
    try {
      const response = await fetch(`/api/film/projects/${projectId}/stats`)
      if (!response.ok) return { characters: 0, scripts: 0, shots: 0, totalDuration: 0 }
      
      const data = await response.json()
      return data.stats
    } catch {
      return { characters: 0, scripts: 0, shots: 0, totalDuration: 0 }
    }
  }

  const handleCreateProject = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a project title",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/film/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create project')

      const { project } = await response.json()
      setProjects(prev => [project, ...prev])
      setProjectStats(prev => ({ ...prev, [project.id]: { characters: 0, scripts: 0, shots: 0, totalDuration: 0 } }))
      onProjectCreate(project)
      
      setFormData({ title: "", description: "", genre: "" })
      setIsCreateModalOpen(false)
      
      toast({
        title: "Project created",
        description: `${project.title} has been created successfully`,
      })
    } catch (error) {
      toast({
        title: "Failed to create project",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleEditProject = async () => {
    if (!editingProject || !formData.title.trim()) return

    try {
      const response = await fetch(`/api/film/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to update project')

      const { project } = await response.json()
      setProjects(prev => prev.map(p => p.id === project.id ? project : p))
      onProjectUpdate(project)
      
      setIsEditModalOpen(false)
      setEditingProject(null)
      setFormData({ title: "", description: "", genre: "" })
      
      toast({
        title: "Project updated",
        description: `${project.title} has been updated successfully`,
      })
    } catch (error) {
      toast({
        title: "Failed to update project",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleDeleteProject = async (project: FilmProject) => {
    if (!confirm(`Are you sure you want to delete "${project.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/film/projects/${project.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete project')

      setProjects(prev => prev.filter(p => p.id !== project.id))
      setProjectStats(prev => {
        const newStats = { ...prev }
        delete newStats[project.id]
        return newStats
      })
      
      onProjectDelete(project.id)
      
      toast({
        title: "Project deleted",
        description: `${project.title} has been deleted`,
      })
    } catch (error) {
      toast({
        title: "Failed to delete project",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const openEditModal = (project: FilmProject) => {
    setEditingProject(project)
    setFormData({
      title: project.title,
      description: project.description || "",
      genre: project.genre || "",
    })
    setIsEditModalOpen(true)
  }

  const getStatusColor = (status: FilmProject['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 ? `${minutes}m` : `${seconds}s`
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Film Projects</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
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
          <h2 className="text-2xl font-bold text-white">Film Projects</h2>
          <p className="text-neutral-400">Manage your film projects and productions</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Project</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Start a new film project to organize your characters, scripts, and shots.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter project title"
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white">Genre</label>
                <Select
                  value={formData.genre}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    {genres.map(genre => (
                      <SelectItem key={genre} value={genre} className="text-white">
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-white">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your project..."
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateProject} className="flex-1">
                  Create Project
                </Button>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Project Banner */}
      {currentProject && (
        <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-800/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Film className="w-6 h-6 text-blue-400" />
                <div>
                  <CardTitle className="text-white">{currentProject.title}</CardTitle>
                  <CardDescription className="text-blue-300">Current Project</CardDescription>
                </div>
              </div>
              <Badge className={getStatusColor(currentProject.status)}>
                {currentProject.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const stats = projectStats[project.id] || { characters: 0, scripts: 0, shots: 0, totalDuration: 0 }
          const isActive = currentProject?.id === project.id
          
          return (
            <Card 
              key={project.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isActive 
                  ? 'bg-blue-900/30 border-blue-700/50' 
                  : 'bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-800/70'
              }`}
              onClick={() => onProjectSelect(project)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white truncate">{project.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {project.genre && (
                        <Badge variant="outline" className="text-xs border-neutral-600 text-neutral-300">
                          {project.genre}
                        </Badge>
                      )}
                      <Badge className={getStatusColor(project.status)}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(project)
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {project.description && (
                  <p className="text-neutral-400 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Users className="w-4 h-4" />
                    <span>{stats.characters} characters</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <FileText className="w-4 h-4" />
                    <span>{stats.scripts} scripts</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Camera className="w-4 h-4" />
                    <span>{stats.shots} shots</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDuration(stats.totalDuration)}</span>
                  </div>
                </div>
                
                <div className="mt-4 text-xs text-neutral-500">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <Film className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-neutral-400 mb-6">Create your first film project to get started</p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Your First Project
          </Button>
        </div>
      )}

      {/* Edit Project Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Project</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update your project details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter project title"
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Genre</label>
              <Select
                value={formData.genre}
                onValueChange={(value) => setFormData(prev => ({ ...prev, genre: value }))}
              >
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  {genres.map(genre => (
                    <SelectItem key={genre} value={genre} className="text-white">
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-white">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your project..."
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleEditProject} className="flex-1">
                Update Project
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