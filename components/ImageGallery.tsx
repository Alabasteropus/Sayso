"use client"

import React, { useState } from "react"
import { Play, Download, Trash2, Edit, Loader2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

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

interface ImageGalleryProps {
  images: GeneratedImage[]
  onImageClick: (image: GeneratedImage) => void
  onEditImage: (image: GeneratedImage) => void
  onAnimateImage: (image: GeneratedImage) => void
  onDownloadImage: (imageUrl: string, imageName?: string) => void
  onDeleteImage: (imageId: string) => void
}

export default function ImageGallery({
  images,
  onImageClick,
  onEditImage,
  onAnimateImage,
  onDownloadImage,
  onDeleteImage
}: ImageGalleryProps) {
  const [hoveredImage, setHoveredImage] = useState<string | null>(null)

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🎨</div>
          <h2 className="text-2xl font-light mb-2 text-neutral-300">Start Creating</h2>
          <p className="text-neutral-500">Type or speak to generate your first set of images</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Group images by generation (4 at a time) */}
      {Array.from({ length: Math.ceil(images.length / 4) }, (_, groupIndex) => {
        const startIndex = groupIndex * 4
        const groupImages = images.slice(startIndex, startIndex + 4)
        
        return (
          <div key={groupIndex} className="space-y-4">
            {groupIndex === 0 && (
              <div className="text-xs text-neutral-600 uppercase tracking-wide">
                Latest Generation
              </div>
            )}
            
            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
              {groupImages.map((image) => (
                <div
                  key={image.id}
                  className="break-inside-avoid bg-neutral-900/50 rounded-lg overflow-hidden cursor-pointer hover:bg-neutral-800/50 transition-all duration-300 group mb-4 relative hover:shadow-xl hover:shadow-neutral-900/50"
                  onMouseEnter={() => setHoveredImage(image.id)}
                  onMouseLeave={() => setHoveredImage(null)}
                >
                  <div className="relative overflow-hidden">
                    {image.isLoading ? (
                      // Loading placeholder with colorful animated gradient
                      <div
                        className="w-full relative flex items-center justify-center overflow-hidden"
                        style={{
                          aspectRatio: image.aspectRatio.replace(':', '/'),
                          minHeight: '200px'
                        }}
                      >
                        {/* Colorful animated background */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-br from-purple-800 via-blue-800 via-cyan-700 via-green-800 to-yellow-700"
                          style={{
                            animation: 'color-flow 4s ease-in-out infinite',
                            backgroundSize: '300% 300%'
                          }}
                        />
                        
                        {/* Animated shimmer overlay */}
                        <div 
                          className="absolute inset-0"
                          style={{
                            animation: 'rainbow-shimmer 3s linear infinite',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)'
                          }} 
                        />
                        
                        {/* Loading content */}
                        <div className="text-center z-10 relative">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-white drop-shadow-lg" />
                          <p className="text-xs text-white font-medium drop-shadow-lg">
                            {image.loadingStatus}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <img
                          src={image.url}
                          alt="Generated image"
                          className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                          style={{
                            aspectRatio: image.width && image.height 
                              ? `${image.width} / ${image.height}` 
                              : 'auto'
                          }}
                          onClick={() => onImageClick(image)}
                        />
                        
                        {/* Hover Overlay */}
                        <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-all duration-300 ${
                          hoveredImage === image.id ? 'opacity-100' : 'opacity-0'
                        }`}>
                          {/* Action Buttons */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex gap-3">
                              {/* Edit Button */}
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEditImage(image)
                                }}
                                className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 ${
                                  hoveredImage === image.id 
                                    ? 'scale-100 opacity-100' 
                                    : 'scale-90 opacity-0'
                                }`}
                                size="sm"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              
                              {/* Animate Button */}
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAnimateImage(image)
                                }}
                                disabled={image.isAnimating}
                                className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 ${
                                  hoveredImage === image.id 
                                    ? 'scale-100 opacity-100' 
                                    : 'scale-90 opacity-0'
                                }`}
                                size="sm"
                              >
                                {image.isAnimating ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Play className="w-4 h-4 mr-2" />
                                )}
                                Animate
                              </Button>
                            </div>
                          </div>
                          
                          {/* Corner Action Buttons */}
                          <div className="absolute top-3 right-3 flex gap-2">
                            {/* View Button */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                onImageClick(image)
                              }}
                              size="icon"
                              className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 w-8 h-8 ${
                                hoveredImage === image.id 
                                  ? 'scale-100 opacity-100' 
                                  : 'scale-90 opacity-0'
                              }`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {/* Download Button */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                onDownloadImage(image.url, `image-${image.id}`)
                              }}
                              size="icon"
                              className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 w-8 h-8 ${
                                hoveredImage === image.id 
                                  ? 'scale-100 opacity-100' 
                                  : 'scale-90 opacity-0'
                              }`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            
                            {/* Delete Button */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteImage(image.id)
                              }}
                              size="icon"
                              className={`bg-black/80 hover:bg-red-900/90 text-white border border-white/20 hover:border-red-400/40 transition-all duration-300 w-8 h-8 ${
                                hoveredImage === image.id 
                                  ? 'scale-100 opacity-100' 
                                  : 'scale-90 opacity-0'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {/* Video Indicator - Bottom Left */}
                          {image.videoUrls && image.videoUrls.length > 0 && (
                            <div className="absolute bottom-3 left-3 bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">
                              {image.videoUrls.length} Videos
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Image Info */}
                  <div className="p-3">
                    <p className="text-xs text-neutral-400 line-clamp-2">
                      {image.prompt}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-neutral-600">
                        {new Date(image.timestamp).toLocaleTimeString()}
                      </p>
                      {image.width && image.height && (
                        <p className="text-xs text-neutral-600">
                          {image.width}×{image.height}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
} 