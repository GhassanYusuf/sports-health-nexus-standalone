import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Fetching available models from Ollama");

    const response = await fetch("http://ollama.p7h.me/api/tags", {
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Ollama API response:", JSON.stringify(data));

    // Ollama returns { models: [ { name: "...", model: "...", ... }, ... ] }
    const models = data.models || [];
    console.log(`Found ${models.length} models:`, models.map((m: any) => m.name).join(', '));

    return new Response(JSON.stringify({ models }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
