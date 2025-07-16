// Photo storage utilities for user uploaded photos

export interface UserPhoto {
  id: string
  url: string
  name: string
  timestamp: number
  size: number
  type: string
  isLocal?: boolean
  originalFile?: File
}

export interface PhotoStorageManager {
  uploadPhoto(file: File): Promise<UserPhoto>
  deletePhoto(photoId: string): Promise<void>
  getPhotos(): Promise<UserPhoto[]>
  getPhotoById(photoId: string): Promise<UserPhoto | null>
}

// Local storage implementation (for development/web)
export class LocalPhotoStorage implements PhotoStorageManager {
  private photos: UserPhoto[] = []
  private storageKey = 'sayso_user_photos'

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        try {
          this.photos = JSON.parse(stored)
        } catch (error) {
          console.error('Failed to load photos from storage:', error)
          this.photos = []
        }
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.photos))
      } catch (error) {
        console.error('Failed to save photos to storage:', error)
      }
    }
  }

  async uploadPhoto(file: File): Promise<UserPhoto> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        
        const photo: UserPhoto = {
          id: crypto.randomUUID(),
          url: dataUrl,
          name: file.name,
          timestamp: Date.now(),
          size: file.size,
          type: file.type,
          isLocal: true,
          originalFile: file
        }
        
        this.photos.unshift(photo)
        this.saveToStorage()
        resolve(photo)
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsDataURL(file)
    })
  }

  async deletePhoto(photoId: string): Promise<void> {
    const index = this.photos.findIndex(p => p.id === photoId)
    if (index > -1) {
      // Clean up object URL if it exists
      const photo = this.photos[index]
      if (photo.url && photo.url.startsWith('blob:')) {
        URL.revokeObjectURL(photo.url)
      }
      
      this.photos.splice(index, 1)
      this.saveToStorage()
    }
  }

  async getPhotos(): Promise<UserPhoto[]> {
    return [...this.photos]
  }

  async getPhotoById(photoId: string): Promise<UserPhoto | null> {
    return this.photos.find(p => p.id === photoId) || null
  }
}

// Cloud storage implementation (for production)
export class CloudPhotoStorage implements PhotoStorageManager {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  async uploadPhoto(file: File): Promise<UserPhoto> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch(`${this.baseUrl}/photos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    })
    
    if (!response.ok) {
      throw new Error('Failed to upload photo')
    }
    
    return await response.json()
  }

  async deletePhoto(photoId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/photos/${photoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete photo')
    }
  }

  async getPhotos(): Promise<UserPhoto[]> {
    const response = await fetch(`${this.baseUrl}/photos`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch photos')
    }
    
    return await response.json()
  }

  async getPhotoById(photoId: string): Promise<UserPhoto | null> {
    const response = await fetch(`${this.baseUrl}/photos/${photoId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  }
}

// iOS native photo access (for future iOS app integration)
export class IOSPhotoStorage implements PhotoStorageManager {
  // This would be implemented when building the iOS app
  // Using React Native or similar framework
  
  async uploadPhoto(file: File): Promise<UserPhoto> {
    // This would use iOS native photo picker
    // Example: react-native-image-picker or expo-image-picker
    throw new Error('iOS photo access not implemented yet')
  }

  async deletePhoto(photoId: string): Promise<void> {
    // This would handle iOS photo deletion
    throw new Error('iOS photo deletion not implemented yet')
  }

  async getPhotos(): Promise<UserPhoto[]> {
    // This would fetch from iOS photo library
    // with proper permissions
    throw new Error('iOS photo access not implemented yet')
  }

  async getPhotoById(photoId: string): Promise<UserPhoto | null> {
    // This would fetch specific photo from iOS
    throw new Error('iOS photo access not implemented yet')
  }
}

// Factory function to create appropriate storage manager
export function createPhotoStorage(): PhotoStorageManager {
  // For now, always return local storage
  // In production, this would check environment and return appropriate storage
  
  if (typeof window !== 'undefined' && 'navigator' in window) {
    // Check if running in iOS app context
    const isIOSApp = navigator.userAgent.includes('SaysoApp')
    
    if (isIOSApp) {
      return new IOSPhotoStorage()
    }
  }
  
  // Default to local storage for web
  return new LocalPhotoStorage()
}

// Utility functions for photo handling
export const photoUtils = {
  // Validate photo file
  validatePhoto(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are supported.' }
    }
    
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large. Maximum size is 10MB.' }
    }
    
    return { valid: true }
  },

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  // Generate thumbnail
  generateThumbnail(file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Calculate thumbnail dimensions
        const { width, height } = img
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        
        canvas.width = width * ratio
        canvas.height = height * ratio
        
        // Draw resized image
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Convert to data URL
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }
}