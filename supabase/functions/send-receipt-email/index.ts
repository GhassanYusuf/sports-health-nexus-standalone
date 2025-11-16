import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

/**
 * Edge Function to send receipt/invoice emails via Gmail SMTP
 *
 * Environment variables needed:
 * - SMTP_HOST: smtp.gmail.com
 * - SMTP_PORT: 465
 * - SMTP_USER: platformtakeone@gmail.com
 * - SMTP_PASSWORD: azzuczmpfxnupyym
 * - SMTP_FROM_EMAIL: platformtakeone@gmail.com
 * - SMTP_FROM_NAME: Sports Health Nexus
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  transactionId?: string;
  recipientEmail?: string;
  testMode?: boolean; // For sending test emails with sample data
}

interface ReceiptItem {
  itemNo: number;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

interface ReceiptData {
  club: {
    name: string;
    slogan?: string;
    logoUrl?: string;
    commercialRegistrationNumber?: string;
    vatRegistrationNumber?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    currency: string;
    vatPercentage: number;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  receiptNumber: string;
  issueDate: string;
  isPaid: boolean;
  items: ReceiptItem[];
  subTotal: number;
  vatAmount: number;
  grandTotal: number;
  notes?: string;
  latePaymentInfo?: {
    childName: string;
    startDate: string;
  };
}

function generateReceiptHtml(data: ReceiptData): string {
  const {
    club,
    customer,
    receiptNumber,
    issueDate,
    isPaid,
    items,
    subTotal,
    vatAmount,
    grandTotal,
    notes,
    latePaymentInfo,
  } = data;

  const itemsHtml = items
    .map(
      (item, index) => `
        <tr style="${index % 2 === 1 ? 'background-color: #F2F2F2;' : ''}">
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px;">${item.itemNo}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px;">${item.description}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; text-align: right;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; text-align: right;">${item.price.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; text-align: right;">${item.total.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const noteHtml = latePaymentInfo
    ? `
    <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 10px 15px; margin: 20px 0; font-size: 14px; color: #664d03;">
        <p style="margin: 0;"><strong style="color: #333;">Note:</strong> This payment covers the registration fee for <strong>${latePaymentInfo.childName}</strong> who started training on <strong>${latePaymentInfo.startDate}</strong>.</p>
    </div>`
    : notes
    ? `
    <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 10px 15px; margin: 20px 0; font-size: 14px; color: #664d03;">
        <p style="margin: 0;"><strong style="color: #333;">Note:</strong> ${notes}</p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isPaid ? "Receipt" : "Invoice"}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f0f0f0; margin: 0; padding: 10px; color: #333;">
    <!-- Main Container -->
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 6px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
            <td style="background-color: #C41E3A; padding: 15px 20px; color: #FFFFFF; border-radius: 6px 6px 0 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="vertical-align: top; width: 70%;">
                            <!-- Title -->
                            <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0; text-transform: uppercase; color: #FFFFFF; border-bottom: 2px solid rgba(255,255,255,0.5); padding-bottom: 8px;">${club.name}</h1>
                            ${club.slogan ? `<p style="font-size: 13px; font-weight: 600; margin: 0 0 15px 0; color: #FFFFFF;">${club.slogan}</p>` : ""}

                            <!-- Registration Numbers -->
                            ${club.commercialRegistrationNumber ? `
                            <table cellpadding="0" cellspacing="0" style="margin-bottom: 5px;">
                                <tr>
                                    <td style="background-color: #FFFFFF; color: #333; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;">COMMERCIAL REGISTRATION #</td>
                                    <td style="width: 10px;"></td>
                                    <td style="background-color: #FFFFFF; color: #333; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;">${club.commercialRegistrationNumber}</td>
                                </tr>
                            </table>` : ""}
                            ${club.vatRegistrationNumber ? `
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background-color: #FFFFFF; color: #333; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;">VAT REGISTRATION #</td>
                                    <td style="width: 10px;"></td>
                                    <td style="background-color: #FFFFFF; color: #333; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;">${club.vatRegistrationNumber}</td>
                                </tr>
                            </table>` : ""}
                        </td>
                        <td style="vertical-align: top; width: 30%; text-align: right;">
                            ${club.logoUrl ? `<img src="${club.logoUrl}" alt="${club.name}" style="max-width: 120px; height: auto;">` : ""}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Main Content -->
        <tr>
            <td style="padding: 20px;">
                <!-- Customer Info & Receipt Details -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                    <tr>
                        <td style="vertical-align: top; width: 50%;">
                            <p style="margin: 0 0 10px 0; font-weight: bold;">${isPaid ? "RECEIPT TO" : "INVOICE TO"}:</p>
                            <p style="margin: 0; line-height: 1.6;">
                                <strong>${customer.name}</strong><br>
                                ${customer.phone ? `${customer.phone}<br>` : ""}
                                ${customer.email ? `${customer.email}<br>` : ""}
                                ${customer.address || ""}
                            </p>
                        </td>
                        <td style="vertical-align: top; width: 50%; text-align: right;">
                            <table cellpadding="0" cellspacing="0" align="right" style="margin-bottom: 5px;">
                                <tr>
                                    <td style="background-color: #C41E3A; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 5px 15px; border-radius: 999px;">
                                        <span style="margin-right: 10px;">${isPaid ? "RECEIPT NO" : "INVOICE NO"}</span>
                                        <span style="background-color: #FFFFFF; color: #C41E3A; padding: 3px 10px; border-radius: 999px; font-weight: 700;">${receiptNumber}</span>
                                    </td>
                                </tr>
                            </table>
                            <br>
                            <table cellpadding="0" cellspacing="0" align="right">
                                <tr>
                                    <td style="background-color: #C41E3A; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 5px 15px; border-radius: 999px;">
                                        <span style="margin-right: 10px;">ISSUE DATE</span>
                                        <span style="background-color: #FFFFFF; color: #C41E3A; padding: 3px 10px; border-radius: 999px; font-weight: 700;">${issueDate}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Items Table -->
                <table width="100%" cellpadding="10" cellspacing="0" style="margin-bottom: 20px; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #C41E3A; color: #FFFFFF;">
                            <th style="padding: 10px; text-align: left; font-size: 12px; border-bottom: 1px solid #ddd;">Item No</th>
                            <th style="padding: 10px; text-align: left; font-size: 12px; border-bottom: 1px solid #ddd;">Description</th>
                            <th style="padding: 10px; text-align: right; font-size: 12px; border-bottom: 1px solid #ddd;">Qty</th>
                            <th style="padding: 10px; text-align: right; font-size: 12px; border-bottom: 1px solid #ddd;">Price</th>
                            <th style="padding: 10px; text-align: right; font-size: 12px; border-bottom: 1px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                ${noteHtml}

                <!-- Totals Table -->
                <table align="right" cellpadding="8" cellspacing="0" style="width: 250px; margin-bottom: 30px; border-collapse: collapse;">
                    <tr style="background-color: #F2F2F2;">
                        <td style="padding: 8px; text-align: right; font-size: 14px;">Sub Total:</td>
                        <td style="padding: 8px; text-align: right; font-size: 14px;">${subTotal.toFixed(2)} ${club.currency}</td>
                    </tr>
                    <tr style="background-color: #F2F2F2;">
                        <td style="padding: 8px; text-align: right; font-size: 14px;">VAT (${club.vatPercentage}%):</td>
                        <td style="padding: 8px; text-align: right; font-size: 14px;">${vatAmount.toFixed(2)} ${club.currency}</td>
                    </tr>
                    <tr style="background-color: #C41E3A; color: #FFFFFF;">
                        <td style="padding: 8px; text-align: right; font-size: 14px; font-weight: 700;">Grand Total:</td>
                        <td style="padding: 8px; text-align: right; font-size: 14px; font-weight: 700;">${grandTotal.toFixed(2)} ${club.currency}</td>
                    </tr>
                </table>

                <div style="clear: both;"></div>

                <!-- Contact Info -->
                <div style="margin-top: 20px; font-size: 12px; line-height: 1.6;">
                    ${club.phone ? `<p style="margin: 5px 0;"><span style="color: #C41E3A;">&#9742;</span> ${club.phone}</p>` : ""}
                    ${club.email || club.website ? `<p style="margin: 5px 0;"><span style="color: #C41E3A;">&#9993;</span> ${club.website ? `${club.website}<br>` : ""}${club.email || ""}</p>` : ""}
                    ${club.address ? `<p style="margin: 5px 0;"><span style="color: #C41E3A;">&#9906;</span> ${club.address.replace(/\n/g, "<br>")}</p>` : ""}
                </div>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #C41E3A; padding: 10px 20px; text-align: center; color: #FFFFFF; font-size: 12px; font-weight: 600; border-radius: 0 0 6px 6px;">
                © ${new Date().getFullYear()} ${club.name.toUpperCase()}. All Rights Reserved.
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
  const fromName = Deno.env.get("SMTP_FROM_NAME") || "Sports Health Nexus";

  if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
    throw new Error("SMTP configuration missing. Please set environment variables.");
  }

  console.log(`[send-receipt-email] Connecting to SMTP: ${smtpHost}:${smtpPort}`);

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: true,
      auth: {
        username: smtpUser,
        password: smtpPassword,
      },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: to,
      subject: subject,
      content: htmlBody,
      html: htmlBody,
    });

    await client.close();
    console.log(`[send-receipt-email] Email sent successfully to: ${to}`);
  } catch (error) {
    await client.close();
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { transactionId, recipientEmail, testMode }: EmailRequest = await req.json();

    let receiptData: ReceiptData;

    if (testMode) {
      // Send test email with REAL club data from database
      console.log("[send-receipt-email] Test mode - fetching real club data");

      // Fetch the first club from database (or you can specify a club_id)
      const { data: clubs, error: clubError } = await supabaseClient
        .from("clubs")
        .select("*")
        .limit(1)
        .single();

      if (clubError || !clubs) {
        throw new Error(`No clubs found in database: ${clubError?.message}`);
      }

      const club = clubs;
      const isPaid = true;
      const issueDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // Calculate test amounts with club's VAT
      const subTotal = 60.0;
      const vatAmount = subTotal * ((club.vat_percentage || 0) / 100);
      const grandTotal = subTotal + vatAmount;

      receiptData = {
        club: {
          name: club.name,
          slogan: club.slogan || undefined,
          logoUrl: club.logo_url || undefined,
          commercialRegistrationNumber: club.commercial_registration_number || undefined,
          vatRegistrationNumber: club.vat_registration_number || undefined,
          phone: club.club_phone
            ? `${club.club_phone_code || ""}${club.club_phone}`
            : undefined,
          email: club.club_email || undefined,
          website: undefined,
          address: club.location || undefined,
          currency: club.currency || "BHD",
          vatPercentage: club.vat_percentage || 0,
        },
        customer: {
          name: recipientEmail?.split('@')[0] || "Test Customer",
          phone: "+973 39123456",
          email: recipientEmail || "test@example.com",
          address: "Test Address, Bahrain",
        },
        receiptNumber: `${club.receipt_code_prefix || "REC"}-TEST-${Date.now()}`,
        issueDate,
        isPaid,
        items: [
          {
            itemNo: 1,
            description: "Monthly Membership Package",
            quantity: 1,
            price: 50.0,
            total: 50.0,
          },
          {
            itemNo: 2,
            description: "Registration Fee",
            quantity: 1,
            price: 10.0,
            total: 10.0,
          },
        ],
        subTotal,
        vatAmount,
        grandTotal,
        notes: "This is a test receipt email. Thank you for your business!",
      };
    } else {
      // Fetch real transaction data
      if (!transactionId) {
        throw new Error("Transaction ID is required when not in test mode");
      }

      const { data: transaction, error: transactionError } = await supabaseClient
        .from("transaction_ledger")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (transactionError || !transaction) {
        throw new Error(`Transaction not found: ${transactionError?.message}`);
      }

      const { data: club, error: clubError } = await supabaseClient
        .from("clubs")
        .select("*")
        .eq("id", transaction.club_id)
        .single();

      if (clubError || !club) {
        throw new Error(`Club not found: ${clubError?.message}`);
      }

      const isPaid = transaction.payment_status === "paid";
      const issueDate = new Date(transaction.transaction_date).toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }
      );

      receiptData = {
        club: {
          name: club.name,
          slogan: club.slogan || undefined,
          logoUrl: club.logo_url || undefined,
          commercialRegistrationNumber:
            club.commercial_registration_number || undefined,
          vatRegistrationNumber: club.vat_registration_number || undefined,
          phone: club.club_phone
            ? `${club.club_phone_code || ""}${club.club_phone}`
            : undefined,
          email: club.club_email || undefined,
          website: undefined,
          address: club.location || undefined,
          currency: club.currency || "BHD",
          vatPercentage: club.vat_percentage || 0,
        },
        customer: {
          name: transaction.member_name || "N/A",
          phone: transaction.member_phone || undefined,
          email: transaction.member_email || undefined,
          address: undefined,
        },
        receiptNumber: transaction.receipt_number || "N/A",
        issueDate,
        isPaid,
        items: [
          {
            itemNo: 1,
            description: transaction.description,
            quantity: 1,
            price: transaction.amount,
            total: transaction.amount,
          },
        ],
        subTotal: transaction.amount,
        vatAmount: transaction.vat_amount,
        grandTotal: transaction.total_amount,
        notes: transaction.notes || undefined,
      };
    }

    // Generate HTML
    const htmlBody = generateReceiptHtml(receiptData);

    // Determine recipient
    const toEmail = recipientEmail || receiptData.customer.email;
    if (!toEmail) {
      throw new Error("No recipient email provided");
    }

    // Send email
    const subject = receiptData.isPaid
      ? `Receipt ${receiptData.receiptNumber} - ${receiptData.club.name}`
      : `Invoice ${receiptData.receiptNumber} - ${receiptData.club.name}`;

    await sendEmailViaSMTP(toEmail, subject, htmlBody);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully!",
        sentTo: toEmail,
        receiptNumber: receiptData.receiptNumber,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[send-receipt-email] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
