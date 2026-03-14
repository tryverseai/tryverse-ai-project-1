import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

async function checkRateLimit(supabase: any, apiKeyValue: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Clean old entries and count recent
  await supabase.from('rate_limits').delete().lt('window_start', windowStart);
  
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyValue)
    .gte('window_start', windowStart);

  if ((count || 0) >= RATE_LIMIT_MAX) {
    return false; // Rate limited
  }

  // Record this request
  await supabase.from('rate_limits').insert({
    api_key_id: apiKeyValue,
    window_start: new Date().toISOString(),
  });

  return true;
}

function validateOrigin(origin: string | null, referer: string | null, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true; // No restrictions configured
  
  const checkUrl = origin || referer;
  if (!checkUrl) return true; // Server-to-server calls have no origin
  
  try {
    const hostname = new URL(checkUrl).hostname;
    return allowedDomains.some(domain => {
      // Support wildcard subdomains
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      return hostname === domain;
    });
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate via API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required', code: 'AUTH_REQUIRED' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, status')
      .eq('key_value', apiKey)
      .eq('status', 'active')
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key', code: 'INVALID_KEY' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check domain whitelisting
    const { data: domains } = await supabase
      .from('allowed_domains')
      .select('domain')
      .eq('api_key_id', keyData.id);

    const allowedDomains = (domains || []).map((d: any) => d.domain);
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');

    if (!validateOrigin(origin, referer, allowedDomains)) {
      return new Response(
        JSON.stringify({ error: 'Domain not authorized for this API key', code: 'DOMAIN_BLOCKED' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const withinLimit = await checkRateLimit(supabase, apiKey);
    if (!withinLimit) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Maximum 60 requests per minute.', code: 'RATE_LIMITED' }), 
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    const userId = keyData.user_id;

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_value', apiKey);

    // Check credits (both free and monthly plan credits)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('free_credits_remaining, widget_activated, monthly_credits_remaining, monthly_credits_total, current_plan_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasUnlimitedCredits = profile.monthly_credits_total === -1;
    const hasMonthlyCredits = profile.monthly_credits_remaining > 0;
    const hasFreeCredits = profile.free_credits_remaining > 0;

    if (!profile.widget_activated && !hasFreeCredits) {
      return new Response(
        JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.', code: 'NO_CREDITS' }), 
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.widget_activated && !hasUnlimitedCredits && !hasMonthlyCredits) {
      return new Response(
        JSON.stringify({ error: 'Monthly credit limit reached. Credits reset next billing period.', code: 'MONTHLY_LIMIT' }), 
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productImage, personImage, category } = await req.json();

    if (!productImage || !personImage || !category) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productImage, personImage, category', code: 'MISSING_FIELDS' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create try-on record
    const { data: tryon, error: tryonError } = await supabase
      .from('tryons')
      .insert({
        user_id: userId,
        product_image: productImage,
        person_image: personImage,
        category: category,
        status: 'processing'
      })
      .select()
      .single();

    if (tryonError || !tryon) {
      throw new Error('Failed to create try-on record');
    }

    // Select model based on category
    let replicateVersion = '';
    if (category === 'clothing') {
      replicateVersion = 'c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4';
    } else if (category === 'jewelry' || category === 'glasses') {
      replicateVersion = 'b8899d5c98d4e0e0e8e0c42c5b0e5b1e5b0e5b1e';
    }

    // Call Replicate API
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: replicateVersion,
        input: {
          human_img: personImage,
          garm_img: productImage,
          garment_des: category === 'clothing' ? 'garment' : 'accessory'
        }
      })
    });

    const replicateData = await replicateResponse.json();

    if (!replicateResponse.ok) {
      throw new Error(`AI processing failed: ${replicateData.detail || 'Unknown error'}`);
    }

    // Poll for result
    const predictionId = replicateData.id;
    let resultImage = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts && !resultImage) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Token ${REPLICATE_API_KEY}` }
      });

      const statusData = await statusResponse.json();

      if (statusData.status === 'succeeded' && statusData.output) {
        resultImage = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
      } else if (statusData.status === 'failed') {
        throw new Error('AI processing failed. Please try again with a different image.');
      }

      attempts++;
    }

    if (!resultImage) {
      throw new Error('AI processing timed out. Please try again.');
    }

    // Update try-on record
    await supabase
      .from('tryons')
      .update({
        result_image: resultImage,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', tryon.id);

    // Deduct credits
    if (!profile.widget_activated) {
      // Deduct free credits
      await supabase
        .from('profiles')
        .update({ free_credits_remaining: Math.max(0, profile.free_credits_remaining - 1) })
        .eq('id', userId);
    } else if (!hasUnlimitedCredits) {
      // Deduct monthly credits
      await supabase
        .from('profiles')
        .update({ monthly_credits_remaining: Math.max(0, profile.monthly_credits_remaining - 1) })
        .eq('id', userId);
    }

    // Log usage
    await supabase.from('usage_events').insert({
      user_id: userId,
      event_type: 'tryon_generated',
      metadata: { category, tryon_id: tryon.id }
    });

    const creditsRemaining = !profile.widget_activated 
      ? Math.max(0, profile.free_credits_remaining - 1)
      : hasUnlimitedCredits ? 'unlimited' : Math.max(0, profile.monthly_credits_remaining - 1);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resultImage,
        tryonId: tryon.id,
        creditsRemaining
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating try-on:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, code: 'INTERNAL_ERROR' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
