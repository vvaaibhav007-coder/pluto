import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  // Read secrets inside the handler so they're always fresh
  const AI_API_KEY = Deno.env.get("MINIMAX_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Validate request method
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = payload.record;
  if (!record || payload.type !== "INSERT") {
    return new Response(JSON.stringify({ error: "Invalid webhook payload or not an INSERT." }), { 
      status: 400, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  const { id: bookmark_id, url, title, description } = record;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!AI_API_KEY) {
      throw new Error("MINIMAX_API_KEY is not set in Edge Function secrets.");
    }

    // --- Use NVIDIA's OpenAI-compatible API (key starts with nvapi-) ---
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [
          {
            role: "system",
            content: `You are a content categorization engine. You MUST respond with ONLY a raw JSON object — no explanation, no markdown, no code fences. Just the JSON.`
          },
          {
            role: "user",
            content: `Categorize this bookmark.

URL: ${url}
Title: ${title || "N/A"}  
Description: ${description || "N/A"}

Return this exact JSON shape:
{"category": "<one of: Article, Recipe, Video, Product, Tool, Research, Business, Design, Social, Other>", "tags": ["tag1", "tag2", "tag3"]}

Rules:
- If the URL contains instagram.com, twitter.com, x.com, or tiktok.com → category MUST be "Social"
- tags must be lowercase, specific, and useful for search (e.g. "javascript", "pasta", "startup-funding")
- Never return more than 3 tags
- Return ONLY the JSON object, nothing else`
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error("Empty or malformed AI response: " + JSON.stringify(data).slice(0, 300));
    }

    // Attempt to parse JSON safely — strip markdown fences if LLM wraps them
    let parsedContent;
    try {
      const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsedContent = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${content}`);
    }

    // Default fallbacks
    const category = parsedContent.category || "Other";
    const tags = Array.isArray(parsedContent.tags) ? parsedContent.tags : [];

    // 1. Update bookmarks table
    const { error: updateError } = await supabase
      .from('bookmarks')
      .update({
        category,
        tags,
        metadata_status: 'ok'
      })
      .eq('id', bookmark_id);

    if (updateError) {
      throw new Error(`Failed to update bookmark: ${JSON.stringify(updateError)}`);
    }

    // 2. Insert success record into ai_jobs
    const { error: jobError } = await supabase
      .from('ai_jobs')
      .insert({
        bookmark_id,
        status: 'done',
        raw_response: data,
        processed_at: new Date().toISOString()
      });

    if (jobError) {
      console.error("Failed to insert into ai_jobs:", jobError);
    }

    return new Response(JSON.stringify({ success: true, category, tags }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (error) {
    console.error("AI Categorization failed:", error);

    // Insert failure record into ai_jobs
    await supabase
      .from('ai_jobs')
      .insert({
        bookmark_id,
        status: 'failed',
        raw_response: { error: error instanceof Error ? error.message : String(error) },
        processed_at: new Date().toISOString()
      });
    
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});
