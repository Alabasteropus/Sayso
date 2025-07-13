"use client"

import React, { useState, useMemo } from "react"
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

type FeedItem = (GeneratedImage & { type: 'image' }) | (GeneratedVideo & { type: 'video' })

interface UnifiedFeedProps {
  images: GeneratedImage[]
  videos: GeneratedVideo[]
  onImageClick: (image: GeneratedImage) => void
  onEditImage: (image: GeneratedImage) => void
  onAnimateImage: (image: GeneratedImage) => void
  onDownloadImage: (imageUrl: string, imageName?: string) => void
  onDeleteImage: (imageId: string) => void
  onDeleteVideo: (videoId: string) => void
}

export default function UnifiedFeed({
  images,
  videos,
  onImageClick,
  onEditImage,
  onAnimateImage,
  onDownloadImage,
  onDeleteImage,
  onDeleteVideo
}: UnifiedFeedProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [hoveredVideo, setHoveredVideo] = useState<HTMLVideoElement | null>(null)

  // Combine and sort all items chronologically (oldest first, newest at bottom)
  const feedItems = useMemo(() => {
    const imageItems: FeedItem[] = images.map(img => ({ ...img, type: 'image' as const }))
    const videoItems: FeedItem[] = videos.map(vid => ({ ...vid, type: 'video' as const }))
    
    return [...imageItems, ...videoItems]
      .sort((a, b) => a.timestamp - b.timestamp) // Oldest first
  }, [images, videos])

  if (feedItems.length === 0) {
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
    <div className="space-y-6">
      {/* Mosaic Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
        {feedItems.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className={`relative rounded-lg overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-neutral-900/50 transition-all duration-300 group ${
              item.type === 'image' ? 'bg-neutral-900/50 hover:bg-neutral-800/50' : 'bg-neutral-900/70 hover:bg-neutral-800/70'
            }`}
            onMouseEnter={() => setHoveredItem(`${item.type}-${item.id}`)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              // Dynamic grid row span based on aspect ratio for mosaic effect
              gridRowEnd: item.type === 'image' && item.aspectRatio ? 
                `span ${Math.ceil(parseFloat(item.aspectRatio.split(':')[1]) / parseFloat(item.aspectRatio.split(':')[0]) * 2)}` : 
                'span 2'
            }}
          >
            <div className="relative overflow-hidden">
              {item.type === 'image' ? (
                // Image Item
                <>
                  {item.isLoading ? (
                    // Loading placeholder
                    <div
                      className="w-full relative flex items-center justify-center overflow-hidden"
                      style={{
                        aspectRatio: item.aspectRatio.replace(':', '/'),
                        minHeight: '200px'
                      }}
                    >
                      <div 
                        className="absolute inset-0 bg-gradient-to-br from-purple-800 via-blue-800 via-cyan-700 via-green-800 to-yellow-700"
                        style={{
                          animation: 'color-flow 4s ease-in-out infinite',
                          backgroundSize: '300% 300%'
                        }}
                      />
                      <div 
                        className="absolute inset-0"
                        style={{
                          animation: 'rainbow-shimmer 3s linear infinite',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)'
                        }} 
                      />
                      <div className="text-center z-10 relative">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-white drop-shadow-lg" />
                        <p className="text-xs text-white font-medium drop-shadow-lg">
                          {item.loadingStatus}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <img
                        src={item.url}
                        alt="Generated content"
                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                        style={{
                          aspectRatio: item.width && item.height 
                            ? `${item.width} / ${item.height}` 
                            : 'auto'
                        }}
                        onClick={() => onImageClick(item)}
                      />
                      
                      {/* Image Hover Overlay */}
                      <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-all duration-300 pointer-events-none ${
                        hoveredItem === `${item.type}-${item.id}` ? 'opacity-100' : 'opacity-0'
                      }`}>
                        {/* Center Action Buttons */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex gap-3 pointer-events-auto">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditImage(item)
                              }}
                              className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 ${
                                hoveredItem === `${item.type}-${item.id}` 
                                  ? 'scale-100 opacity-100' 
                                  : 'scale-90 opacity-0'
                              }`}
                              size="sm"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                onAnimateImage(item)
                              }}
                              disabled={item.isAnimating}
                              className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 ${
                                hoveredItem === `${item.type}-${item.id}` 
                                  ? 'scale-100 opacity-100' 
                                  : 'scale-90 opacity-0'
                              }`}
                              size="sm"
                            >
                              {item.isAnimating ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4 mr-2" />
                              )}
                              Animate
                            </Button>
                          </div>
                        </div>
                        
                        {/* Corner Actions */}
                        <div className="absolute top-3 right-3 flex gap-2 pointer-events-auto">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onImageClick(item)
                            }}
                            size="icon"
                            className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 w-8 h-8 ${
                              hoveredItem === `${item.type}-${item.id}` 
                                ? 'scale-100 opacity-100' 
                                : 'scale-90 opacity-0'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDownloadImage(item.url, `image-${item.id}`)
                            }}
                            size="icon"
                            className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 w-8 h-8 ${
                              hoveredItem === `${item.type}-${item.id}` 
                                ? 'scale-100 opacity-100' 
                                : 'scale-90 opacity-0'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteImage(item.id)
                            }}
                            size="icon"
                            className={`bg-black/80 hover:bg-red-900/90 text-white border border-white/20 hover:border-red-400/40 transition-all duration-300 w-8 h-8 ${
                              hoveredItem === `${item.type}-${item.id}` 
                                ? 'scale-100 opacity-100' 
                                : 'scale-90 opacity-0'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Video Indicator */}
                        {item.videoUrls && item.videoUrls.length > 0 && (
                          <div className="absolute bottom-3 left-3 bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">
                            {item.videoUrls.length} Videos
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                // Video Item
                <>
                  {item.isLoading ? (
                    // Video loading placeholder
                    <div className="w-full relative aspect-video overflow-hidden">
                      <img
                        src={item.sourceImageUrl}
                        alt="Generating video..."
                        className="absolute inset-0 w-full h-full object-cover animate-pulse"
                        style={{
                          filter: 'blur(10px)',
                          animation: 'blur-pulse 3s ease-in-out infinite'
                        }}
                      />
                      <div 
                        className="absolute inset-0"
                        style={{
                          animation: 'blur-shimmer 3s ease-in-out infinite',
                          background: 'linear-gradient(90deg, rgba(0,0,0,0.3), rgba(255,255,255,0.1), rgba(0,0,0,0.3))',
                          backdropFilter: 'blur(2px)'
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="text-center z-10">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-white drop-shadow-lg" />
                          <p className="text-xs text-white font-medium drop-shadow-lg">
                            {item.loadingStatus}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={(video) => {
                          if (video) {
                            const handleMouseEnter = () => {
                              setHoveredVideo(video)
                              video.play()
                            }
                            const handleMouseLeave = () => {
                              setHoveredVideo(null)
                              video.pause()
                              video.currentTime = 0
                            }
                            
                            video.addEventListener('mouseenter', handleMouseEnter)
                            video.addEventListener('mouseleave', handleMouseLeave)
                            
                            return () => {
                              video.removeEventListener('mouseenter', handleMouseEnter)
                              video.removeEventListener('mouseleave', handleMouseLeave)
                            }
                          }
                        }}
                        src={item.url}
                        className="w-full h-auto object-cover cursor-pointer"
                        controls={hoveredItem === `${item.type}-${item.id}`}
                        muted
                        loop
                        playsInline
                        onClick={() => {
                          // Create a mock GeneratedImage for the modal
                          const videoAsImage: GeneratedImage = {
                            id: item.id,
                            url: item.url,
                            prompt: item.prompt,
                            timestamp: item.timestamp,
                            aspectRatio: "16:9"
                          }
                          onImageClick(videoAsImage)
                        }}
                      />
                      
                      {/* Video Hover Overlay */}
                      <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-all duration-300 pointer-events-none ${
                        hoveredItem === `${item.type}-${item.id}` ? 'opacity-100' : 'opacity-0'
                      }`}>
                        {/* Corner Actions */}
                        <div className="absolute top-3 right-3 flex gap-2 pointer-events-auto">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              // Create download link for video
                              const a = document.createElement('a')
                              a.href = item.url
                              a.download = `video-${item.id}.mp4`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                            }}
                            size="icon"
                            className={`bg-black/80 hover:bg-black/90 text-white border border-white/20 hover:border-white/40 transition-all duration-300 w-8 h-8 ${
                              hoveredItem === `${item.type}-${item.id}` 
                                ? 'scale-100 opacity-100' 
                                : 'scale-90 opacity-0'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteVideo(item.id)
                            }}
                            size="icon"
                            className={`bg-black/80 hover:bg-red-900/90 text-white border border-white/20 hover:border-red-400/40 transition-all duration-300 w-8 h-8 ${
                              hoveredItem === `${item.type}-${item.id}` 
                                ? 'scale-100 opacity-100' 
                                : 'scale-90 opacity-0'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Video Type Indicator */}
                        <div className="absolute bottom-3 left-3 bg-purple-600/90 text-white px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">
                          Video
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            
            {/* Content Info */}
            <div className="p-3">
              <p className="text-xs text-neutral-400 line-clamp-2">
                {item.prompt}
              </p>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-neutral-600">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </p>
                <div className="flex items-center gap-2">
                  {item.type === 'image' && item.width && item.height && (
                    <p className="text-xs text-neutral-600">
                      {item.width}×{item.height}
                    </p>
                  )}
                  {item.type === 'video' && (
                    <p className="text-xs text-neutral-600">
                      Video
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 