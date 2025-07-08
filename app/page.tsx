"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Upload, Undo2, Loader2, Moon, Sun } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "next-themes"

interface EditHistory {
  originalImage: string
  editedImage: string
  prompt: string
  timestamp: number
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
        setEditedImage(null)
        setTranscription("")
        setTranslatedPrompt("")
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const processVoiceCommand = useCallback(
    async (audioBlob: Blob) => {
      if (!audioBlob || !selectedImage) {
        toast({
          title: "Missing requirements",
          description: "Please select an image first",
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

        // Step 2: Translate prompt with Gemini Flash
        setProcessStep("Translating command to precise prompt...")
        const promptResponse = await fetch("/api/translate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userCommand: transcription }),
        })

        if (!promptResponse.ok) throw new Error("Prompt translation failed")

        const { translatedPrompt } = await promptResponse.json()
        setTranslatedPrompt(translatedPrompt)

        // Step 3: Edit image with Kontext
        setProcessStep("Editing image...")
        const editResponse = await fetch("/api/edit-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: selectedImage,
            prompt: translatedPrompt,
          }),
        })

        if (!editResponse.ok) throw new Error("Image editing failed")

        const { editedImageUrl } = await editResponse.json()

        // Save to history
        const historyEntry: EditHistory = {
          originalImage: selectedImage,
          editedImage: editedImageUrl,
          prompt: translatedPrompt,
          timestamp: Date.now(),
        }
        setHistory((prev) => [historyEntry, ...prev])

        setEditedImage(editedImageUrl)
        toast({
          title: "Image edited successfully!",
          description: "Your voice command has been applied",
        })
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
    [selectedImage, toast],
  )

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mediaRecorder
      const audioChunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
        // Automatically process the voice command when recording stops
        processVoiceCommand(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      toast({
        title: "Recording started",
        description: "Speak your image editing command",
      })
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Please check microphone permissions",
        variant: "destructive",
      })
    }
  }, [toast, processVoiceCommand])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      toast({
        title: "Recording stopped",
        description: "Processing your command...",
      })
    }
  }, [isRecording, toast])

  const undoLastEdit = useCallback(() => {
    if (history.length > 0) {
      setEditedImage(null)
      setHistory((prev) => prev.slice(1))
      toast({
        title: "Edit undone",
        description: "Reverted to previous state",
      })
    }
  }, [history, toast])

  const currentImage = editedImage || selectedImage

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full bg-background/80 backdrop-blur-sm"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {/* Undo button */}
      {history.length > 0 && (
        <div className="absolute top-6 left-6 z-20">
          <Button
            onClick={undoLastEdit}
            variant="ghost"
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm"
          >
            <Undo2 className="w-4 h-4" />
            <span className="sr-only">Undo last edit</span>
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!selectedImage ? (
          /* Upload State */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-6">Voice Image Editor</h1>
              <p className="text-muted-foreground text-lg mb-12">Transform your images with natural voice commands</p>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-16 cursor-pointer hover:border-muted-foreground/50 transition-colors group"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <p className="text-muted-foreground group-hover:text-foreground transition-colors">
                  Click to upload an image
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Image Display State */
          <div className="flex-1 flex flex-col">
            {/* Image Container - Takes up most of the screen */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <div className="relative max-w-full max-h-full">
                <img
                  src={currentImage || "/placeholder.svg"}
                  alt="Current image"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  style={{ maxHeight: "calc(100vh - 200px)" }}
                />

                {/* Change Image Button */}
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm"
                >
                  Change
                </Button>

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">{processStep}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex-shrink-0 p-8">
              <div className="flex justify-center">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  size="lg"
                  className={`w-20 h-20 rounded-full p-0 transition-all duration-200 ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 text-white scale-110 shadow-lg shadow-red-500/25"
                      : "bg-primary hover:bg-primary/90 shadow-lg hover:scale-105"
                  }`}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </Button>
              </div>

              {/* Status Text */}
              {isRecording && (
                <p className="text-center text-sm text-muted-foreground mt-4 animate-pulse">Listening... Tap to stop</p>
              )}

              {/* Transcription Results */}
              {(transcription || translatedPrompt) && !isProcessing && (
                <div className="max-w-2xl mx-auto mt-6 space-y-4">
                  {transcription && (
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">You said:</p>
                      <p className="text-foreground">"{transcription}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
    </div>
  )
}
