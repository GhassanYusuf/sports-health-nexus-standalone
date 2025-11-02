import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple encryption using Web Crypto API
async function encrypt(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(key.padEnd(32, '0').substring(0, 32));
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.padEnd(32, '0').substring(0, 32));
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("BANK_ENCRYPTION_KEY")!;
    
    if (!encryptionKey) {
      throw new Error("BANK_ENCRYPTION_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, data, accountId, clubId } = await req.json();

    console.log("Bank accounts action:", action);

    switch (action) {
      case "create": {
        const { club_id, bank_name, account_name, account_number, iban, swift_code, is_primary } = data;
        
        // Encrypt sensitive data
        const encryptedAccountNumber = await encrypt(account_number, encryptionKey);
        const encryptedIban = iban ? await encrypt(iban, encryptionKey) : null;
        const encryptedSwiftCode = swift_code ? await encrypt(swift_code, encryptionKey) : null;

        const { data: newAccount, error } = await supabase
          .from("bank_accounts")
          .insert({
            club_id,
            bank_name,
            account_name,
            account_number_encrypted: encryptedAccountNumber,
            iban_encrypted: encryptedIban,
            swift_code_encrypted: encryptedSwiftCode,
            is_primary,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, data: newAccount }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        const { data: accounts, error } = await supabase
          .from("bank_accounts")
          .select("*")
          .eq("club_id", clubId)
          .order("is_primary", { ascending: false });

        if (error) throw error;

        // Decrypt sensitive data
        const decryptedAccounts = await Promise.all(
          accounts.map(async (account) => ({
            ...account,
            account_number: await decrypt(account.account_number_encrypted, encryptionKey),
            iban: account.iban_encrypted ? await decrypt(account.iban_encrypted, encryptionKey) : null,
            swift_code: account.swift_code_encrypted ? await decrypt(account.swift_code_encrypted, encryptionKey) : null,
          }))
        );

        return new Response(
          JSON.stringify({ success: true, data: decryptedAccounts }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const { bank_name, account_name, account_number, iban, swift_code, is_primary } = data;
        
        // Encrypt sensitive data
        const encryptedAccountNumber = await encrypt(account_number, encryptionKey);
        const encryptedIban = iban ? await encrypt(iban, encryptionKey) : null;
        const encryptedSwiftCode = swift_code ? await encrypt(swift_code, encryptionKey) : null;

        const { data: updatedAccount, error } = await supabase
          .from("bank_accounts")
          .update({
            bank_name,
            account_name,
            account_number_encrypted: encryptedAccountNumber,
            iban_encrypted: encryptedIban,
            swift_code_encrypted: encryptedSwiftCode,
            is_primary,
          })
          .eq("id", accountId)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, data: updatedAccount }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { error } = await supabase
          .from("bank_accounts")
          .delete()
          .eq("id", accountId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Error in bank-accounts function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
