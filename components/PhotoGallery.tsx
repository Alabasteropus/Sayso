"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, X, Search, Grid, List, Trash2, Edit } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createPhotoStorage, UserPhoto, photoUtils } from "@/lib/photo-storage"

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  timestamp: number
  aspectRatio: string
  width?: number
  height?: number
  isAnimating?: boolean
  videoUrls?: string[]
  isLoading?: boolean
  loadingStatus?: string
}

interface PhotoGalleryProps {
  isOpen: boolean
  onClose: () => void
  onSelectPhoto: (photo: UserPhoto) => void
  generatedImages?: GeneratedImage[]
}

export default function PhotoGallery({ isOpen, onClose, onSelectPhoto, generatedImages = [] }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<UserPhoto[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTab, setActiveTab] = useState<'uploads' | 'generated'>('uploads')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  
  const photoStorage = createPhotoStorage()

  // Load photos when component mounts
  useEffect(() => {
    if (isOpen) {
      loadPhotos()
    }
  }, [isOpen])

  const loadPhotos = async () => {
    try {
      const userPhotos = await photoStorage.getPhotos()
      setPhotos(userPhotos)
    } catch (error) {
      console.error('Failed to load photos:', error)
      toast({
        title: "Failed to load photos",
        description: "Could not load your photo gallery",
        variant: "destructive",
      })
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    
    try {
      const uploadedPhotos: UserPhoto[] = []
      
      for (const file of Array.from(files)) {
        // Validate file
        const validation = photoUtils.validatePhoto(file)
        if (!validation.valid) {
          toast({
            title: "Invalid file",
            description: `${file.name}: ${validation.error}`,
            variant: "destructive",
          })
          continue
        }

        try {
          // Upload using storage manager
          const uploadedPhoto = await photoStorage.uploadPhoto(file)
          uploadedPhotos.push(uploadedPhoto)
        } catch (error) {
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
            variant: "destructive",
          })
        }
      }

      if (uploadedPhotos.length > 0) {
        // Refresh photos list
        await loadPhotos()
        
        toast({
          title: "Photos uploaded successfully",
          description: `${uploadedPhotos.length} photo(s) added to your gallery`,
        })
      }

      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload photos. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await photoStorage.deletePhoto(photoId)
      await loadPhotos() // Refresh photos list
      toast({
        title: "Photo deleted",
        description: "Photo removed from gallery",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not delete photo. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSelectPhoto = (photo: UserPhoto) => {
    onSelectPhoto(photo)
    onClose()
  }

  const handleSelectGeneratedImage = (image: GeneratedImage) => {
    // Convert GeneratedImage to UserPhoto format for consistency
    const convertedPhoto: UserPhoto = {
      id: `generated-${image.id}`,
      name: `Generated: ${image.prompt.substring(0, 30)}...`,
      url: image.url,
      size: 0, // Size unknown for generated images
      timestamp: image.timestamp,
      type: 'image/jpeg' as const
    }
    onSelectPhoto(convertedPhoto)
    onClose()
  }

  const filteredPhotos = photos.filter(photo =>
    photo.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredGeneratedImages = generatedImages
    .filter(img => !img.isLoading) // Only show completed images
    .filter(img => 
      img.prompt.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const formatFileSize = photoUtils.formatFileSize

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-4xl h-3/4 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Gallery</h2>
            <div className="text-sm text-neutral-400">
              {activeTab === 'uploads' 
                ? `${photos.length} upload${photos.length !== 1 ? 's' : ''}`
                : `${filteredGeneratedImages.length} generated`
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="text-neutral-400 hover:text-neutral-300"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-300"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-800">
          <div className="flex">
            <button
              onClick={() => setActiveTab('uploads')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'uploads'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-300'
              }`}
            >
              Local Photos ({photos.length})
            </button>
            <button
              onClick={() => setActiveTab('generated')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'generated'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-300'
              }`}
            >
              Generated Assets ({generatedImages.filter(img => !img.isLoading).length})
            </button>
          </div>
        </div>

        {/* Upload and Search */}
        <div className="p-4 border-b border-neutral-800 flex items-center gap-4">
          {activeTab === 'uploads' && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Photos'}
            </Button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              type="text"
              placeholder={activeTab === 'uploads' ? "Search photos..." : "Search generated images..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-neutral-800 border-neutral-700 text-neutral-300 placeholder:text-neutral-500"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'uploads' ? (
            // Local Photos Tab
            filteredPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                <Upload className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg mb-2">No photos yet</p>
                <p className="text-sm text-center">
                  Upload your photos to get started.<br />
                  Supported formats: JPG, PNG, GIF, WebP
                </p>
              </div>
            ) : (
              <div className={
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                  : "space-y-2"
              }>
                {filteredPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className={
                      viewMode === 'grid'
                        ? "group relative aspect-square bg-neutral-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                        : "group flex items-center gap-4 p-3 bg-neutral-800 rounded-lg cursor-pointer hover:bg-neutral-700 transition-all"
                    }
                    onClick={() => handleSelectPhoto(photo)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className={
                        viewMode === 'grid'
                          ? "w-full h-full object-cover"
                          : "w-16 h-16 object-cover rounded-lg"
                      }
                    />
                    
                    {viewMode === 'grid' ? (
                      // Grid view overlay
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-center">
                          <p className="text-sm font-medium truncate px-2">{photo.name}</p>
                          <p className="text-xs text-neutral-300">{formatFileSize(photo.size)}</p>
                        </div>
                      </div>
                    ) : (
                      // List view info
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{photo.name}</p>
                        <p className="text-xs text-neutral-400">
                          {formatFileSize(photo.size)} • {new Date(photo.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    
                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePhoto(photo.id)
                      }}
                      className={`
                        ${viewMode === 'grid' 
                          ? "absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white" 
                          : "opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                        } transition-opacity
                      `}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Generated Images Tab
            filteredGeneratedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                <Grid className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg mb-2">No generated images yet</p>
                <p className="text-sm text-center">
                  Generate some images to see them here.<br />
                  All your created assets will appear in this tab.
                </p>
              </div>
            ) : (
              <div className={
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                  : "space-y-2"
              }>
                {filteredGeneratedImages.map((image) => (
                  <div
                    key={image.id}
                    className={
                      viewMode === 'grid'
                        ? "group relative aspect-square bg-neutral-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                        : "group flex items-center gap-4 p-3 bg-neutral-800 rounded-lg cursor-pointer hover:bg-neutral-700 transition-all"
                    }
                    onClick={() => handleSelectGeneratedImage(image)}
                  >
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className={
                        viewMode === 'grid'
                          ? "w-full h-full object-cover"
                          : "w-16 h-16 object-cover rounded-lg"
                      }
                    />
                    
                    {viewMode === 'grid' ? (
                      // Grid view overlay
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-center">
                          <p className="text-sm font-medium truncate px-2">{image.prompt.substring(0, 40)}...</p>
                          <p className="text-xs text-neutral-300">{image.aspectRatio}</p>
                        </div>
                      </div>
                    ) : (
                      // List view info
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{image.prompt}</p>
                        <p className="text-xs text-neutral-400">
                          {image.aspectRatio} • {new Date(image.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  )
}