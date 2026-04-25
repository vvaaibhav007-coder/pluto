import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || ''

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true
  if (!signature) return false
  
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')
  
  if (signature.length !== expectedSignature.length) return false
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-dodo-signature') || ''

    // Verify webhook signature
    if (DODO_WEBHOOK_SECRET && !verifyWebhookSignature(body, signature, DODO_WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)

    // Handle payment success
    if (event.event_type === 'payment.succeeded' || event.type === 'payment.succeeded') {
      const userId = event.data?.metadata?.user_id || event.metadata?.user_id

      if (!userId) {
        console.error('No user_id in webhook metadata:', JSON.stringify(event))
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
      }

      // Use service role to update profile
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { error } = await supabase
        .from('profiles')
        .update({ is_pro: true })
        .eq('id', userId)

      if (error) {
        console.error('Failed to upgrade user:', error)
        return NextResponse.json({ error: 'Failed to upgrade user' }, { status: 500 })
      }

      console.log(`User ${userId} upgraded to Pro`)
      return NextResponse.json({ success: true })
    }

    // Acknowledge other event types
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
