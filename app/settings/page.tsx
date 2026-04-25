'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Copy, RefreshCw, Check, Loader2, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Suspense } from 'react'

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [apiKey, setApiKey] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const res = await fetch('/api/api-key')
        if (res.ok) {
          const data = await res.json()
          setApiKey(data.api_key || '')
          setIsPro(data.is_pro === true)
        } else if (res.status === 401) {
          router.push('/login')
        } else {
          toast.error('Failed to load API key')
        }
      } catch (error) {
        toast.error('Error loading API key')
      } finally {
        setLoading(false)
      }
    }
    fetchApiKey()
  }, [router])

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success('Welcome to Pro! 🎉 Your API key is now active.')
      // Clean the URL
      router.replace('/settings', { scroll: false })
    }
  }, [searchParams, router])

  const copyToClipboard = async () => {
    if (!apiKey || !isPro) return
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      toast.success('API key copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy API key')
    }
  }

  const handleRegenerate = async () => {
    if (!isPro) return
    if (!confirm('Are you sure you want to regenerate your API key? Any existing Shortcuts or integrations using this key will break.')) {
      return
    }

    setRegenerating(true)
    try {
      const res = await fetch('/api/api-key', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setApiKey(data.api_key)
        toast.success('API key regenerated successfully')
      } else {
        toast.error('Failed to regenerate API key')
      }
    } catch (error) {
      toast.error('Error regenerating API key')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-500 to-transparent blur-[100px] rounded-full" />
      </div>

      <header className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-12 flex justify-between items-center">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/')}
          className="text-zinc-400 hover:text-zinc-100 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 mt-4 pb-24">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Settings</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden relative">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-medium text-zinc-100">iOS Share Extension</h3>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border border-zinc-700">Pro Badge</Badge>
              </div>

              {loading ? (
                <div className="p-6 flex items-center gap-2 text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading settings...</span>
                </div>
              ) : (
                <div className="relative">
                  {/* Content (blurred if not Pro) */}
                  <div className={`p-6 space-y-8 transition-all ${!isPro ? 'blur-sm select-none pointer-events-none opacity-50' : ''}`}>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Your API Key</h4>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="text" 
                          value={isPro ? apiKey : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'} 
                          readOnly 
                          disabled={!isPro}
                          tabIndex={isPro ? 0 : -1}
                          className="font-mono text-zinc-300 bg-zinc-950/50 border-white/10"
                        />
                        <Button 
                          variant="secondary" 
                          onClick={copyToClipboard}
                          disabled={!isPro}
                          tabIndex={isPro ? 0 : -1}
                          className="shrink-0 w-24"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 mr-2 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={handleRegenerate}
                          disabled={regenerating || !isPro}
                          tabIndex={isPro ? 0 : -1}
                          className="text-zinc-500 hover:text-zinc-300 hover:bg-transparent px-0"
                        >
                          {regenerating ? (
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-2" />
                          )}
                          Regenerate Key ⚠
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-white/5 pt-8">
                      <div>
                        <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Install the Shortcut</h4>
                        <p className="text-sm text-zinc-500 mt-2">
                          Tap below to add &quot;Save to Pluto&quot; to your iPhone Share Sheet in 30 seconds.
                        </p>
                      </div>
                      <a 
                        href={isPro ? "#" : undefined}
                        target="_blank" 
                        rel="noreferrer"
                        tabIndex={isPro ? 0 : -1}
                        onClick={(e) => { if (!isPro) e.preventDefault() }}
                        className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 border border-white/10 text-zinc-300 hover:bg-zinc-800 transition-colors ${!isPro ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                      >
                        Get iOS Shortcut <ArrowRight className="w-4 h-4 ml-2" />
                      </a>
                    </div>
                  </div>

                  {/* Pro Overlay */}
                  {!isPro && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
                      <div className="bg-zinc-900/90 border border-white/10 p-6 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm w-full space-y-4">
                        <Lock className="w-8 h-8 text-zinc-400 mx-auto" />
                        <div>
                          <h4 className="text-lg font-medium text-zinc-100">Upgrade to Pro</h4>
                          <p className="text-sm text-zinc-400 mt-1">
                            Unlock API access and the iOS Share Extension.
                          </p>
                        </div>
                        <Button 
                          className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
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
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                          ) : (
                            'Upgrade Now'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}
