import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify Paystack HMAC SHA512 signature
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();
    
    const hash = createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid Paystack signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event);

    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      const userId = metadata?.user_id;
      const planId = metadata?.plan_id;

      if (!userId || !planId) {
        console.error('Missing user_id or plan_id in metadata');
        return new Response(JSON.stringify({ error: 'Invalid metadata' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Record payment
      await supabase.from('payments').insert({
        user_id: userId,
        reference: reference,
        amount: amount / 100,
        currency: 'NGN',
        status: 'success',
        provider: 'paystack'
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

      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          provider: 'paystack',
          provider_subscription_id: event.data.subscription?.subscription_code || null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString()
        }, { onConflict: 'user_id' });

      if (subError) {
        console.error('Error updating subscription:', subError);
      }

      // Activate widget AND set plan credits
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

      console.log('Payment processed successfully for user:', userId, 'plan:', planId);
    }

    if (event.event === 'subscription.disable' || event.event === 'subscription.not_renew') {
      const subscriptionCode = event.data.subscription_code;

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('provider_subscription_id', subscriptionCode)
        .single();

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('provider_subscription_id', subscriptionCode);

        await supabase
          .from('profiles')
          .update({ 
            widget_activated: false,
            current_plan_id: null,
            monthly_credits_remaining: 0,
            monthly_credits_total: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.user_id);

        console.log('Subscription cancelled for user:', subscription.user_id);
      }
    }

    return new Response(
      JSON.stringify({ received: true }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
