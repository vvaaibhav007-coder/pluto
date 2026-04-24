'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function SavePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const processShare = async () => {
      // Extract shared data from query params
      const sharedUrl = searchParams.get('url') || searchParams.get('text') || ''
      const sharedTitle = searchParams.get('title') || ''

      // Try to extract a URL from the text parameter if url is empty
      let urlToSave = sharedUrl
      if (!urlToSave.startsWith('http')) {
        // Sometimes apps put the URL inside the text param
        const urlMatch = sharedUrl.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          urlToSave = urlMatch[0]
        }
      }

      if (!urlToSave) {
        router.replace('/')
        return
      }

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in: save URL to sessionStorage for post-auth processing
        sessionStorage.setItem('pluto_pending_share', JSON.stringify({
          url: urlToSave,
          title: sharedTitle,
        }))
        router.replace('/login')
        return
      }

      // User is logged in: save the bookmark immediately
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

        // Redirect to dashboard with success indicator
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
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto" />
        <p className="text-zinc-400 text-sm">Saving bookmark...</p>
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
