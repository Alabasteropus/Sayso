"use client"

import React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, Upload, Undo2, Loader2, Moon, Sun, Send, Type, ChevronLeft, ChevronRight, X, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "next-themes"

interface EditHistory {
  originalImage: string
  editedImage: string
  prompt: string
  timestamp: number
  id: string
}

interface Session {
  id: string
  thumbnail: string
  name: string
  timestamp: number
  selectedImage: string | null
  editedImage: string | null
  history: EditHistory[]
  currentHistoryIndex: number
  detectedAspectRatio: string
  originalImageDescription: string
  currentImageDescription: string
}

export default function VoiceImageEditor() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStep, setProcessStep] = useState<string>("")
  const [editedImage, setEditedImage] = useState<string | null>(null)
  const [history, setHistory] = useState<EditHistory[]>([])
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcription, setTranscription] = useState<string>("")
  const [translatedPrompt, setTranslatedPrompt] = useState<string>("")
  const [textInput, setTextInput] = useState<string>("")
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1) // -1 means current/latest image
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<string>("1:1")
  const [originalImageDescription, setOriginalImageDescription] = useState<string>("")
  const [currentImageDescription, setCurrentImageDescription] = useState<string>("")
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("1:1")
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [imageDescriptionCache, setImageDescriptionCache] = useState<Record<string, string>>({})

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  // Supported aspect ratios from Fal AI API
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

  const detectAndCropImage = useCallback((imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(imageSrc)

        const imageAspectRatio = img.width / img.height
        
        // Find closest supported aspect ratio
        let closestRatio = supportedAspectRatios[0]
        let minDifference = Math.abs(imageAspectRatio - closestRatio.value)
        
        for (const supportedRatio of supportedAspectRatios) {
          const difference = Math.abs(imageAspectRatio - supportedRatio.value)
          if (difference < minDifference) {
            minDifference = difference
            closestRatio = supportedRatio
          }
        }

        // Store the original aspect ratio as a custom ratio string
        const originalRatio = `${img.width}:${img.height}`
        setDetectedAspectRatio(originalRatio)

        // Don't crop - preserve original dimensions
        canvas.width = img.width
        canvas.height = img.height

        // Draw original image at full resolution
        ctx.drawImage(img, 0, 0)

        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }
      img.src = imageSrc
    })
  }, [supportedAspectRatios])

  const describeImage = useCallback(async (imageDataUrl: string, showAnimation: boolean = true): Promise<string> => {
    try {
      if (showAnimation) {
        setIsAnalyzingImage(true)
      }
      
      // Convert data URL to base64
      const base64 = imageDataUrl.split(',')[1] || ''
      
      if (!base64) {
        console.warn('No base64 data found in image URL')
        return ''
      }
      
      const response = await fetch('/api/describe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Image description API failed:', response.status, errorData)
        return ''
      }

      const { description } = await response.json()
      console.log('Image described successfully:', description?.substring(0, 100) + '...')
      return description || ''
    } catch (error) {
      console.error('Failed to describe image:', error)
      return ''
    } finally {
      if (showAnimation) {
        setIsAnalyzingImage(false)
      }
    }
  }, [])

  // Function to get or generate image description with caching
  const getImageDescription = useCallback(async (imageUrl: string, isInitial = false): Promise<string> => {
    // Check cache first
    if (imageDescriptionCache[imageUrl]) {
      return imageDescriptionCache[imageUrl]
    }
    
    // Generate new description
    try {
      const description = await describeImage(imageUrl, isInitial)
      
      // Cache the description
      setImageDescriptionCache(prev => ({
        ...prev,
        [imageUrl]: description
      }))
      
      return description
    } catch (error) {
      console.error('Failed to describe image:', error)
      const fallbackDescription = isInitial 
        ? "Image uploaded and ready for editing" 
        : "Image ready for editing"
      
      // Cache the fallback description
      setImageDescriptionCache(prev => ({
        ...prev,
        [imageUrl]: fallbackDescription
      }))
      
      return fallbackDescription
    }
  }, [imageDescriptionCache, describeImage])

  const generateImageFromText = useCallback(async (userCommand: string) => {
    setIsProcessing(true)
    
    try {
      // Step 1: Set the transcription to the text input
      setTranscription(userCommand)

      // Step 2: Translate prompt with Gemini Flash (no image context)
      setProcessStep("Creating image prompt...")
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

      // Step 3: Generate image with FLUX
      setProcessStep("Generating image...")
      
      // Determine aspect ratio: use current canvas image's aspect ratio if available,
      // otherwise use the user's selected aspect ratio
      const currentImage = getCurrentImageDisplay()
      const aspectRatioToUse = currentImage ? detectedAspectRatio : selectedAspectRatio
      
      console.log('Sending to generate-image API:', {
        prompt: translatedPrompt,
        aspectRatio: aspectRatioToUse,
        hasCurrentImage: !!currentImage,
        detectedAspectRatio,
        selectedAspectRatio,
      })
      const generateResponse = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: translatedPrompt,
          aspectRatio: aspectRatioToUse,
        }),
      })

      if (!generateResponse.ok) throw new Error("Image generation failed")

      const { generatedImageUrl } = await generateResponse.json()

      // Set the generated image as the selected image
      setSelectedImage(generatedImageUrl)
      setEditedImage(null)
      setHistory([])
      setCurrentHistoryIndex(-1)
      setDetectedAspectRatio(aspectRatioToUse)
      
      // Describe the generated image using cached function
      const description = await getImageDescription(generatedImageUrl, true)
      setOriginalImageDescription(description)
      setCurrentImageDescription(description)
      
      setTextInput("")
      toast({
        title: "Image generated successfully!",
        description: "Your image has been created",
      })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setProcessStep("")
    }
  }, [describeImage, toast])

  // Session management functions
  const createNewSession = useCallback(() => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      thumbnail: "/placeholder.svg",
      name: `Session ${sessions.length + 1}`,
      timestamp: Date.now(),
      selectedImage: null,
      editedImage: null,
      history: [],
      currentHistoryIndex: -1,
      detectedAspectRatio: "1:1",
      originalImageDescription: "",
      currentImageDescription: "",
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    
    // Clear current state
    setSelectedImage(null)
    setEditedImage(null)
    setHistory([])
    setCurrentHistoryIndex(-1)
    setDetectedAspectRatio("1:1")
    setOriginalImageDescription("")
    setCurrentImageDescription("")
    setTranscription("")
    setTranslatedPrompt("")
    setTextInput("")
  }, [sessions.length])

  const saveCurrentSession = useCallback(() => {
    if (!currentSessionId) return
    
    const currentImage = editedImage || selectedImage
    if (!currentImage) return
    
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? {
            ...session,
            thumbnail: currentImage,
            selectedImage,
            editedImage,
            history,
            currentHistoryIndex,
            detectedAspectRatio,
            originalImageDescription,
            currentImageDescription,
            timestamp: Date.now(),
          }
        : session
    ))
  }, [currentSessionId, selectedImage, editedImage, history, currentHistoryIndex, detectedAspectRatio, originalImageDescription, currentImageDescription])

  const loadSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    
    setCurrentSessionId(sessionId)
    setSelectedImage(session.selectedImage)
    setEditedImage(session.editedImage)
    setHistory(session.history)
    setCurrentHistoryIndex(session.currentHistoryIndex)
    setDetectedAspectRatio(session.detectedAspectRatio)
    setOriginalImageDescription(session.originalImageDescription)
    setCurrentImageDescription(session.currentImageDescription)
    setTranscription("")
    setTranslatedPrompt("")
    setTextInput("")
  }, [sessions])

  // Auto-save session when state changes
  useEffect(() => {
    if (currentSessionId && (selectedImage || editedImage)) {
      saveCurrentSession()
    }
  }, [currentSessionId, selectedImage, editedImage, history, currentHistoryIndex, saveCurrentSession])

  // Create initial session
  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession()
    }
  }, [sessions.length, createNewSession])

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleImageUpload called', event.target.files)
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      console.log('File selected:', file.name, file.type)
      const reader = new FileReader()
      reader.onload = async (e) => {
        console.log('File read successfully')
        const originalImage = e.target?.result as string
        
        // Process image first to show it immediately
        const processedImage = await detectAndCropImage(originalImage)
        
        // Show image immediately
        setSelectedImage(processedImage)
        setEditedImage(null)
        setTranscription("")
        setTranslatedPrompt("")
        setTextInput("")
        setHistory([])
        setCurrentHistoryIndex(-1)
        
        // Show toast for image loaded
        setTimeout(() => {
          toast({
            title: "Image loaded",
            description: `Loaded at ${detectedAspectRatio} dimensions`,
          })
        }, 100)
        
        // Upload image to Supabase Storage in background
        try {
          // Convert data URL to blob for upload
          const response = await fetch(processedImage)
          const blob = await response.blob()
          
          // Create form data
          const formData = new FormData()
          formData.append('file', blob, `upload_${Date.now()}.${blob.type.split('/')[1]}`)
          formData.append('bucket', 'original-images')
          formData.append('session_id', currentSessionId)
          
          // Upload to Supabase
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })
          
          if (uploadResponse.ok) {
            const { url: uploadedUrl } = await uploadResponse.json()
            console.log('Image uploaded to Supabase:', uploadedUrl)
            
            // Update the selected image to use the uploaded URL
            setSelectedImage(uploadedUrl)
          }
        } catch (error) {
          console.error('Failed to upload image to Supabase:', error)
          // Continue with local image if upload fails
        }
        
        // Get description in background using cached function
        try {
          const description = await getImageDescription(originalImage, true)
          setOriginalImageDescription(description)
          setCurrentImageDescription(description)
          
          // Show toast when description is ready
          setTimeout(() => {
            toast({
              title: "Image analyzed",
              description: "Ready for editing",
            })
          }, 100)
        } catch (error) {
          console.error('Failed to describe image:', error)
          // Set fallback description
          setOriginalImageDescription("Image uploaded and ready for editing")
          setCurrentImageDescription("Image uploaded and ready for editing")
        }
      }
      reader.readAsDataURL(file)
    } else {
      console.log('No valid image file selected')
    }
  }, [detectAndCropImage, describeImage, detectedAspectRatio, toast])

  const processTextCommand = useCallback(
    async (userCommand: string) => {
      if (!userCommand.trim()) {
        toast({
          title: "Missing command",
          description: "Please enter a command",
          variant: "destructive",
        })
        return
      }

      // If no image selected, use text-to-image mode
      if (!selectedImage) {
        await generateImageFromText(userCommand)
        return
      }

      setIsProcessing(true)

      try {
        // Step 1: Set the transcription to the text input
        setTranscription(userCommand)

        // Step 2: Translate prompt with Gemini Flash
        setProcessStep("Translating command to precise prompt...")
        const promptResponse = await fetch("/api/translate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            userCommand,
            imageDescription: currentImageDescription 
          }),
        })

        if (!promptResponse.ok) throw new Error("Prompt translation failed")

        const { translatedPrompt } = await promptResponse.json()
        setTranslatedPrompt(translatedPrompt)

        // Step 3: Edit image with Kontext
        setProcessStep("Editing image...")
        
        // Use the user's selected aspect ratio for the output
        console.log('Sending to edit-image API:', {
          imageUrl: getCurrentImageDisplay()?.substring(0, 50) + '...',
          prompt: translatedPrompt,
          aspectRatio: selectedAspectRatio,
        })
        
        const editResponse = await fetch("/api/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: getCurrentImageDisplay(),
            prompt: translatedPrompt,
            aspectRatio: selectedAspectRatio,
          }),
        })

        if (!editResponse.ok) throw new Error("Image editing failed")

        const { editedImageUrl } = await editResponse.json()

        // Save to history
        const historyEntry: EditHistory = {
          originalImage: getCurrentImageDisplay(),
          editedImage: editedImageUrl,
          prompt: translatedPrompt,
          timestamp: Date.now(),
          id: crypto.randomUUID(),
        }
        
        // If we're in the middle of history, create a branch from current point
        if (currentHistoryIndex >= 0) {
          const newHistory = history.slice(currentHistoryIndex)
          setHistory([historyEntry, ...newHistory])
        } else {
          setHistory((prev) => [historyEntry, ...prev])
        }

        setEditedImage(editedImageUrl)
        setCurrentHistoryIndex(-1) // Go back to latest
        setTextInput("")
        
        // Clear loading state immediately when image is ready
        setIsProcessing(false)
        setProcessStep("")
        
        toast({
          title: "Image edited successfully!",
          description: "Your text command has been applied",
        })
        
        // Describe the new edited image in background using cached function
        try {
          const newDescription = await getImageDescription(editedImageUrl, true)
          setCurrentImageDescription(newDescription)
        } catch (error) {
          console.error('Failed to describe edited image:', error)
        }
      } catch (error) {
        toast({
          title: "Processing failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
        setProcessStep("")
      }
    },
    [selectedImage, currentImageDescription, describeImage, toast],
  )

  const processVoiceCommand = useCallback(
    async (audioBlob: Blob) => {
      if (!audioBlob) {
        toast({
          title: "Missing audio",
          description: "Please record a voice command",
          variant: "destructive",
        })
        return
      }

      setIsProcessing(true)

      try {
        // Step 1: Speech to Text
        setProcessStep("Converting speech to text...")

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

        // If no image selected, use text-to-image mode
        if (!selectedImage) {
          await generateImageFromText(transcription)
          return
        }

        // Step 2: Translate prompt with Gemini Flash
        setProcessStep("Translating command to precise prompt...")
        const promptResponse = await fetch("/api/translate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            userCommand: transcription,
            imageDescription: currentImageDescription 
          }),
        })

        if (!promptResponse.ok) throw new Error("Prompt translation failed")

        const { translatedPrompt } = await promptResponse.json()
        setTranslatedPrompt(translatedPrompt)

        // Step 3: Edit image with Kontext
        setProcessStep("Editing image...")
        
        // Use the user's selected aspect ratio for the output
        console.log('Sending to edit-image API:', {
          imageUrl: getCurrentImageDisplay()?.substring(0, 50) + '...',
          prompt: translatedPrompt,
          aspectRatio: selectedAspectRatio,
        })
        
        const editResponse = await fetch("/api/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: getCurrentImageDisplay(),
            prompt: translatedPrompt,
            aspectRatio: selectedAspectRatio,
          }),
        })

        if (!editResponse.ok) throw new Error("Image editing failed")

        const { editedImageUrl } = await editResponse.json()

        // Save to history
        const historyEntry: EditHistory = {
          originalImage: getCurrentImageDisplay(),
          editedImage: editedImageUrl,
          prompt: translatedPrompt,
          timestamp: Date.now(),
          id: crypto.randomUUID(),
        }
        
        // If we're in the middle of history, create a branch from current point
        if (currentHistoryIndex >= 0) {
          const newHistory = history.slice(currentHistoryIndex)
          setHistory([historyEntry, ...newHistory])
        } else {
          setHistory((prev) => [historyEntry, ...prev])
        }

        setEditedImage(editedImageUrl)
        setCurrentHistoryIndex(-1) // Go back to latest
        
        // Clear loading state immediately when image is ready
        setIsProcessing(false)
        setProcessStep("")
        
        toast({
          title: "Image edited successfully!",
          description: "Your voice command has been applied",
        })
        
        // Describe the new edited image in background using cached function
        try {
          const newDescription = await getImageDescription(editedImageUrl, true)
          setCurrentImageDescription(newDescription)
        } catch (error) {
          console.error('Failed to describe edited image:', error)
        }
      } catch (error) {
        toast({
          title: "Processing failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
        setProcessStep("")
      }
    },
    [selectedImage, generateImageFromText, currentImageDescription, describeImage, toast],
  )

  const handleButtonPress = useCallback(async () => {
    // If there's text, submit it as text command
    if (textInput.trim()) {
      processTextCommand(textInput)
      return
    }

    // Otherwise start voice recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Try to use WAV format first, fallback to webm
      let mimeType = "audio/wav"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm"
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      const audioChunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
        // Automatically process the voice command when recording stops
        processVoiceCommand(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Please check microphone permissions",
        variant: "destructive",
      })
    }
  }, [textInput, processTextCommand, toast, processVoiceCommand])

  const handleButtonRelease = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const navigateTimeline = useCallback((direction: "back" | "forward") => {
    if (history.length === 0) {
      console.log('No history available for navigation')
      return
    }
    
    // Total positions: original + all edits
    const totalPositions = history.length + 1
    
    // Current position in timeline (0 = original, 1 = first edit, 2 = second edit, etc.)
    let currentPosition = 0
    if (currentHistoryIndex === history.length) {
      currentPosition = 0 // original
    } else if (currentHistoryIndex === -1) {
      currentPosition = 1 // latest edit (first in history array)
    } else {
      currentPosition = currentHistoryIndex + 1
    }
    
    if (direction === "back") {
      // Left arrow: go to previous (older) in timeline
      const newPosition = currentPosition === 0 ? totalPositions - 1 : currentPosition - 1
      
      if (newPosition === 0) {
        // Go to original
        setCurrentHistoryIndex(history.length)
        setEditedImage(null)
        setCurrentImageDescription(originalImageDescription)
      } else {
        // Go to edit
        const editIndex = newPosition - 1
        if (editIndex === 0) {
          setCurrentHistoryIndex(-1) // latest
          setEditedImage(history[0]?.editedImage || null)
          // For latest, describe current image
          if (history[0]?.editedImage) {
            getImageDescription(history[0].editedImage, false).then(setCurrentImageDescription)
          }
        } else {
          setCurrentHistoryIndex(editIndex)
          setEditedImage(history[editIndex]?.editedImage || null)
          // Describe historical image
          if (history[editIndex]?.editedImage) {
            getImageDescription(history[editIndex].editedImage, false).then(setCurrentImageDescription)
          }
        }
      }
    } else {
      // Right arrow: go to next (newer) in timeline
      const newPosition = (currentPosition + 1) % totalPositions
      
      if (newPosition === 0) {
        // Go to original
        setCurrentHistoryIndex(history.length)
        setEditedImage(null)
        setCurrentImageDescription(originalImageDescription)
      } else {
        // Go to edit
        const editIndex = newPosition - 1
        if (editIndex === 0) {
          setCurrentHistoryIndex(-1) // latest
          setEditedImage(history[0]?.editedImage || null)
          // For latest, describe current image
          if (history[0]?.editedImage) {
            getImageDescription(history[0].editedImage, false).then(setCurrentImageDescription)
          }
        } else {
          setCurrentHistoryIndex(editIndex)
          setEditedImage(history[editIndex]?.editedImage || null)
          // Describe historical image
          if (history[editIndex]?.editedImage) {
            getImageDescription(history[editIndex].editedImage, false).then(setCurrentImageDescription)
          }
        }
      }
    }
  }, [currentHistoryIndex, history])

  const getCurrentImageDisplay = useCallback(() => {
    if (currentHistoryIndex === -1) {
      // Latest/current image
      return editedImage || selectedImage
    } else if (currentHistoryIndex === history.length) {
      // Original image
      return selectedImage
    } else {
      // Historical image
      return history[currentHistoryIndex]?.editedImage || selectedImage
    }
  }, [currentHistoryIndex, editedImage, selectedImage, history])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateTimeline("back")
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateTimeline("forward")
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateTimeline])

  const currentImage = getCurrentImageDisplay()

  return (
    <div className="min-h-screen bg-neutral-950 flex">
      {/* Session Sidebar */}
      <div className="w-16 bg-neutral-900/50 border-r border-neutral-800/50 flex flex-col p-2 gap-2">
        {/* New Session Button */}
        <Button
          onClick={createNewSession}
          variant="ghost"
          size="icon"
          className="w-12 h-12 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-400 hover:text-neutral-300 border border-neutral-700/50 hover:border-neutral-600/50 transition-all"
        >
          <Plus className="w-5 h-5" suppressHydrationWarning />
        </Button>
        
        {/* Session Thumbnails */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {sessions.map((session) => (
            <Button
              key={session.id}
              onClick={() => loadSession(session.id)}
              variant="ghost"
              size="icon"
              className={`w-12 h-12 rounded-lg p-0 border transition-all ${
                currentSessionId === session.id
                  ? 'bg-orange-800/30 border-orange-600/50 hover:bg-orange-800/40'
                  : 'bg-neutral-800/50 hover:bg-neutral-700/50 border-neutral-700/50 hover:border-neutral-600/50'
              }`}
            >
              <img
                src={session.thumbnail}
                alt={session.name}
                className="w-full h-full object-cover rounded-lg"
              />
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!selectedImage ? (
          /* Upload State with Full Interface */
          <div className="flex-1 relative overflow-hidden">
            {/* Full Screen Upload Area - Same sizing as image display */}
            <div className="absolute inset-0 flex items-center justify-center p-5">
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('Upload area clicked', fileInputRef.current)
                      if (fileInputRef.current) {
                        fileInputRef.current.click()
                      }
                    }}
                    className="border-2 border-dashed border-neutral-800/50 rounded-2xl p-16 cursor-pointer hover:border-neutral-700/70 transition-colors group bg-neutral-900/50"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-600 group-hover:text-neutral-500 transition-colors" suppressHydrationWarning />
                    <p className="text-neutral-600 group-hover:text-neutral-500 transition-colors mb-4">
                      Click to upload an image
                    </p>
                    <p className="text-neutral-700 text-sm">
                      or type/speak to generate with FLUX
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transcription Results - Bottom Right */}
            {(transcription || translatedPrompt) && !isProcessing && (
              <div className="absolute bottom-3 right-3 z-10 max-w-xs space-y-1 opacity-40 hover:opacity-90 transition-opacity duration-300 ease-in-out group">
                {transcription && (
                  <div className="text-right p-2 bg-black/60 backdrop-blur-sm rounded-sm text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                    <span className="text-neutral-600 text-[10px] group-hover:text-neutral-500 transition-colors duration-300">you:</span>
                    <div>"{transcription}"</div>
                  </div>
                )}
                {translatedPrompt && (
                  <div className="text-right p-2 bg-black/70 backdrop-blur-sm rounded-sm text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors duration-300">
                    <span className="text-neutral-600 text-[10px] group-hover:text-neutral-500 transition-colors duration-300">ai:</span>
                    <div>"{translatedPrompt}"</div>
                  </div>
                )}
              </div>
            )}

            {/* Floating Controls - Bottom Center - Always Visible */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
              <div className="p-4 min-w-96">
                {/* Simplified Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Text Input with Aspect Ratio Selector */}
                  <div className="relative flex items-center gap-2">
                    {/* Aspect Ratio Selector - Available for both text-to-image and image editing */}
                    <select
                      value={selectedAspectRatio}
                      onChange={(e) => {
                        console.log('Aspect ratio changed to:', e.target.value)
                        setSelectedAspectRatio(e.target.value)
                      }}
                      disabled={isProcessing || isRecording}
                      className="bg-neutral-900/50 border border-neutral-800/50 text-neutral-400 text-xs rounded px-3 py-2 font-mono min-w-[70px] focus:outline-none focus:border-neutral-700 h-10 custom-select"
                      style={{
                        colorScheme: 'dark'
                      }}
                      title={selectedImage ? "Output aspect ratio for edited image" : "Aspect ratio for generated image"}
                    >
                      <option value="21:9" className="bg-neutral-900 text-neutral-400">21:9</option>
                      <option value="16:9" className="bg-neutral-900 text-neutral-400">16:9</option>
                      <option value="4:3" className="bg-neutral-900 text-neutral-400">4:3</option>
                      <option value="3:2" className="bg-neutral-900 text-neutral-400">3:2</option>
                      <option value="1:1" className="bg-neutral-900 text-neutral-400">1:1</option>
                      <option value="2:3" className="bg-neutral-900 text-neutral-400">2:3</option>
                      <option value="3:4" className="bg-neutral-900 text-neutral-400">3:4</option>
                      <option value="9:16" className="bg-neutral-900 text-neutral-400">9:16</option>
                      <option value="9:21" className="bg-neutral-900 text-neutral-400">9:21</option>
                    </select>
                    
                    <Input
                      type="text"
                      placeholder={selectedImage ? "Type edit command or hold to speak..." : "Type to generate image or hold to speak..."}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={isProcessing || isRecording}
                      className="w-80 text-center bg-neutral-900/50 border-neutral-800/50 text-neutral-400 placeholder:text-neutral-600"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isProcessing && textInput.trim()) {
                          processTextCommand(textInput)
                        }
                      }}
                    />
                  </div>

                  {/* Smart Submit/Record Button */}
                  <Button
                    onMouseDown={handleButtonPress}
                    onMouseUp={handleButtonRelease}
                    onMouseLeave={handleButtonRelease}
                    onTouchStart={handleButtonPress}
                    onTouchEnd={handleButtonRelease}
                    disabled={isProcessing}
                    size="lg"
                    className={`w-20 h-20 rounded-full p-0 transition-all duration-200 ${
                      isRecording
                        ? "bg-red-800 hover:bg-red-900 text-neutral-300 scale-110 shadow-lg shadow-red-800/25"
                        : textInput.trim()
                        ? "bg-green-800 hover:bg-green-900 text-neutral-300 shadow-lg hover:scale-105"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-500 shadow-lg hover:scale-105"
                    }`}
                  >
                    {isRecording ? (
                      <MicOff className="w-8 h-8" suppressHydrationWarning />
                    ) : textInput.trim() ? (
                      <Send className="w-8 h-8" suppressHydrationWarning />
                    ) : (
                      <Mic className="w-8 h-8" suppressHydrationWarning />
                    )}
                  </Button>
                </div>

                {/* Status Text */}
                {isRecording && (
                  <div className="text-center text-sm text-neutral-600 mt-3 animate-pulse">
                    Recording... Release to process
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Full Screen Image Display with Timeline */
          <div className="flex-1 relative overflow-hidden">
            {/* Main Image - Centered with Consistent Margins */}
            <div className="absolute inset-0 flex items-center justify-center p-5">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={currentImage || "/placeholder.svg"}
                  alt="Current image"
                  className="rounded-lg shadow-2xl"
                  style={{
                    maxWidth: 'calc(100% - 40px)',
                    maxHeight: 'calc(100% - 40px)',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                />

                {/* Aspect Ratio Badge - Top Left */}
                {detectedAspectRatio && (
                  <div className="absolute top-3 left-3 z-10">
                    <span className="text-xs text-neutral-500 bg-black/40 backdrop-blur-sm px-2 py-1 rounded font-mono">
                      {detectedAspectRatio}
                    </span>
                  </div>
                )}

                {/* Action Buttons - Top Right */}
                <div className="absolute top-3 right-3 z-10 flex gap-2">
                  <Button
                    onClick={createNewSession}
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-neutral-500 hover:text-neutral-400 border-0 shadow-lg transition-all hover:scale-110"
                  >
                    <X className="w-4 h-4" suppressHydrationWarning />
                    <span className="sr-only">Clear image</span>
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (fileInputRef.current) {
                        fileInputRef.current.click()
                      }
                    }}
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-neutral-500 hover:text-neutral-400 border-0 shadow-lg transition-all hover:scale-110"
                  >
                    <Upload className="w-4 h-4" suppressHydrationWarning />
                    <span className="sr-only">Change image</span>
                  </Button>
                </div>

                {/* Vision Analysis Overlay */}
                {isAnalyzingImage && (
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
                    <div className="relative">
                      {/* Animated scanning lines */}
                      <div className="absolute inset-0 rounded-lg border-2 border-blue-400/30 animate-pulse">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-horizontal"></div>
                        <div className="absolute top-0 left-0 h-full w-0.5 bg-gradient-to-b from-transparent via-blue-400 to-transparent animate-scan-vertical"></div>
                      </div>
                      
                      {/* Corner brackets */}
                      <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl animate-pulse"></div>
                      <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr animate-pulse"></div>
                      <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl animate-pulse"></div>
                      <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br animate-pulse"></div>
                      
                      {/* Subtle status text */}
                      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                        <span className="text-xs text-blue-400/80 bg-black/40 backdrop-blur-sm px-3 py-1 rounded font-mono">
                          analyzing...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <div className="text-center bg-black/80 p-6 rounded-lg shadow-lg">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-neutral-400" suppressHydrationWarning />
                      <p className="text-sm text-neutral-500">{processStep}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Strip - Top Center */}
            {selectedImage && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20">
                <div className="flex gap-2">
                  {/* Original Image */}
                  <div 
                    className={`cursor-pointer transition-all duration-200 ${
                      currentHistoryIndex === history.length ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-70'
                    }`}
                    onClick={() => {
                      setCurrentHistoryIndex(history.length)
                      setEditedImage(null)
                      setCurrentImageDescription(originalImageDescription)
                    }}
                  >
                    <img
                      src={selectedImage}
                      alt="Original"
                      className="w-16 h-16 object-cover rounded border-2 border-neutral-600/50"
                    />
                  </div>
                  
                  {/* History Images */}
                  {history.map((item, index) => {
                    const isActive = currentHistoryIndex === index || (currentHistoryIndex === -1 && index === 0)
                    
                    return (
                      <div 
                        key={item.id}
                        className={`cursor-pointer transition-all duration-200 ${
                          isActive ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-70'
                        }`}
                        onClick={() => {
                          if (index === 0) {
                            setCurrentHistoryIndex(-1)
                            setEditedImage(history[0]?.editedImage || null)
                            if (history[0]?.editedImage) {
                              getImageDescription(history[0].editedImage, false).then(setCurrentImageDescription)
                            }
                          } else {
                            setCurrentHistoryIndex(index)
                            setEditedImage(history[index]?.editedImage || null)
                            if (history[index]?.editedImage) {
                              describeImage(history[index].editedImage, false).then(setCurrentImageDescription)
                            }
                          }
                        }}
                      >
                        <img
                          src={item.editedImage}
                          alt={`Edit ${index + 1}`}
                          className="w-16 h-16 object-cover rounded border-2 border-neutral-600/50"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}


            {/* Transcription Results - Bottom Right */}
            {(transcription || translatedPrompt) && !isProcessing && (
              <div className="absolute bottom-3 right-3 z-10 max-w-xs space-y-1 opacity-40 hover:opacity-90 transition-opacity duration-300 ease-in-out group">
                {transcription && (
                  <div className="text-right p-2 bg-black/60 backdrop-blur-sm rounded-sm text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                    <span className="text-neutral-600 text-[10px] group-hover:text-neutral-500 transition-colors duration-300">you:</span>
                    <div>"{transcription}"</div>
                  </div>
                )}
                {translatedPrompt && (
                  <div className="text-right p-2 bg-black/70 backdrop-blur-sm rounded-sm text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors duration-300">
                    <span className="text-neutral-600 text-[10px] group-hover:text-neutral-500 transition-colors duration-300">ai:</span>
                    <div>"{translatedPrompt}"</div>
                  </div>
                )}
              </div>
            )}

            {/* Floating Controls - Bottom Center */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
              <div className="p-4 min-w-96">

                {/* Simplified Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Aspect Ratio Selector - Available for image editing */}
                  <select
                    value={selectedAspectRatio}
                    onChange={(e) => {
                      console.log('Aspect ratio changed to:', e.target.value)
                      setSelectedAspectRatio(e.target.value)
                    }}
                    disabled={isProcessing || isRecording}
                    className="bg-neutral-900/50 border border-neutral-800/50 text-neutral-400 text-xs rounded px-3 py-2 font-mono min-w-[70px] focus:outline-none focus:border-neutral-700 h-10 custom-select"
                    style={{
                      colorScheme: 'dark'
                    }}
                    title="Output aspect ratio for edited image"
                  >
                    <option value="21:9" className="bg-neutral-900 text-neutral-400">21:9</option>
                    <option value="16:9" className="bg-neutral-900 text-neutral-400">16:9</option>
                    <option value="4:3" className="bg-neutral-900 text-neutral-400">4:3</option>
                    <option value="3:2" className="bg-neutral-900 text-neutral-400">3:2</option>
                    <option value="1:1" className="bg-neutral-900 text-neutral-400">1:1</option>
                    <option value="2:3" className="bg-neutral-900 text-neutral-400">2:3</option>
                    <option value="3:4" className="bg-neutral-900 text-neutral-400">3:4</option>
                    <option value="9:16" className="bg-neutral-900 text-neutral-400">9:16</option>
                    <option value="9:21" className="bg-neutral-900 text-neutral-400">9:21</option>
                  </select>
                  
                  {/* Text Input */}
                  <Input
                    type="text"
                    placeholder={selectedImage ? "Type edit command or hold to speak..." : "Type to generate image or hold to speak..."}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    disabled={isProcessing || isRecording}
                    className="w-80 text-center bg-neutral-900/50 border-neutral-800/50 text-neutral-400 placeholder:text-neutral-600"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !isProcessing && textInput.trim()) {
                        processTextCommand(textInput)
                      }
                    }}
                  />

                  {/* Smart Submit/Record Button */}
                  <Button
                    onMouseDown={handleButtonPress}
                    onMouseUp={handleButtonRelease}
                    onMouseLeave={handleButtonRelease}
                    onTouchStart={handleButtonPress}
                    onTouchEnd={handleButtonRelease}
                    disabled={isProcessing}
                    size="lg"
                    className={`w-20 h-20 rounded-full p-0 transition-all duration-200 ${
                      isRecording
                        ? "bg-red-800 hover:bg-red-900 text-neutral-300 scale-110 shadow-lg shadow-red-800/25"
                        : textInput.trim()
                        ? "bg-green-800 hover:bg-green-900 text-neutral-300 shadow-lg hover:scale-105"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-500 shadow-lg hover:scale-105"
                    }`}
                  >
                    {isRecording ? (
                      <MicOff className="w-8 h-8" suppressHydrationWarning />
                    ) : textInput.trim() ? (
                      <Send className="w-8 h-8" suppressHydrationWarning />
                    ) : (
                      <Mic className="w-8 h-8" suppressHydrationWarning />
                    )}
                  </Button>
                </div>

                {/* Status Text */}
                {isRecording && (
                  <div className="text-center text-sm text-neutral-600 mt-3 animate-pulse">
                    Recording... Release to process
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
    </div>
  )
}
