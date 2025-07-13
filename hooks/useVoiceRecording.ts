"use client"

import { useCallback, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const { toast } = useToast()

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      let mimeType = "audio/webm"
      if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav"
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(100) // Record in 100ms chunks
      setIsRecording(true)
      return () => stopRecording()
    } catch (error) {
      console.error("Recording failed:", error)
      toast({
        title: "Recording failed",
        description: "Please check microphone permissions",
        variant: "destructive",
      })
      return null
    }
  }, [toast])

  const stopRecording = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        const mediaRecorder = mediaRecorderRef.current
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
          console.log("Recording stopped, blob size:", audioBlob.size, "type:", audioBlob.type)
          
          // Clean up stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }
          
          resolve(audioBlob)
        }
        
        mediaRecorder.stop()
        setIsRecording(false)
      } else {
        resolve(null)
      }
    })
  }, [isRecording])

  return { isRecording, startRecording, stopRecording }
} 