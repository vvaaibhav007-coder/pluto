import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DODO_API_KEY = process.env.DODO_API_KEY!
const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID || 'pdt_0NdSifxW57DUmVvkVyDNx'
const DODO_API_URL = process.env.DODO_API_URL || 'https://api.dodopayments.com/payments'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create a Dodo Payments checkout session
    const response = await fetch(DODO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing: {
          city: null,
          country: 'US',
          state: null,
          street: null,
          zipcode: null,
        },
        customer: {
          email: user.email,
          name: user.email?.split('@')[0] || 'Pluto User',
        },
        payment_link: true,
        product_cart: [
          {
            product_id: DODO_PRODUCT_ID,
            quantity: 1,
          },
        ],
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings?upgraded=true`,
        metadata: {
          user_id: user.id,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Dodo checkout error:', errorData)
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    const data = await response.json()

    return NextResponse.json({ checkout_url: data.payment_link })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
