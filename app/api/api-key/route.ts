import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('api_key, is_pro')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      api_key: profile.is_pro ? profile.api_key : null, 
      is_pro: !!profile.is_pro 
    })
  } catch (error) {
    console.error('GET api-key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const newApiKey = crypto.randomUUID()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ api_key: newApiKey })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to regenerate API key' }, { status: 500 })
    }

    return NextResponse.json({ api_key: newApiKey })
  } catch (error) {
    console.error('POST api-key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
