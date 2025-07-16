"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User } from '@supabase/supabase-js'

interface AuthCheckProps {
  children: React.ReactNode
}

export default function AuthCheck({ children }: AuthCheckProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) {
      console.error('Sign in error:', error)
      alert(`Sign in failed: ${error.message}`)
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) {
      console.error('Sign up error:', error)
      alert(`Sign up failed: ${error.message}`)
    } else {
      alert('Sign up successful! You can now sign in.')
    }
  }

  const skipAuth = () => {
    // Set a temporary "fake" user to bypass auth for development
    setUser({ id: 'dev-user', email: 'dev@example.com' } as User)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <EmailAuthForm onSignIn={signInWithEmail} onSignUp={signUpWithEmail} onSkipAuth={skipAuth} />
  }

  return (
    <>
      {/* Auth status bar - only show if we have a real user, not dev mode */}
      {user.email !== 'dev@example.com' && (
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-3 bg-neutral-800 rounded-lg px-3 py-2">
            <span className="text-sm text-neutral-300">
              {user.email}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={signOut}
              className="text-neutral-400 hover:text-white"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}
      {children}
    </>
  )
}

interface EmailAuthFormProps {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onSkipAuth: () => void
}

function EmailAuthForm({ onSignIn, onSignUp, onSkipAuth }: EmailAuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    try {
      if (isSignUp) {
        await onSignUp(email, password)
      } else {
        await onSignIn(email, password)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="bg-neutral-900 p-8 rounded-lg border border-neutral-800 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Creative Studio</h1>
          <p className="text-neutral-400">Authentication required</p>
        </div>

        {/* Skip Auth Button - Most Prominent */}
        <div className="mb-6">
          <Button 
            onClick={onSkipAuth}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
          >
            Continue without authentication (Development)
          </Button>
          <p className="text-xs text-neutral-500 mt-2 text-center">
            Skip login and start using the creative studio right away
          </p>
        </div>

        <div className="border-t border-neutral-700 pt-6">
          <p className="text-center text-neutral-400 text-sm mb-4">
            Or sign in with email (requires setup)
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white"
                required
              />
            </div>
            
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading || !email || !password}
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}