"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { X, Download, Edit, Play, Loader2, ChevronLeft, ChevronRight, Save, Undo, Redo, Brush, Eraser, MousePointer, Minus, Plus, Heart, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"

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

interface CanvasModeProps {
  isOpen: boolean
  onClose: () => void
  currentImage: GeneratedImage | null
  images: GeneratedImage[]
  onImageSelect: (image: GeneratedImage) => void
  onAnimateImage: (image: GeneratedImage) => void
  onDownloadImage: (imageUrl: string, imageName?: string) => void
  onInpaintImage?: (imageUrl: string, maskUrl: string, prompt: string) => Promise<void>
}

type DrawingTool = 'brush' | 'eraser' | 'select'

export default function CanvasMode({
  isOpen,
  onClose,
  currentImage,
  images,
  onImageSelect,
  onAnimateImage,
  onDownloadImage,
  onInpaintImage
}: CanvasModeProps) {
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentTool, setCurrentTool] = useState<DrawingTool>('brush')
  const [brushSize, setBrushSize] = useState(20)
  const [inpaintPrompt, setInpaintPrompt] = useState('')
  const [isInpainting, setIsInpainting] = useState(false)
  const [maskHistory, setMaskHistory] = useState<string[]>([])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const isDrawing = useRef(false)

  useEffect(() => {
    if (currentImage) {
      setSelectedThumbnail(currentImage.id)
      setInpaintPrompt('')
      setMaskHistory([])
      setIsEditMode(true) // Automatically enter edit mode
    }
  }, [currentImage])

  // Setup canvas when entering edit mode
  useEffect(() => {
    if (isEditMode && currentImage && canvasRef.current && maskCanvasRef.current && imageRef.current) {
      const canvas = canvasRef.current
      const maskCanvas = maskCanvasRef.current
      const image = imageRef.current
      
      // Wait for image to load
      const setupCanvas = () => {
        const rect = image.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        maskCanvas.width = rect.width
        maskCanvas.height = rect.height
        
        // Clear mask canvas
        const maskCtx = maskCanvas.getContext('2d')
        if (maskCtx) {
          maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        }
      }
      
      if (image.complete) {
        setupCanvas()
      } else {
        image.addEventListener('load', setupCanvas)
        return () => image.removeEventListener('load', setupCanvas)
      }
    }
  }, [isEditMode, currentImage])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditMode || !maskCanvasRef.current) return
    
    isDrawing.current = true
    const canvas = maskCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (currentTool === 'brush') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    } else if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
    }
    
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [isEditMode, brushSize, currentTool])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !isEditMode || !maskCanvasRef.current) return
    
    const canvas = maskCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [isEditMode])

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current || !maskCanvasRef.current) return
    
    isDrawing.current = false
    
    // Save mask state to history
    const canvas = maskCanvasRef.current
    const maskData = canvas.toDataURL()
    setMaskHistory(prev => [...prev, maskData])
  }, [])

  const clearMask = useCallback(() => {
    if (!maskCanvasRef.current) return
    
    const canvas = maskCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setMaskHistory([])
    }
  }, [])

  const undoMask = useCallback(() => {
    if (maskHistory.length === 0 || !maskCanvasRef.current) return
    
    const canvas = maskCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Remove last state
    const newHistory = maskHistory.slice(0, -1)
    setMaskHistory(newHistory)
    
    // Clear and redraw from history
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    if (newHistory.length > 0) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
      img.src = newHistory[newHistory.length - 1]
    }
  }, [maskHistory])

  const handleInpaint = useCallback(async () => {
    if (!currentImage || !maskCanvasRef.current || !inpaintPrompt.trim() || !onInpaintImage) return
    
    const maskCanvas = maskCanvasRef.current
    const maskDataUrl = maskCanvas.toDataURL()
    
    // Check if there's actually a mask drawn
    const ctx = maskCanvas.getContext('2d')
    if (!ctx) return
    
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    const hasContent = imageData.data.some((value, index) => index % 4 === 3 && value > 0)
    
    if (!hasContent) {
      alert('Please draw a mask first')
      return
    }
    
    setIsInpainting(true)
    try {
      await onInpaintImage(currentImage.url, maskDataUrl, inpaintPrompt)
      setInpaintPrompt('')
      clearMask()
    } catch (error) {
      console.error('Inpainting failed:', error)
    } finally {
      setIsInpainting(false)
    }
  }, [currentImage, inpaintPrompt, onInpaintImage, clearMask])

  const handleThumbnailClick = (image: GeneratedImage) => {
    setSelectedThumbnail(image.id)
    onImageSelect(image)
  }

  const currentIndex = currentImage ? images.findIndex(img => img.id === currentImage.id) : -1
  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < images.length - 1

  const handlePrevious = useCallback(() => {
    if (canGoPrevious && currentImage) {
      const previousImage = images[currentIndex - 1]
      onImageSelect(previousImage)
    }
  }, [canGoPrevious, images, currentIndex, onImageSelect, currentImage])

  const handleNext = useCallback(() => {
    if (canGoNext && currentImage) {
      const nextImage = images[currentIndex + 1]
      onImageSelect(nextImage)
    }
  }, [canGoNext, images, currentIndex, onImageSelect, currentImage])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handlePrevious, handleNext])

  if (!isOpen || !currentImage) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Left Thumbnail Sidebar */}
      <div className="w-20 bg-black flex flex-col py-4">
        {/* Add New Button */}
        <div className="px-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-12 text-neutral-400 hover:text-white hover:bg-neutral-800 border-2 border-dashed border-neutral-700 hover:border-neutral-600 rounded-lg"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Thumbnail Stack */}
        <div className="flex-1 overflow-y-auto px-3 space-y-3">
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 aspect-square ${
                selectedThumbnail === image.id 
                  ? 'ring-2 ring-yellow-500' 
                  : 'hover:ring-1 hover:ring-neutral-600'
              }`}
              onClick={() => handleThumbnailClick(image)}
            >
              <img
                src={image.url}
                alt="Thumbnail"
                className="w-full h-full object-cover"
              />
              {image.isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Close Button - Top Right */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 text-neutral-400 hover:text-white hover:bg-neutral-800 w-10 h-10"
        >
          <X className="w-5 h-5" />
        </Button>

        {/* Main Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-black">
          <div className="relative max-w-full max-h-full">
            <img
              ref={imageRef}
              src={currentImage.url}
              alt="Current image"
              className="max-w-full max-h-full object-contain"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto'
              }}
            />
            
            {/* Drawing Canvas for Edit Mode */}
            {isEditMode && (
              <>
                {/* Base canvas for reference */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: '100%',
                    height: '100%'
                  }}
                />
                
                {/* Mask canvas for drawing */}
                <canvas
                  ref={maskCanvasRef}
                  className="absolute inset-0 cursor-crosshair"
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
                
                {/* Edit Mode Instructions */}
                <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm">
                  {currentTool === 'brush' && 'Paint areas to inpaint'}
                  {currentTool === 'eraser' && 'Erase mask areas'}
                  {currentTool === 'select' && 'Select areas'}
                </div>
                
                {/* Brush Size Indicator */}
                <div 
                  className="absolute pointer-events-none border-2 border-white rounded-full"
                  style={{
                    width: `${brushSize}px`,
                    height: `${brushSize}px`,
                    transform: 'translate(-50%, -50%)',
                    left: '50%',
                    top: '50%',
                    opacity: 0.5
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-800">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Left Side - Current Image Info */}
            <div className="flex items-center gap-4">
              <div className="text-sm text-neutral-400">
                Soul Inpaint
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-neutral-400 hover:text-white"
                >
                  <Heart className="w-4 h-4 mr-1" />
                  Basic
                </Button>
              </div>
            </div>

            {/* Center - Thumbnail Navigation */}
            <div className="flex items-center gap-2">
              {images.slice(Math.max(0, currentIndex - 1), currentIndex + 2).map((image, idx) => (
                <div
                  key={image.id}
                  className={`w-12 h-12 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    image.id === currentImage.id ? 'ring-2 ring-yellow-500' : 'opacity-60 hover:opacity-100'
                  }`}
                  onClick={() => handleThumbnailClick(image)}
                >
                  <img
                    src={image.url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Tool Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant={currentTool === 'brush' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentTool('brush')}
                  className={currentTool === 'brush' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
                >
                  <Brush className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-neutral-400 hover:text-white"
                  onClick={undoMask}
                  disabled={maskHistory.length === 0}
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-neutral-400 hover:text-white"
                  onClick={clearMask}
                >
                  <Redo className="w-4 h-4" />
                </Button>
              </div>

              {/* Video Button */}
              <Button
                onClick={() => onAnimateImage(currentImage)}
                disabled={currentImage.isAnimating}
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-white"
              >
                <Play className="w-4 h-4 mr-1" />
                Video
              </Button>

              {/* Speak Button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-white"
              >
                <Mic className="w-4 h-4 mr-1" />
                Speak
              </Button>

              {/* Download Button */}
              <Button
                onClick={() => onDownloadImage(currentImage.url, `image-${currentImage.id}`)}
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-white"
              >
                <Download className="w-4 h-4" />
              </Button>

              {/* Bookmark Button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-white"
              >
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Prompt Input Bar */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Draw the mask, then enter a prompt"
                value={inpaintPrompt}
                onChange={(e) => setInpaintPrompt(e.target.value)}
                className="flex-1 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
              />
              <Button
                onClick={handleInpaint}
                disabled={!inpaintPrompt.trim() || isInpainting}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-6"
              >
                {isInpainting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <>
                    Generate
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 