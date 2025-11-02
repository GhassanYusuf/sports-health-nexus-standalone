import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define tools that the AI can use
const tools = [
  {
    type: "function",
    function: {
      name: "search_clubs",
      description: "Search for fitness clubs. Can filter by location or search all clubs.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "Optional location to filter clubs"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_activities",
      description: "Search for activities at a specific club",
      parameters: {
        type: "object",
        properties: {
          club_id: {
            type: "string",
            description: "The ID of the club to search activities for"
          }
        },
        required: ["club_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_packages",
      description: "Search for membership packages at a specific club",
      parameters: {
        type: "object",
        properties: {
          club_id: {
            type: "string",
            description: "The ID of the club to search packages for"
          },
          gender: {
            type: "string",
            description: "Optional gender filter (male, female, or mixed)",
            enum: ["male", "female", "mixed"]
          }
        },
        required: ["club_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_activity_schedules",
      description: "Get the schedule for specific activities",
      parameters: {
        type: "object",
        properties: {
          activity_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of activity IDs to get schedules for"
          }
        },
        required: ["activity_ids"]
      }
    }
  }
];

// Execute tool calls
async function executeToolCall(toolName: string, args: any) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  try {
    switch (toolName) {
      case "search_clubs": {
        let query = supabase.from('clubs').select('*');
        if (args.location) {
          query = query.ilike('location', `%${args.location}%`);
        }
        const { data, error } = await query.order('rating', { ascending: false }).limit(5);
        if (error) throw error;
        return data;
      }
      
      case "search_activities": {
        const { data, error } = await supabase
          .from('activities')
          .select('*, facility:facilities(name)')
          .eq('club_id', args.club_id);
        if (error) throw error;
        return data;
      }
      
      case "search_packages": {
        let query = supabase
          .from('club_packages')
          .select('*')
          .eq('club_id', args.club_id);
        
        if (args.gender && args.gender !== 'mixed') {
          query = query.or(`gender_restriction.eq.${args.gender},gender_restriction.eq.mixed`);
        }
        
        const { data, error } = await query.order('popularity', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      case "get_activity_schedules": {
        const { data, error } = await supabase
          .from('activity_schedules')
          .select('*, activity:activities(title)')
          .in('activity_id', args.activity_ids);
        if (error) throw error;
        return data;
      }
      
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing ${toolName}:`, error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model = "llama3.2:latest" } = await req.json();
    
    console.log("Received request with messages:", messages);

    // Prepare messages with system prompt
    const conversationMessages = [
      {
        role: "system",
        content: "You are a helpful fitness advisor AI! 🌟 You MUST use the available tools to search the actual database whenever users ask about clubs, activities, or packages. Never make up information - always call the search tools first. When users mention a location or ask about clubs, USE the search_clubs tool. When they ask about activities or packages at a club, USE the appropriate search tools. Keep responses friendly with emojis. CRITICAL: Do NOT use markdown formatting symbols like *, **, _, __, #, ##, etc. Write in plain text only with emojis."
      },
      ...messages
    ];

    console.log("Sending to Ollama with tools:", JSON.stringify({ model, tools: tools.map(t => t.function.name) }));

    // Make initial request to Ollama with tools
    let response = await fetch("http://ollama.p7h.me/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages,
        tools,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await response.json();
    console.log("Ollama full response:", JSON.stringify(data, null, 2));
    console.log("Message tool_calls:", data.message?.tool_calls);
    
    // Check if the model wants to use tools
    if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
      console.log("Tool calls detected:", JSON.stringify(data.message.tool_calls, null, 2));
      
      // Execute all tool calls
      const toolResults = await Promise.all(
        data.message.tool_calls.map(async (toolCall: any) => {
          const result = await executeToolCall(
            toolCall.function.name,
            toolCall.function.arguments
          );
          return {
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          };
        })
      );
      
      // Add assistant message with tool calls
      conversationMessages.push({
        role: "assistant",
        content: data.message.content || "",
        tool_calls: data.message.tool_calls
      });
      
      // Add tool results
      conversationMessages.push(...toolResults);
      
      console.log("Sending tool results back to AI");
      
      // Make another request with tool results
      response = await fetch("http://ollama.p7h.me/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: conversationMessages,
          tools,
          stream: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API error on tool response:", response.status, errorText);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      data = await response.json();
      console.log("Final Ollama response:", data);
    }
    
    // Extract the final message content
    const aiMessage = data.message?.content || data.response || "I'm sorry, I couldn't process that request.";

    return new Response(JSON.stringify({ message: aiMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ollama-chat function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
