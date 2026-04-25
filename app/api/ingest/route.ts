import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function fetchMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!response.ok) return null

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
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { url, api_key } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    if (!api_key || typeof api_key !== 'string') {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS protocols allowed' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Lookup user by api_key
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_pro')
      .eq('api_key', api_key)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Check free tier limit
    if (!profile.is_pro) {
      const { count, error: countError } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        
      if (!countError && count !== null && count >= 100) {
        return NextResponse.json(
          { error: 'limit_reached', message: 'Upgrade to Pluto Pro' },
          { status: 403 }
        )
      }
    }

    // Rate limiting: 60 requests per hour
    const RATE_LIMIT = 60
    const WINDOW_MS = 60 * 60 * 1000 // 1 hour
    const now = new Date()

    const { data: rlData, error: rlError } = await supabase
      .from('ingest_rate_limit')
      .select('*')
      .eq('api_key', api_key)
      .single()

    if (rlError && rlError.code !== 'PGRST116') {
      console.error('Rate limit check error:', rlError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (rlData) {
      const windowStart = new Date(rlData.window_start)
      if (now.getTime() - windowStart.getTime() > WINDOW_MS) {
        // Reset window
        await supabase
          .from('ingest_rate_limit')
          .update({ request_count: 1, window_start: now.toISOString() })
          .eq('api_key', api_key)
      } else {
        if (rlData.request_count >= RATE_LIMIT) {
          return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
        } else {
          // Increment
          await supabase
            .from('ingest_rate_limit')
            .update({ request_count: rlData.request_count + 1 })
            .eq('api_key', api_key)
        }
      }
    } else {
      // First request
      await supabase
        .from('ingest_rate_limit')
        .insert([{ api_key, request_count: 1, window_start: now.toISOString() }])
    }

    let title = await fetchMetadata(url)
    if (!title) {
      title = parsedUrl.hostname.replace(/^www\./, '')
    }

    const row = {
      user_id: profile.id,
      url: url,
      title: title,
      metadata_status: 'pending'
    }

    const { error: insertError } = await supabase
      .from('bookmarks')
      .insert([row])

    if (insertError) {
      console.error('Supabase insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save bookmark' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Saved to Pluto' }, { status: 201 })
  } catch (error) {
    console.error('Ingest POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
