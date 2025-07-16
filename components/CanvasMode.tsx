"use client"

import React, { useState, useCallback } from "react"
import { X, Mic, MicOff, Send, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVoiceRecording } from "@/hooks/useVoiceRecording"
import { useToast } from "@/hooks/use-toast"

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
  onEditImage?: (imageUrl: string, prompt: string) => Promise<void>
}

export default function CanvasMode({
  isOpen,
  onClose,
  currentImage,
  images,
  onImageSelect,
  onAnimateImage,
  onDownloadImage,
  onEditImage
}: CanvasModeProps) {
  const [textInput, setTextInput] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  
  const { toast } = useToast()
  const { isRecording, startRecording, stopRecording } = useVoiceRecording()

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

  const processTextCommand = useCallback(async (userCommand: string) => {
    if (!userCommand.trim()) {
      toast({
        title: "Missing command",
        description: "Please enter a command",
        variant: "destructive",
      })
      return
    }

    if (!currentImage || !onEditImage) {
      toast({
        title: "Cannot edit",
        description: "No image selected or editing not available",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    
    try {
      await onEditImage(currentImage.url, userCommand)
      setTextInput("")
      toast({
        title: "Image edited successfully!",
        description: "Your edited image has been generated",
      })
    } catch (error) {
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }, [currentImage, onEditImage, toast])

  const processVoiceCommand = useCallback(async (audioBlob: Blob) => {
    if (!audioBlob) {
      toast({
        title: "Missing audio",
        description: "Please record a voice command",
        variant: "destructive",
      })
      return
    }

    try {
      const base64Audio: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          resolve(dataUrl.split(",")[1] || "")
        }
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })

      const sttResponse = await fetch("/api/speech-to-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64Audio }),
      })

      if (!sttResponse.ok) throw new Error("Speech-to-text failed")

      const { transcription } = await sttResponse.json()
      
      await processTextCommand(transcription)
    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    }
  }, [processTextCommand, toast])

  const handleButtonPress = useCallback(async () => {
    if (textInput.trim()) {
      processTextCommand(textInput)
      return
    }
    await startRecording()
  }, [textInput, processTextCommand, startRecording])

  const handleButtonRelease = useCallback(async () => {
    if (!textInput.trim()) {
      const audioBlob = await stopRecording()
      if (audioBlob) {
        processVoiceCommand(audioBlob)
      }
    }
  }, [textInput, stopRecording, processVoiceCommand])

  const handleButtonClick = useCallback(() => {
    if (textInput.trim()) {
      processTextCommand(textInput)
    }
  }, [textInput, processTextCommand])

  if (!isOpen || !currentImage) return null

  return (
    <div className="fixed inset-0 bg-neutral-900 text-neutral-300 z-50">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Image</h2>
            <p className="text-sm text-neutral-400">Describe changes to make to this image</p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Navigation Arrows */}
        <Button
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canGoNext}
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>

        {/* Image Display */}
        <div className="relative max-w-4xl max-h-full">
          <img
            src={currentImage.url}
            alt="Image to edit"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              width: 'auto',
              height: 'auto'
            }}
          />
          
          {/* Image Counter */}
          <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1 rounded-lg text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>

      {/* Image History Bar */}
      <div className="px-8 py-4 border-t border-neutral-800/50">
        <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-full">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => onImageSelect(image)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                image.id === currentImage.id 
                  ? 'border-blue-500 ring-2 ring-blue-500/50' 
                  : 'border-neutral-700 hover:border-neutral-600'
              }`}
            >
              <img
                src={image.url}
                alt={`Image ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Fixed Bottom Controls - Same as main interface */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20">
        <div className="p-4 min-w-96">
          <div className="flex items-center justify-center gap-4">
            <Input
              type="text"
              placeholder={textInput.trim() ? "Click submit to edit..." : "Describe your changes or hold to speak..."}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isRecording || isGenerating}
              className="w-80 text-center bg-neutral-900/50 border-neutral-800/50 text-neutral-400 placeholder:text-neutral-600"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && textInput.trim()) {
                  processTextCommand(textInput)
                }
              }}
            />

            <Button
              onClick={textInput.trim() ? handleButtonClick : undefined}
              onMouseDown={!textInput.trim() ? handleButtonPress : undefined}
              onMouseUp={!textInput.trim() ? handleButtonRelease : undefined}
              onMouseLeave={!textInput.trim() ? handleButtonRelease : undefined}
              onTouchStart={!textInput.trim() ? handleButtonPress : undefined}
              onTouchEnd={!textInput.trim() ? handleButtonRelease : undefined}
              disabled={isGenerating}
              size="lg"
              className={`w-20 h-20 rounded-full p-0 transition-all duration-300 relative overflow-hidden ${
                isGenerating
                  ? "bg-gradient-to-r from-purple-800 via-blue-800 to-green-800 text-white animate-pulse scale-105 shadow-lg shadow-purple-900/25"
                  : isRecording
                  ? "bg-red-800 hover:bg-red-900 text-neutral-300 scale-110 shadow-lg shadow-red-800/25"
                  : textInput.trim()
                  ? "bg-green-800 hover:bg-green-900 text-neutral-300 shadow-lg hover:scale-105"
                  : "bg-neutral-800 hover:bg-neutral-700 text-neutral-500 shadow-lg hover:scale-105"
              }`}
            >
              {/* Animated gradient overlay for generating state */}
              {isGenerating && (
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-purple-700 via-blue-700 to-green-700 opacity-30"
                  style={{
                    animation: 'gradient-shift 2s ease-in-out infinite'
                  }}
                />
              )}
              
              <div className="relative z-10">
                {isGenerating ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-8 h-8" />
                ) : textInput.trim() ? (
                  <Send className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </div>
            </Button>
          </div>

          {/* Status messages */}
          {isGenerating ? (
            <div className="text-center text-sm text-purple-400 mt-3 animate-pulse">
              Editing image...
            </div>
          ) : isRecording ? (
            <div className="text-center text-sm text-red-400 mt-3 animate-pulse">
              Recording... Release to process
            </div>
          ) : textInput.trim() ? (
            <div className="text-center text-sm text-green-400 mt-3">
              Click submit or press Enter to edit
            </div>
          ) : (
            <div className="text-center text-sm text-neutral-600 mt-3">
              Describe your changes or hold button to record voice
            </div>
          )}
        </div>
      </div>
    </div>
  )
}