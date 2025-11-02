import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RegistrationReceiptEmail } from "./_templates/registration-receipt.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReceiptRequest {
  clubId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentAddress?: string;
  members: {
    name: string;
    packageName: string;
    packagePrice: number;
  }[];
  enrollmentFee: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const {
      clubId,
      parentName,
      parentEmail,
      parentPhone,
      parentAddress,
      members,
      enrollmentFee,
    }: ReceiptRequest = await req.json();

    console.log("Fetching club details for receipt...");

    // Fetch club details
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single();

    if (clubError || !club) {
      console.error("Club fetch error:", clubError);
      throw new Error("Club not found");
    }

    console.log("Club fetched:", club.name);

    // Prepare receipt items
    const items = [];
    let itemNo = 1;
    
    // Add enrollment fees
    const totalMembers = members.length;
    if (enrollmentFee > 0 && totalMembers > 0) {
      items.push({
        itemNo: itemNo++,
        description: `Enrollment Fee (${totalMembers} member${totalMembers > 1 ? 's' : ''})`,
        qty: totalMembers,
        price: enrollmentFee,
        total: enrollmentFee * totalMembers,
      });
    }

    // Add package fees
    members.forEach((member) => {
      items.push({
        itemNo: itemNo++,
        description: `${member.packageName} for ${member.name}`,
        qty: 1,
        price: member.packagePrice,
        total: member.packagePrice,
      });
    });

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    
    // Only calculate VAT if club has VAT registration number
    const hasVatNumber = club.vat_registration_number && club.vat_registration_number.trim() !== '';
    const vatPercentage = hasVatNumber ? (club.vat_percentage || 0) : 0;
    const vatAmount = hasVatNumber ? subtotal * (vatPercentage / 100) : 0;
    const grandTotal = subtotal + vatAmount;

    // Generate receipt number
    const receiptPrefix = club.receipt_code_prefix || "REC";
    const timestamp = Date.now();
    const receiptNumber = `${receiptPrefix}-${timestamp}`;

    // Format issue date
    const issueDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    console.log("Rendering email template...");

    // Render email
    const html = await renderAsync(
      React.createElement(RegistrationReceiptEmail, {
        clubName: club.name,
        clubSlogan: club.slogan || undefined,
        commercialRegNumber: club.commercial_registration_number || undefined,
        vatRegNumber: club.vat_registration_number || undefined,
        logoUrl: club.logo_url || undefined,
        recipientName: parentName,
        recipientPhone: parentPhone,
        recipientEmail: parentEmail,
        recipientAddress: parentAddress || undefined,
        receiptNumber,
        issueDate,
        items,
        subtotal,
        vatPercentage,
        vatAmount,
        grandTotal,
        currency: club.currency || "USD",
        clubPhone: club.club_phone ? `${club.club_phone_code || ''}${club.club_phone}` : undefined,
        clubEmail: club.club_email || undefined,
        clubAddress: club.location || undefined,
      })
    );

    console.log("Sending email via Resend...");

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: `${club.name} <onboarding@resend.dev>`,
      to: [parentEmail],
      subject: `Registration Receipt - ${club.name}`,
      html,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      throw emailError;
    }

    console.log("Receipt email sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        receiptNumber,
        message: "Receipt sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-registration-receipt:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
