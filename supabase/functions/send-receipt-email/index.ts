import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Edge Function to send receipt/invoice emails
 *
 * This function will be used to send receipt or invoice emails to customers
 * when a transaction is created or payment is approved.
 *
 * TODO: Configure SMTP server before using this function
 *
 * Environment variables needed:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port
 * - SMTP_USER: SMTP username
 * - SMTP_PASSWORD: SMTP password
 * - SMTP_FROM_EMAIL: From email address
 * - SMTP_FROM_NAME: From name
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  transactionId: string;
  recipientEmail?: string; // Optional override
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
      (item) => `
        <tr>
            <td>${item.itemNo}</td>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toFixed(2)}</td>
            <td>${item.total.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const noteHtml = latePaymentInfo
    ? `
    <div id="payment-note" class="receipt-note" style="display: block;">
        <p><strong>Note:</strong> This payment covers the registration fee for <strong>${latePaymentInfo.childName}</strong> who started training on <strong>${latePaymentInfo.startDate}</strong>.</p>
    </div>`
    : notes
    ? `
    <div id="payment-note" class="receipt-note" style="display: block;">
        <p><strong>Note:</strong> ${notes}</p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isPaid ? "Receipt" : "Invoice"}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        :root { --primary-color: #C41E3A; --primary-white: #FFFFFF; --text-color: #333; --light-gray: #F2F2F2; }
        body { font-family: 'Poppins', sans-serif; background-color: #f0f0f0; margin: 0; padding: 10px; color: var(--text-color); }
        .invoice-container { max-width: 148mm; width: 100%; margin: 0 auto; background-color: var(--primary-white); box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); position: relative; border-radius: 6px; }
        .header { background-color: var(--primary-color); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; color: var(--primary-white); margin-bottom: 5px; }
        .header-info { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1; margin-right: 20px; }
        .receipt-title-wrapper { display: flex; flex-direction: column; gap: 5px; padding-bottom: 8px; border-bottom: 2px solid rgba(255, 255, 255, 0.5); width: 100%; }
        .receipt-title-wrapper h1 { font-size: 20px; font-weight: 700; line-height: 1; margin: 0; text-transform: uppercase; }
        .receipt-title-wrapper .slogan { font-size: 13px; font-weight: 600; margin: 0; }
        .registration-info { display: flex; flex-direction: column; gap: 5px; margin-top: 0; width: 100%; }
        .reg-row { display: flex; gap: 10px; }
        .white-box { background-color: var(--primary-white); color: var(--text-color); padding: 5px 10px; border-radius: 999px; font-size: 12px; line-height: 1.2; text-align: center; display: flex; align-items: center; justify-content: center; font-weight: 600; }
        .reg-row .white-box:first-child { flex: 7 1 0%; }
        .reg-row .white-box:last-child { flex: 3 1 0%; }
        .header img { max-width: 120px; height: auto; }
        .main-content { padding: 10px 20px 30px; }
        .invoice-info { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; line-height: 1.6; }
        .info-details { text-align: left; }
        @media (min-width: 500px) { .invoice-info { flex-direction: row; justify-content: space-between; } .info-details { text-align: right; } }
        .info-row { display: flex; justify-content: space-between; align-items: center; background-color: var(--primary-color); border-radius: 999px; color: var(--primary-white); font-weight: 700; font-size: 14px; padding: 5px 15px; margin-left: auto; width: 220px; margin-bottom: 5px; }
        .info-row span.white-pill { background-color: var(--primary-white); border-radius: 999px; padding: 3px 10px; color: var(--primary-color); font-weight: 700; text-align: center; line-height: 1; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; text-align: left; }
        table thead { background-color: var(--primary-color); color: var(--primary-white); }
        table th, table td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
        table tbody tr:nth-child(even) { background-color: var(--light-gray); }
        table td:last-child { text-align: right; }
        table td:nth-child(3), table td:nth-child(4) { text-align: right; }
        .sub-total-table { width: 250px; float: right; border-collapse: collapse; margin-bottom: 30px; }
        .sub-total-table td { padding: 8px; text-align: right; font-size: 14px; }
        .sub-total-table tr:not(:last-child) { background-color: var(--light-gray); }
        .sub-total-table .grand-total-row { background-color: var(--primary-color) !important; color: var(--primary-white); font-weight: 700; }
        .receipt-note { background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 10px 15px; margin-top: 20px; margin-bottom: 20px; font-size: 14px; color: #664d03; line-height: 1.4; }
        .receipt-note strong { color: #333; }
        .contact-info { display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; line-height: 1.4; font-size: 12px; }
        .contact-info-item { display: flex; align-items: flex-start; gap: 8px; }
        .contact-info-item .icon { font-size: 16px; color: var(--primary-color); line-height: 1; }
        .footer { background-color: var(--primary-color); padding: 10px 20px; text-align: center; color: var(--primary-white); font-size: 12px; font-weight: 600; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; }
    </style>
</head>
<body>
<div class="invoice-container">
    <div class="header">
        <div class="header-info">
            <div class="receipt-title-wrapper">
                <h1>${club.name}</h1>
                ${club.slogan ? `<p class="slogan">${club.slogan}</p>` : ""}
            </div>
            <div class="registration-info">
                ${club.commercialRegistrationNumber ? `<div class="reg-row"><div class="white-box">COMMERCIAL REGISTRATION #</div><div class="white-box">${club.commercialRegistrationNumber}</div></div>` : ""}
                ${club.vatRegistrationNumber ? `<div class="reg-row"><div class="white-box">VAT REGISTRATION #</div><div class="white-box">${club.vatRegistrationNumber}</div></div>` : ""}
            </div>
        </div>
        ${club.logoUrl ? `<img src="${club.logoUrl}" alt="${club.name} Logo">` : ""}
    </div>
    <div class="main-content">
        <div class="invoice-info">
            <div>
                <p class="to"><B>${isPaid ? "RECEIPT TO" : "INVOICE TO"} :</B></p>
                <p>
                    <strong>${customer.name}</strong><br>
                    ${customer.phone ? `${customer.phone}<br>` : ""}
                    ${customer.email ? `${customer.email}<br>` : ""}
                    ${customer.address ? customer.address : ""}
                </p>
            </div>
            <div class="info-details">
                <div class="info-row">
                    <span>${isPaid ? "RECEIPT NO" : "INVOICE NO"}</span>
                    <span class="white-pill">${receiptNumber}</span>
                </div>
                <div class="info-row">
                    <span>ISSUE DATE</span>
                    <span class="white-pill">${issueDate}</span>
                </div>
            </div>
        </div>
        <table id="receipt-items">
            <thead><tr><th>Item No</th><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
        </table>
        ${noteHtml}
        <table class="sub-total-table">
            <tbody>
                <tr><td>Sub Total:</td><td>${subTotal.toFixed(2)} ${club.currency}</td></tr>
                <tr><td>VAT (${club.vatPercentage}%):</td><td>${vatAmount.toFixed(2)} ${club.currency}</td></tr>
                <tr class="grand-total-row"><td>Grand Total:</td><td>${grandTotal.toFixed(2)} ${club.currency}</td></tr>
            </tbody>
        </table>
        <div class="contact-info">
            ${club.phone ? `<div class="contact-info-item"><span class="icon">&#9742;</span><div>${club.phone}</div></div>` : ""}
            ${club.email || club.website ? `<div class="contact-info-item"><span class="icon">&#9993;</span><div>${club.website ? `${club.website}<br>` : ""}${club.email || ""}</div></div>` : ""}
            ${club.address ? `<div class="contact-info-item"><span class="icon">&#9906;</span><div>${club.address.replace(/\n/g, "<br>")}</div></div>` : ""}
        </div>
    </div>
    <div class="footer">© ${new Date().getFullYear()} ${club.name.toUpperCase()}. All Rights Reserved.</div>
</div>
</body>
</html>`;
}

async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  // TODO: Configure SMTP server
  // For now, this is a placeholder that logs the email
  console.log("Email would be sent to:", to);
  console.log("Subject:", subject);
  console.log("HTML Body length:", htmlBody.length);

  // SMTP Implementation Example (uncomment when ready):
  /*
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
  const fromName = Deno.env.get("SMTP_FROM_NAME");

  if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
    throw new Error("SMTP configuration missing");
  }

  // Use a library like https://deno.land/x/smtp to send email
  // Example:
  // const client = new SMTPClient({
  //   connection: {
  //     hostname: smtpHost,
  //     port: smtpPort,
  //     tls: true,
  //     auth: { username: smtpUser, password: smtpPassword }
  //   }
  // });
  // await client.send({
  //   from: `${fromName} <${fromEmail}>`,
  //   to: to,
  //   subject: subject,
  //   html: htmlBody,
  // });
  // await client.close();
  */
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

    const { transactionId, recipientEmail }: EmailRequest = await req.json();

    if (!transactionId) {
      throw new Error("Transaction ID is required");
    }

    // Fetch transaction data
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("transaction_ledger")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      throw new Error(`Transaction not found: ${transactionError?.message}`);
    }

    // Fetch club data
    const { data: club, error: clubError } = await supabaseClient
      .from("clubs")
      .select("*")
      .eq("id", transaction.club_id)
      .single();

    if (clubError || !club) {
      throw new Error(`Club not found: ${clubError?.message}`);
    }

    // Prepare receipt data
    const isPaid = transaction.payment_status === "paid";
    const issueDate = new Date(transaction.transaction_date).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );

    const receiptData: ReceiptData = {
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

    // Generate HTML
    const htmlBody = generateReceiptHtml(receiptData);

    // Determine recipient
    const toEmail = recipientEmail || transaction.member_email;
    if (!toEmail) {
      throw new Error("No recipient email provided");
    }

    // Send email
    const subject = isPaid
      ? `Receipt ${transaction.receipt_number} - ${club.name}`
      : `Invoice ${transaction.receipt_number} - ${club.name}`;

    await sendEmail(toEmail, subject, htmlBody);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully (placeholder - configure SMTP)",
        sentTo: toEmail,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
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
