"use client"

import React, { useState } from "react"
import { X, Download, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  prompt: string
  timestamp?: number
}

export default function ImageModal({ isOpen, onClose, imageUrl, prompt, timestamp }: ImageModalProps) {
  const [showInfo, setShowInfo] = useState(false)

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close if clicking on the backdrop or anywhere that's not the image itself
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleImageContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close if clicking in the image container but not on the image
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `image-${Date.now()}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <div className="flex gap-2">
          <Button
            onClick={() => setShowInfo(!showInfo)}
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
          >
            <Info className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleDownload}
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
        
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Image Container */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-8 cursor-pointer"
        onClick={handleImageContainerClick}
      >
        <img
          src={imageUrl}
          alt="Generated image"
          className="max-w-full max-h-full object-contain cursor-default"
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: 'auto',
            height: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Info Panel - Slide in from bottom */}
      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-sm p-6 transform transition-transform duration-300 border-t border-neutral-700">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-medium text-neutral-400 mb-2">Prompt</h3>
            <p className="text-neutral-200 text-sm leading-relaxed mb-4">{prompt}</p>
            {timestamp && (
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span>Generated: {new Date(timestamp).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 