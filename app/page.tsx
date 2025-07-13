"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useTheme } from "next-themes"
import { useToast } from "@/hooks/use-toast"
import SessionSidebar from "@/components/SessionSidebar"
import ImageUploader from "@/components/ImageUploader"
import ImageModal from "@/components/ImageModal"
import UnifiedFeed from "@/components/UnifiedFeed"
import CanvasMode from "@/components/CanvasMode"
import { useVoiceRecording } from "@/hooks/useVoiceRecording"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, Upload, Loader2, Send, X, Plus, Play, Download, Trash2, Film } from "lucide-react"
import FilmToolApp from "@/components/film-tool/FilmToolApp"
import AuthCheck from "@/components/AuthCheck"

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

interface GeneratedVideo {
  id: string
  url: string
  prompt: string
  timestamp: number
  sourceImageId: string
  sourceImageUrl: string
  isLoading?: boolean
  loadingStatus?: string
}

interface Session {
  id: string
  thumbnail: string
  name: string
  timestamp: number
  images: GeneratedImage[]
  videos: GeneratedVideo[]
}

export default function VoiceImageEditor() {

  const [transcription, setTranscription] = useState<string>("")
  const [translatedPrompt, setTranslatedPrompt] = useState<string>("")
  const [textInput, setTextInput] = useState<string>("")
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("1:1")
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [modalImage, setModalImage] = useState<GeneratedImage | null>(null)
  const [canvasImage, setCanvasImage] = useState<GeneratedImage | null>(null)
  const [isCanvasMode, setIsCanvasMode] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isFilmToolOpen, setIsFilmToolOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { isRecording, startRecording, stopRecording } = useVoiceRecording()

  const supportedAspectRatios = [
    { ratio: "21:9", value: 21/9 },
    { ratio: "16:9", value: 16/9 },
    { ratio: "4:3", value: 4/3 },
    { ratio: "3:2", value: 3/2 },
    { ratio: "1:1", value: 1/1 },
    { ratio: "2:3", value: 2/3 },
    { ratio: "3:4", value: 3/4 },
    { ratio: "9:16", value: 9/16 },
    { ratio: "9:21", value: 9/21 },
  ]

  const generateImagesFromText = useCallback(async (userCommand: string) => {
    setIsGenerating(true)
    
    try {
      setTranscription(userCommand)

      // Create placeholder timestamp for this generation batch
      const batchTimestamp = Date.now()

      // Step 1: Translate prompt
      const promptResponse = await fetch("/api/translate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userCommand: `Generate an image: ${userCommand}`,
          imageDescription: null 
        }),
      })

      if (!promptResponse.ok) throw new Error("Prompt translation failed")

      const { translatedPrompt } = await promptResponse.json()
      setTranslatedPrompt(translatedPrompt)

      // Step 2: Create 4 placeholder loading cards immediately
      const placeholderImages: GeneratedImage[] = Array.from({ length: 4 }, (_, index) => ({
        id: `loading-${batchTimestamp}-${index}`,
        url: "",
        prompt: translatedPrompt,
        timestamp: batchTimestamp,
        aspectRatio: selectedAspectRatio,
        isLoading: true,
        loadingStatus: "Submitting...",
      }))

      // Add placeholder cards to the gallery immediately
      setGeneratedImages(prev => [...placeholderImages, ...prev])
      
      // Step 3: Submit generation request
      const generateResponse = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: translatedPrompt,
          aspectRatio: selectedAspectRatio,
        }),
      })

      if (!generateResponse.ok) throw new Error("Image generation submission failed")

      const { request_id } = await generateResponse.json()
      console.log("Generation submitted with ID:", request_id)

      // Update placeholder status
      setGeneratedImages(prev => prev.map(img => 
        img.id.startsWith(`loading-${batchTimestamp}`)
          ? { ...img, loadingStatus: "In queue..." }
          : img
      ))

      // Step 4: Poll for results and update cards as they complete
      const pollForResults = async () => {
        while (true) {
          const statusResponse = await fetch(`/api/generate-image/status?requestId=${request_id}`)
          
          if (!statusResponse.ok) {
            throw new Error("Failed to check generation status")
          }
          
          const statusData = await statusResponse.json()
          console.log("Generation status:", statusData.status)
          
          // Update loading status
          const newStatus = statusData.status === "IN_PROGRESS" ? "Generating..." : 
                           statusData.status === "IN_QUEUE" ? "In queue..." : "Processing..."
          
          setGeneratedImages(prev => prev.map(img => 
            img.id.startsWith(`loading-${batchTimestamp}`)
              ? { ...img, loadingStatus: newStatus }
              : img
          ))
          
          if (statusData.status === "COMPLETED") {
            // Replace placeholder cards with actual images
            const generatedImageUrls = statusData.generatedImageUrls
            const newImages: GeneratedImage[] = generatedImageUrls.map((imageData: any, index: number) => ({
              id: `${batchTimestamp}-${index}`,
              url: typeof imageData === 'string' ? imageData : imageData.url,
              prompt: translatedPrompt,
              timestamp: batchTimestamp,
              aspectRatio: selectedAspectRatio,
              width: typeof imageData === 'object' ? imageData.width : undefined,
              height: typeof imageData === 'object' ? imageData.height : undefined,
            }))

            // Replace placeholder images with actual ones
            setGeneratedImages(prev => [
              ...newImages,
              ...prev.filter(img => !img.id.startsWith(`loading-${batchTimestamp}`))
            ])

            toast({
              title: "Images generated successfully!",
              description: `Generated ${newImages.length} images`,
            })
            break
          } else if (statusData.status === "FAILED") {
            // Remove placeholder cards on failure
            setGeneratedImages(prev => prev.filter(img => !img.id.startsWith(`loading-${batchTimestamp}`)))
            throw new Error("Image generation failed")
          }
          
          // Wait 2 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      await pollForResults()
      setTextInput("")
      
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }, [selectedAspectRatio, toast])

  const processTextCommand = useCallback(async (userCommand: string) => {
    if (!userCommand.trim()) {
      toast({
        title: "Missing command",
        description: "Please enter a command",
        variant: "destructive",
      })
      return
    }

    await generateImagesFromText(userCommand)
  }, [generateImagesFromText, toast])

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
      setTranscription(transcription)

      await generateImagesFromText(transcription)
    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    }
  }, [generateImagesFromText, toast])

  const handleButtonPress = useCallback(async () => {
    // If there's text, process it immediately (don't wait for release)
    if (textInput.trim()) {
      processTextCommand(textInput)
      return
    }
    // Otherwise start recording
    await startRecording()
  }, [textInput, processTextCommand, startRecording])

  const handleButtonRelease = useCallback(async () => {
    // Only handle release for voice recording (when there's no text)
    if (!textInput.trim()) {
      const audioBlob = await stopRecording()
      if (audioBlob) {
        processVoiceCommand(audioBlob)
      }
    }
  }, [textInput, stopRecording, processVoiceCommand])

  const handleButtonClick = useCallback(() => {
    // Handle single click for text input
    if (textInput.trim()) {
      processTextCommand(textInput)
    }
  }, [textInput, processTextCommand])

  const createNewSession = useCallback(() => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      thumbnail: "/placeholder.svg",
      name: `Session ${sessions.length + 1}`,
      timestamp: Date.now(),
      images: [],
      videos: [],
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setGeneratedImages([])
    setGeneratedVideos([])
    setTranscription("")
    setTranslatedPrompt("")
    setTextInput("")
  }, [sessions.length])

  const loadSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    
    setCurrentSessionId(sessionId)
    setGeneratedImages(session.images)
    setGeneratedVideos(session.videos || [])
    setTranscription("")
    setTranslatedPrompt("")
    setTextInput("")
  }, [sessions])

  const deleteImage = useCallback((imageId: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== imageId))
    toast({
      title: "Image deleted",
      description: "Image removed from gallery",
    })
  }, [toast])

  const deleteVideo = useCallback((videoId: string) => {
    setGeneratedVideos(prev => prev.filter(vid => vid.id !== videoId))
    toast({
      title: "Video deleted",
      description: "Video removed from gallery",
    })
  }, [toast])

  const downloadImage = useCallback(async (imageUrl: string, imageName?: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = imageName || `image-${Date.now()}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({
        title: "Download started",
        description: "Image is being downloaded",
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download image",
        variant: "destructive",
      })
    }
  }, [toast])

  const animateImage = useCallback(async (image: GeneratedImage) => {
    const batchTimestamp = Date.now()
    
    try {
      // Set animating state
      setGeneratedImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, isAnimating: true } : img
      ))

      // Create single placeholder loading video card immediately
      const placeholderVideo: GeneratedVideo = {
        id: `video-loading-${batchTimestamp}`,
        url: "",
        prompt: image.prompt,
        timestamp: batchTimestamp,
        sourceImageId: image.id,
        sourceImageUrl: image.url,
        isLoading: true,
        loadingStatus: "Creating video...",
      }

      // Add placeholder video card to the gallery immediately
      setGeneratedVideos(prev => [placeholderVideo, ...prev])

      toast({
        title: "Creating video...",
        description: "Generating video with Kling AI",
      })

      // Submit animation request to Kling API
      const animateResponse = await fetch("/api/animate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: image.url,
          prompt: image.prompt,
        }),
      })

      if (!animateResponse.ok) throw new Error("Animation failed")

      const { videoUrls } = await animateResponse.json()

      // Create actual video object
      const newVideo: GeneratedVideo = {
        id: `video-${batchTimestamp}`,
        url: videoUrls[0], // Take the first (and only) video
        prompt: image.prompt,
        timestamp: batchTimestamp,
        sourceImageId: image.id,
        sourceImageUrl: image.url,
      }

      // Replace placeholder video with actual one
      setGeneratedVideos(prev => [
        newVideo,
        ...prev.filter(vid => vid.id !== `video-loading-${batchTimestamp}`)
      ])

      // Clear animating state and store video URLs reference in image
      setGeneratedImages(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, isAnimating: false, videoUrls } 
          : img
      ))

      toast({
        title: "Video created!",
        description: "Kling AI video generation completed",
      })
    } catch (error) {
      // Remove placeholder video on failure
      setGeneratedVideos(prev => prev.filter(vid => vid.id !== `video-loading-${batchTimestamp}`))
      setGeneratedImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, isAnimating: false } : img
      ))
      toast({
        title: "Video generation failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    }
  }, [toast])

  const handleEditImage = useCallback((image: GeneratedImage) => {
    setCanvasImage(image)
    setIsCanvasMode(true)
  }, [])

  const handleCanvasImageSelect = useCallback((image: GeneratedImage) => {
    setCanvasImage(image)
  }, [])

  const handleCloseCanvas = useCallback(() => {
    setIsCanvasMode(false)
    setCanvasImage(null)
  }, [])

  const handleInpaintImage = useCallback(async (imageUrl: string, maskUrl: string, prompt: string) => {
    try {
      toast({
        title: "Starting inpainting...",
        description: "Processing your request",
      })

      const response = await fetch("/api/inpaint-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          maskDataUrl: maskUrl,
          prompt,
        }),
      })

      if (!response.ok) throw new Error("Inpainting failed")

      const { inpaintedImageUrl, message } = await response.json()

      // Add the inpainted image to the gallery
      const newImage: GeneratedImage = {
        id: `inpainted-${Date.now()}`,
        url: inpaintedImageUrl,
        prompt: `Inpainted: ${prompt}`,
        timestamp: Date.now(),
        aspectRatio: "1:1", // You might want to detect this from the original image
      }

      setGeneratedImages(prev => [newImage, ...prev])

      toast({
        title: "Inpainting completed!",
        description: message || "Your image has been inpainted successfully",
      })

    } catch (error) {
      toast({
        title: "Inpainting failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
      throw error
    }
  }, [toast])

  // Auto-save session when images or videos change
  useEffect(() => {
    if (currentSessionId && (generatedImages.length > 0 || generatedVideos.length > 0)) {
      setSessions(prev => prev.map(session => 
        session.id === currentSessionId 
          ? {
              ...session,
              images: generatedImages,
              videos: generatedVideos,
              thumbnail: generatedImages[0]?.url || generatedVideos[0]?.sourceImageUrl || "/placeholder.svg",
              timestamp: Date.now(),
            }
          : session
      ))
    }
  }, [currentSessionId, generatedImages, generatedVideos])

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (contentAreaRef.current) {
      const scrollToBottom = () => {
        contentAreaRef.current?.scrollTo({
          top: contentAreaRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
      
      // Small delay to ensure content is rendered
      const timeoutId = setTimeout(scrollToBottom, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [generatedImages.length, generatedVideos.length])

  // Create initial session
  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession()
    }
  }, [sessions.length, createNewSession])

  return (
    <AuthCheck>
    <div className="min-h-screen bg-neutral-950 flex text-neutral-300">
      <SessionSidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onCreateNewSession={createNewSession}
        onLoadSession={loadSession}
      />
      
      <div className="flex-1 flex flex-col">
        {/* Header with Film Tool Button */}
        <div className="p-4 border-b border-neutral-800/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Creative Studio</h2>
              <p className="text-sm text-neutral-400">Generate images or create film projects</p>
            </div>
            <Button
              onClick={() => setIsFilmToolOpen(true)}
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Film className="w-4 h-4" />
              Film Tool
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div ref={contentAreaRef} className="flex-1 overflow-y-auto p-6">
          <UnifiedFeed
            images={generatedImages}
            videos={generatedVideos}
            onImageClick={setModalImage}
            onEditImage={handleEditImage}
            onAnimateImage={animateImage}
            onDownloadImage={downloadImage}
            onDeleteImage={deleteImage}
            onDeleteVideo={deleteVideo}
          />
        </div>
      </div>

      {/* Fixed Bottom Controls */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20">
        <div className="p-4 min-w-96">
          <div className="flex items-center justify-center gap-4">
            <select
              value={selectedAspectRatio}
              onChange={(e) => setSelectedAspectRatio(e.target.value)}
              disabled={isRecording}
              className="bg-neutral-900/50 border border-neutral-800/50 text-neutral-400 text-xs rounded px-3 py-2 font-mono min-w-[70px] focus:outline-none focus:border-neutral-700 h-10"
              style={{ colorScheme: 'dark' }}
            >
              {supportedAspectRatios.map(({ ratio }) => (
                <option key={ratio} value={ratio} className="bg-neutral-900 text-neutral-400">
                  {ratio}
                </option>
              ))}
            </select>
            
            <Input
              type="text"
              placeholder={textInput.trim() ? "Click submit to generate..." : "Type to generate images or hold to speak..."}
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
              Generating images...
            </div>
          ) : isRecording ? (
            <div className="text-center text-sm text-red-400 mt-3 animate-pulse">
              Recording... Release to process
            </div>
          ) : textInput.trim() ? (
            <div className="text-center text-sm text-green-400 mt-3">
              Click submit or press Enter to generate
            </div>
          ) : (
            <div className="text-center text-sm text-neutral-600 mt-3">
              Type your prompt or hold button to record voice
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
        imageUrl={modalImage?.url || ""}
        prompt={modalImage?.prompt || ""}
        timestamp={modalImage?.timestamp}
      />

      {/* Canvas Mode */}
      <CanvasMode
        isOpen={isCanvasMode}
        onClose={handleCloseCanvas}
        currentImage={canvasImage}
        images={generatedImages.filter(img => !img.isLoading)}
        onImageSelect={handleCanvasImageSelect}
        onAnimateImage={animateImage}
        onDownloadImage={downloadImage}
        onInpaintImage={handleInpaintImage}
      />

      {/* Film Tool */}
      {isFilmToolOpen && (
        <FilmToolApp onClose={() => setIsFilmToolOpen(false)} />
      )}
    </div>
    </AuthCheck>
  )
}
