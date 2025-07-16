"use client"

import React, { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { X, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  onCropComplete: (croppedImageUrl: string) => void
}

export default function ImageCropModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  onCropComplete 
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [isProcessing, setIsProcessing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const { toast } = useToast()

  const getCroppedImg = useCallback((
    image: HTMLImageElement,
    crop: PixelCrop,
    fileName: string = 'cropped-image.jpg'
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('No 2d context'))
        return
      }

      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      canvas.width = crop.width
      canvas.height = crop.height

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
      )

      // Convert to data URL instead of blob URL for server compatibility
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        
        // Convert blob to data URL for server-side compatibility
        const reader = new FileReader()
        reader.onload = () => {
          resolve(reader.result as string)
        }
        reader.onerror = () => {
          reject(new Error('Failed to convert blob to data URL'))
        }
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.9)
    })
  }, [])

  const handleCropComplete = useCallback(async () => {
    if (!completedCrop || !imgRef.current) {
      toast({
        title: "No crop selected",
        description: "Please select an area to crop",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    
    try {
      const croppedImageUrl = await getCroppedImg(imgRef.current, completedCrop)
      onCropComplete(croppedImageUrl)
      onClose()
      toast({
        title: "Image cropped successfully",
        description: "Your cropped image is ready to use",
      })
    } catch (error) {
      toast({
        title: "Crop failed",
        description: "Could not crop the image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }, [completedCrop, getCroppedImg, onCropComplete, onClose, toast])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    
    // Set initial crop to center square as percentage
    const cropSize = 70 // 70% of the image
    const x = (100 - cropSize) / 2
    const y = (100 - cropSize) / 2
    
    setCrop({
      unit: '%',
      width: cropSize,
      height: cropSize,
      x: x,
      y: y,
    })
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Crop Identity Image</h2>
            <p className="text-sm text-neutral-400">Select the area you want to use for generation</p>
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

        {/* Crop Area */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="w-full h-full flex items-center justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1} // Square crop for faces
              minWidth={100}
              minHeight={100}
              className="max-w-full max-h-full"
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop preview"
                onLoad={handleImageLoad}
                className="block max-w-full max-h-full object-contain"
                style={{ 
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  height: 'auto',
                  width: 'auto'
                }}
              />
            </ReactCrop>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-4 py-2 bg-neutral-800/50 text-sm text-neutral-400">
          Drag to reposition • Drag corners to resize • Square crop recommended for faces
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-end gap-3">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCropComplete}
            disabled={isProcessing || !completedCrop}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Use Cropped Image
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}