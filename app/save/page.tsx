'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function SavePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

useEffect(() => {
    const processShare = async () => {
      const sharedUrl = searchParams.get('url') || searchParams.get('text') || ''
      const sharedTitle = searchParams.get('title') || ''

      let urlToSave = sharedUrl
      if (!urlToSave.startsWith('http')) {
        const urlMatch = sharedUrl.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          urlToSave = urlMatch[0]
        }
      }

      if (!urlToSave) {
        router.replace('/')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        sessionStorage.setItem('pluto_pending_share', JSON.stringify({
          url: urlToSave,
          title: sharedTitle,
        }))
        router.replace('/login')
        return
      }

      try {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlToSave }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to save')
        }

        router.replace('/?saved=true')
      } catch (error) {
        console.error('Failed to save shared bookmark:', error)
        router.replace('/?saved=error')
      }
    }

processShare()
  }, [searchParams, router, supabase])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 bg-zinc-500/20 blur-xl rounded-full animate-pulse" />
          <Image 
            src="/icon-192.png" 
            alt="Pluto Logo" 
            width={64} 
            height={64} 
            className="relative rounded-2xl border border-white/10 shadow-2xl"
          />
          <div className="absolute -bottom-2 -right-2 bg-zinc-950 rounded-full p-1 border border-white/10">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          </div>
        </div>
        <p className="text-zinc-400 text-sm font-medium tracking-wide">Saving to Pluto...</p>
      </div>
    </div>
  )
}

export default function SavePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto" />
        </div>
      </div>
    }>
      <SavePageContent />
    </Suspense>
  )
}
