"use client"

import React, { useCallback, useRef } from "react"
import { Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void
}

export default function ImageUploader({ onImageUpload }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        onImageUpload(e.target?.result as string)
        toast({ title: "Image uploaded", description: "Ready for editing" })
      }
      reader.readAsDataURL(file)
    }
  }, [onImageUpload, toast])

  return (
    <div className="absolute inset-0 flex items-center justify-center p-5">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-neutral-800/50 rounded-2xl p-16 cursor-pointer hover:border-neutral-700/70 transition-colors group bg-neutral-900/50"
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-600 group-hover:text-neutral-500 transition-colors" />
        <p className="text-neutral-600 group-hover:text-neutral-500 transition-colors mb-4">
          Click to upload an image
        </p>
        <p className="text-neutral-700 text-sm">
          or type/speak to generate with FLUX
        </p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  )
} 