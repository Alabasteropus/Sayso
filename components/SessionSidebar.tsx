"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface Session {
  id: string
  thumbnail: string
  name: string
}

interface SessionSidebarProps {
  sessions: Session[]
  currentSessionId: string | null
  onCreateNewSession: () => void
  onLoadSession: (id: string) => void
}

export default function SessionSidebar({
  sessions,
  currentSessionId,
  onCreateNewSession,
  onLoadSession
}: SessionSidebarProps) {
  return (
    <div className="fixed left-0 top-0 h-full flex flex-col items-center justify-center gap-2 pl-4 z-10">
      <Button
        onClick={onCreateNewSession}
        variant="ghost"
        size="icon"
        className="w-12 h-12 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-400 hover:text-neutral-300 border border-neutral-700/50 hover:border-neutral-600/50 transition-all"
      >
        <Plus className="w-5 h-5" />
      </Button>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-96">
        {sessions.map((session) => (
          <Button
            key={session.id}
            onClick={() => onLoadSession(session.id)}
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
  )
} 