import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error('FLUTTERWAVE_SECRET_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify Flutterwave webhook hash
    const secretHash = Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH');
    const verifHash = req.headers.get('verif-hash');
    
    if (secretHash && verifHash !== secretHash) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook hash' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    const event = JSON.parse(body);

    console.log('Flutterwave webhook event:', event.event);

    if (event.event === 'charge.completed' && event.data.status === 'successful') {
      const { tx_ref, amount, currency, customer, meta } = event.data;
      const userId = meta?.user_id;
      const planId = meta?.plan_id;

      if (!userId || !planId) {
        console.error('Missing user_id or plan_id in meta');
        return new Response(JSON.stringify({ error: 'Invalid metadata' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Verify transaction with Flutterwave
      const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${event.data.id}/verify`, {
        headers: { 'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}` }
      });
      const verifyData = await verifyResponse.json();

      if (verifyData.status !== 'success' || verifyData.data.status !== 'successful') {
        console.error('Transaction verification failed');
        return new Response(JSON.stringify({ error: 'Verification failed' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Record payment
      await supabase.from('payments').insert({
        user_id: userId,
        reference: tx_ref,
        amount: amount,
        currency: currency || 'NGN',
        status: 'success',
        provider: 'flutterwave'
      });

      // Get plan details for credit allocation
      const { data: plan } = await supabase
        .from('plans')
        .select('tryons_per_month')
        .eq('id', planId)
        .single();

      const monthlyCredits = plan?.tryons_per_month || 100;
      const isUnlimited = monthlyCredits === -1;

      // Create or update subscription
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          provider: 'flutterwave',
          provider_subscription_id: tx_ref,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString()
        }, { onConflict: 'user_id' });

      // Update profile with plan credits
      await supabase
        .from('profiles')
        .update({ 
          widget_activated: true,
          current_plan_id: planId,
          monthly_credits_remaining: isUnlimited ? -1 : monthlyCredits,
          monthly_credits_total: isUnlimited ? -1 : monthlyCredits,
          updated_at: now.toISOString()
        })
        .eq('id', userId);

      console.log('Flutterwave payment processed for user:', userId);
    }

    return new Response(
      JSON.stringify({ received: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Flutterwave webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
