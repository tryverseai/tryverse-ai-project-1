import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get old try-on records
    const { data: oldTryons, error } = await supabase
      .from('tryons')
      .select('id, result_image, product_image, person_image')
      .lt('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'completed');

    if (error) {
      throw new Error(`Failed to fetch old tryons: ${error.message}`);
    }

    let deletedCount = 0;

    if (oldTryons && oldTryons.length > 0) {
      // Delete images from storage
      const filePaths: string[] = [];
      for (const tryon of oldTryons) {
        for (const url of [tryon.result_image, tryon.product_image, tryon.person_image]) {
          if (url && url.includes('tryverse_images')) {
            try {
              const urlObj = new URL(url);
              const path = urlObj.pathname.split('/tryverse_images/')[1];
              if (path) filePaths.push(path);
            } catch { /* skip invalid URLs */ }
          }
        }
      }

      if (filePaths.length > 0) {
        await supabase.storage.from('tryverse_images').remove(filePaths);
      }

      // Delete old try-on records
      const ids = oldTryons.map(t => t.id);
      await supabase.from('tryons').delete().in('id', ids);
      deletedCount = ids.length;
    }

    // Clean old rate limit entries
    await supabase.from('rate_limits').delete().lt('window_start', thirtyDaysAgo.toISOString());

    console.log(`Cleanup complete: ${deletedCount} old try-ons deleted`);

    return new Response(
      JSON.stringify({ success: true, deletedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
