'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Image from 'next/image'
import { Link, Plus, Loader2, LogOut, Search, X, Download, Settings, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type Bookmark = {
  id: string
  url: string
  title: string
  metadata_status: string
  category: string
  tags: string[]
  created_at: string
}

// Distinct color classes for each category
const categoryColors: Record<string, string> = {
  Recipe: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Business: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Social: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  Video: 'bg-red-500/15 text-red-400 border-red-500/30',
  Tool: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Article: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Product: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Research: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  Design: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
  Other: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const CATEGORIES = ['All', 'Article', 'Recipe', 'Video', 'Product', 'Tool', 'Research', 'Business', 'Design', 'Social', 'Other'] as const

function getCategoryClasses(category: string): string {
  return categoryColors[category] || categoryColors.Other
}

function DashboardPageContent() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [fetching, setFetching] = useState(true)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [searching, setSearching] = useState(false)

  // Plan & Usage state
  const [isPro, setIsPro] = useState(true) // Default true to avoid flash
  const [totalBookmarks, setTotalBookmarks] = useState<number | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  // PWA install prompt state
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // PWA install prompt
  useEffect(() => {
    const dismissed = localStorage.getItem('pluto_install_dismissed')
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Handle post-share redirect toast
  useEffect(() => {
    const saved = searchParams.get('saved')
    if (saved === 'true') {
      toast.success('Bookmark saved from share!')
      router.replace('/', { scroll: false })
    } else if (saved === 'error') {
      toast.error('Failed to save shared bookmark.')
      router.replace('/', { scroll: false })
    }
  }, [searchParams, router])

  // Process pending share from sessionStorage (post-login)
  useEffect(() => {
    const pending = sessionStorage.getItem('pluto_pending_share')
    if (!pending) return

    const processPending = async () => {
      try {
        const { url: pendingUrl } = JSON.parse(pending)
        sessionStorage.removeItem('pluto_pending_share')

        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pendingUrl }),
        })

        if (res.ok) {
          const data = await res.json()
          toast.success('Shared bookmark saved!')
          setBookmarks(prev => [data.data, ...prev])
        }
      } catch (err) {
        console.error('Failed to process pending share:', err)
      }
    }
    processPending()
  }, [])

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim())
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  // Unified fetch: combines FTS + category filter
  const fetchBookmarks = useCallback(async (query: string, category: string) => {
    setSearching(true)
    try {
      let q = supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      // Full-text search
      if (query) {
        // Convert user input to tsquery-safe format: split words and join with &
        const tsQuery = query
          .split(/\s+/)
          .filter(Boolean)
          .map(w => `'${w}'`)
          .join(' & ')
        q = q.textSearch('fts', tsQuery, { type: 'plain', config: 'english' })
      }

      // Category filter
      if (category && category !== 'All') {
        q = q.eq('category', category)
      }

      const { data, error } = await q
      if (!error && data) {
        setBookmarks(data)
      }
    } finally {
      setSearching(false)
      setFetching(false)
    }
  }, [supabase])

  const fetchUsageAndPlan = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .single()
    
    setIsPro(profile?.is_pro || false)

    const { count } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      
    setTotalBookmarks(count || 0)
  }, [supabase])

  // Initial load
  useEffect(() => {
    fetchBookmarks('', 'All')
    fetchUsageAndPlan()
  }, [])

  // Re-fetch when search or category changes
  useEffect(() => {
    fetchBookmarks(debouncedQuery, activeCategory)
  }, [debouncedQuery, activeCategory])

  // Poll for pending bookmarks to update once AI categorization finishes
  useEffect(() => {
    const hasPending = bookmarks.some(b => b.metadata_status === 'pending')
    if (!hasPending) return

    const interval = setInterval(() => {
      fetchBookmarks(debouncedQuery, activeCategory)
    }, 4000)

    return () => clearInterval(interval)
  }, [bookmarks, debouncedQuery, activeCategory, fetchBookmarks])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    try {
      setLoading(true)

      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'limit_reached') {
          setShowUpgradeModal(true)
          return
        }
        throw new Error(data.message || data.error || 'Failed to save bookmark')
      }

      toast.success('Link saved successfully!')
      // If no active filters, prepend to list; otherwise refetch
      if (!debouncedQuery && activeCategory === 'All') {
        setBookmarks(prev => [data.data, ...prev])
      } else {
        fetchBookmarks(debouncedQuery, activeCategory)
      }
      // Update usage count if not pro
      if (!isPro) {
        setTotalBookmarks(prev => (prev !== null ? prev + 1 : 1))
      }
      setUrl('')
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      toast.success('Pluto installed!')
    }
    setShowInstallBanner(false)
    setInstallPrompt(null)
    localStorage.setItem('pluto_install_dismissed', 'true')
  }

  const dismissInstall = () => {
    setShowInstallBanner(false)
    localStorage.setItem('pluto_install_dismissed', 'true')
  }

  const isProcessing = (bookmark: Bookmark) =>
    bookmark.metadata_status === 'pending' || (!bookmark.category && bookmark.metadata_status !== 'ok')

  const hasActiveFilters = debouncedQuery || activeCategory !== 'All'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-500 to-transparent blur-[100px] rounded-full" />
      </div>

      <header className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Image src="/icon-192.png" alt="Pluto Logo" width={32} height={32} className="rounded-lg" />
          <h1 className="font-semibold tracking-tight text-lg">Pluto</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/settings')}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <Settings className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="relative z-10 max-w-2xl mx-auto px-6 mb-4">
          <div className="flex items-center justify-between gap-3 bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-zinc-300" />
              </div>
              <p className="text-sm text-zinc-300 truncate">Install Pluto for quick access and sharing</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissInstall}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-2"
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleInstall}
                className="text-xs"
              >
                Add Pluto to Home Screen
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-2xl mx-auto px-6 mt-4 sm:mt-12 pb-24">
        <div className="space-y-12">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-zinc-100">
              Save for later.
            </h2>
            <p className="text-zinc-400 text-lg sm:text-xl">
              Capture your favorite links.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-500/20 to-zinc-800/20 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-500" />
            <div className="relative flex items-center bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-2 pl-4 transition-all focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
              <Link className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              <Input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full bg-transparent border-none text-zinc-100 px-4 py-3 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg shadow-none"
              />
              <Button
                type="submit"
                disabled={loading || !url}
                size="lg"
                className="rounded-xl flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Save Link</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Usage Indicator for Free Users */}
          {!isPro && totalBookmarks !== null && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-zinc-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Free Plan Usage
                </div>
                <div className="text-zinc-400">
                  <span className={totalBookmarks >= 100 ? 'text-red-400 font-medium' : 'text-zinc-100'}>
                    {totalBookmarks}
                  </span>{' '}
                  of 100 bookmarks used
                </div>
              </div>
              <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${totalBookmarks >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min((totalBookmarks / 100) * 100, 100)}%` }} 
                />
              </div>
              {totalBookmarks >= 100 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-red-400">You have reached your limit.</p>
                  <button onClick={() => setShowUpgradeModal(true)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                    Upgrade to Pro →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Search & Filters */}
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bookmarks..."
                className="w-full bg-zinc-900/60 border-white/10 text-zinc-100 pl-10 pr-10 py-2.5 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-500 focus-visible:border-zinc-500 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat
                const colorClasses = cat === 'All' ? '' : getCategoryClasses(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${isActive
                        ? cat === 'All'
                          ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                          : `${colorClasses} ring-1 ring-current`
                        : 'bg-zinc-900/40 text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10'
                      }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bookmarks List */}
          <div className="space-y-4">
            {fetching ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 border border-white/5 rounded-2xl bg-zinc-900/20">
                {hasActiveFilters
                  ? 'No bookmarks match your search.'
                  : 'No bookmarks yet. Save your first link above!'}
              </div>
            ) : (
              <>
                {/* Result count when filtering */}
                {hasActiveFilters && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      {bookmarks.length} result{bookmarks.length !== 1 ? 's' : ''}
                      {debouncedQuery && <> for &ldquo;{debouncedQuery}&rdquo;</>}
                      {activeCategory !== 'All' && <> in {activeCategory}</>}
                    </p>
                    <button
                      onClick={() => {
                        clearSearch()
                        setActiveCategory('All')
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                <div className="grid gap-4">
                  {bookmarks.map((bookmark) => (
                    <Card
                      key={bookmark.id}
                      className={`bg-zinc-900/50 border-white/10 backdrop-blur-sm overflow-hidden group hover:border-zinc-700 transition-colors ${isProcessing(bookmark) ? 'animate-pulse' : ''
                        }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 min-w-0 flex-1">
                            <CardTitle className="text-lg text-zinc-100 leading-tight">
                              {bookmark.title || bookmark.url}
                            </CardTitle>

                            {/* Tags */}
                            {bookmark.tags && bookmark.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {bookmark.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border-none font-normal text-[11px] px-2 py-0"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <CardDescription className="text-zinc-500 truncate max-w-[400px]">
                              <a href={bookmark.url} target="_blank" rel="noreferrer" className="hover:underline hover:text-zinc-300">
                                {bookmark.url}
                              </a>
                            </CardDescription>
                          </div>

                          <div className="flex flex-col gap-2 items-end flex-shrink-0">
                            {isProcessing(bookmark) ? (
                              <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-500 border-none font-normal text-xs whitespace-nowrap gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing
                              </Badge>
                            ) : bookmark.category && bookmark.category !== 'Uncategorized' ? (
                              <Badge className={`border font-medium text-xs whitespace-nowrap ${getCategoryClasses(bookmark.category)}`}>
                                {bookmark.category}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative bg-zinc-900 border border-white/10 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 mb-4">
              <Lock className="w-6 h-6 text-emerald-400" />
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-zinc-100 tracking-tight">Limit Reached</h3>
              <p className="text-zinc-400 mt-2 leading-relaxed">
                You have reached your free limit of 100 bookmarks. Upgrade to Pluto Pro to save unlimited bookmarks and unlock API access.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl h-12"
                disabled={upgrading}
                onClick={async () => {
                  setUpgrading(true)
                  try {
                    const res = await fetch('/api/checkout', { method: 'POST' })
                    if (res.ok) {
                      const data = await res.json()
                      if (data.checkout_url) {
                        window.location.href = data.checkout_url
                      }
                    } else {
                      toast.error('Failed to start checkout')
                    }
                  } catch {
                    toast.error('Something went wrong')
                  } finally {
                    setUpgrading(false)
                  }
                }}
              >
                {upgrading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                ) : (
                  'Upgrade to Pluto Pro'
                )}
              </Button>
              <Button 
                variant="ghost"
                className="w-full text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-xl h-12"
                onClick={() => setShowUpgradeModal(false)}
              >
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-4" />
        <p className="text-zinc-500 text-sm">Loading dashboard...</p>
      </div>
    }>
      <DashboardPageContent />
    </Suspense>
  )
}
