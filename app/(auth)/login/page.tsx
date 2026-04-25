'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.refresh()
      router.push('/')
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setError('Check your email to confirm sign up.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-sm bg-zinc-900/50 border-white/10 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-sm">
              <Image src="/icon-192.png" alt="Pluto Logo" width={48} height={48} />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-100">Welcome to Pluto</CardTitle>
            <CardDescription className="text-zinc-400">Enter your credentials to continue</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-700 h-11"
                placeholder="you@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-700 h-11"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3 text-center">
                {error}
              </div>
            )}

            <div className="pt-2 space-y-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-zinc-900 bg-zinc-100 hover:bg-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full h-11 bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                Create Account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
