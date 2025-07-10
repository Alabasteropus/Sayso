# Sayso Voice Image Editor

An AI-powered image editing application that transforms images using natural voice commands and text prompts.

## Features

### 🎤 Voice-Powered Editing
- **Natural Voice Commands**: Speak naturally to edit your images - "make the sky more dramatic" or "remove the person in the background"
- **Speech-to-Text**: Powered by Fal AI's Whisper for accurate transcription
- **Smart Prompt Translation**: Uses Google Gemini to convert casual commands into precise image editing instructions

### 🖼️ Intelligent Image Processing
- **Upload & Edit**: Upload any image and edit it with voice or text commands
- **AI Image Generation**: Create new images from text descriptions using FLUX.1 Kontext Pro
- **Automatic Image Analysis**: Google Gemini Vision describes your images to provide context for better edits
- **Aspect Ratio Detection**: Automatically detects and maintains proper image dimensions

### 🎯 Advanced AI Integration
- **FLUX.1 Kontext Pro**: State-of-the-art image generation and editing
- **Google Gemini**: Intelligent prompt processing and image understanding
- **Fal AI Whisper**: High-quality speech recognition
- **Smart Context Awareness**: Understands what's in your image to make better edits

### 💾 Session Management
- **Multiple Sessions**: Work on different projects simultaneously
- **Edit History**: Full undo/redo with timeline navigation
- **Auto-Save**: Your work is automatically preserved
- **Session Thumbnails**: Visual overview of all your projects

### 🎨 Modern Interface
- **Dark Mode**: Sleek, professional interface optimized for image work
- **Responsive Design**: Works seamlessly across devices
- **Real-time Feedback**: Live processing status and visual feedback
- **Keyboard Navigation**: Arrow keys for timeline navigation

## How It Works

1. **Upload an Image** or **Generate from Text**: Start with an existing photo or create something new
2. **Speak or Type Commands**: Use natural language like "make it more colorful" or "add a sunset"
3. **AI Processing**: The app translates your command into precise editing instructions
4. **Instant Results**: See your edited image in seconds with full history tracking

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **AI Services**: 
  - Fal AI (FLUX.1 Kontext Pro, Whisper)
  - Google Gemini (Vision, Flash)
- **UI Components**: Radix UI, Shadcn/ui
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables for AI services
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
FAL_KEY=your_fal_api_key
```

## Use Cases

- **Photo Enhancement**: Improve lighting, colors, and composition
- **Object Removal**: Remove unwanted elements from photos
- **Style Transfer**: Apply artistic styles and effects
- **Creative Generation**: Generate new images from descriptions
- **Quick Edits**: Make fast adjustments with voice commands