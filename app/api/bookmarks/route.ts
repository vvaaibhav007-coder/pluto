import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function fetchMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim()
    }
    
    return null
  } catch (error) {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS protocols allowed' },
        { status: 400 }
      )
    }

    let title = await fetchMetadata(url)
    let metadataAvailable = !!title

    if (!title) {
      title = parsedUrl.hostname.replace(/^www\./, '')
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      url: url,
      title: title,
      metadata_status: 'pending'
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .insert([row])
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { ...data, _metadataAvailable: metadataAvailable } }, { status: 201 })
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
