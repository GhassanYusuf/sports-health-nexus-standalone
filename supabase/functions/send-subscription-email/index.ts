import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionEmailRequest {
  type: 'thank_you' | 'renewal_reminder' | 'expiration_invoice';
  memberName: string;
  memberEmail: string;
  clubName: string;
  packageName: string;
  packagePrice: number;
  currency: string;
  enrollmentFee?: number;
  durationMonths: number;
  enrolledDate: string;
  expiryDate?: string;
  receiptNumber?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: SubscriptionEmailRequest = await req.json();

    console.log('[send-subscription-email] Processing email type:', data.type);

    let emailSubject: string;
    let emailHtml: string;

    // Format currency
    const formatCurrency = (amount: number) => {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: data.currency,
        }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${data.currency}`;
      }
    };

    switch (data.type) {
      case 'thank_you':
        emailSubject = `Thank You for Subscribing to ${data.clubName}!`;
        const total = data.packagePrice + (data.enrollmentFee || 0);
        emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .receipt-box { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .receipt-header { font-size: 18px; font-weight: bold; color: #667eea; margin-bottom: 15px; }
                .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
                .receipt-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; color: #667eea; }
                .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Welcome to ${data.clubName}!</h1>
                </div>
                <div class="content">
                  <p>Dear ${data.memberName},</p>
                  <p>Thank you for subscribing to our <strong>${data.packageName}</strong> package! We're thrilled to have you as part of our community.</p>
                  
                  <div class="receipt-box">
                    <div class="receipt-header">📄 Payment Receipt ${data.receiptNumber ? `#${data.receiptNumber}` : ''}</div>
                    <div class="receipt-row">
                      <span>Package:</span>
                      <span>${data.packageName}</span>
                    </div>
                    <div class="receipt-row">
                      <span>Duration:</span>
                      <span>${data.durationMonths} ${data.durationMonths === 1 ? 'month' : 'months'}</span>
                    </div>
                    <div class="receipt-row">
                      <span>Package Fee:</span>
                      <span>${formatCurrency(data.packagePrice)}</span>
                    </div>
                    ${data.enrollmentFee ? `
                    <div class="receipt-row">
                      <span>Enrollment Fee:</span>
                      <span>${formatCurrency(data.enrollmentFee)}</span>
                    </div>
                    ` : ''}
                    <div class="receipt-row">
                      <span>Total Paid:</span>
                      <span>${formatCurrency(total)}</span>
                    </div>
                    <div class="receipt-row" style="margin-top: 10px; padding-top: 10px;">
                      <span>Enrolled Date:</span>
                      <span>${new Date(data.enrolledDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <p>Your membership is now active and you can start enjoying all the benefits of ${data.clubName}.</p>
                  
                  <div class="footer">
                    <p>If you have any questions, please don't hesitate to contact us.</p>
                    <p>&copy; ${new Date().getFullYear()} ${data.clubName}. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case 'renewal_reminder':
        emailSubject = `Reminder: Your ${data.clubName} Subscription Renews Soon`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .reminder-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
                .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⏰ Subscription Renewal Reminder</h1>
                </div>
                <div class="content">
                  <p>Dear ${data.memberName},</p>
                  
                  <div class="reminder-box">
                    <p><strong>Your subscription payment is due in 3 days!</strong></p>
                    <p>Package: <strong>${data.packageName}</strong></p>
                    <p>Amount: <strong>${formatCurrency(data.packagePrice)}</strong></p>
                    <p>Due Date: <strong>${new Date(data.expiryDate!).toLocaleDateString()}</strong></p>
                  </div>

                  <p>To continue enjoying uninterrupted access to ${data.clubName}, please make your payment before the due date.</p>
                  
                  <div class="footer">
                    <p>Thank you for being a valued member of ${data.clubName}!</p>
                    <p>&copy; ${new Date().getFullYear()} ${data.clubName}. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      case 'expiration_invoice':
        emailSubject = `Action Required: Renew Your ${data.clubName} Subscription`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .urgent-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px; }
                .invoice-box { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⚠️ Subscription Expiring Soon</h1>
                </div>
                <div class="content">
                  <p>Dear ${data.memberName},</p>
                  
                  <div class="urgent-box">
                    <p><strong>Your subscription expires in 3 days or less!</strong></p>
                    <p>Don't lose access to ${data.clubName}. Renew now to maintain uninterrupted service.</p>
                  </div>

                  <div class="invoice-box">
                    <h3 style="color: #ef4444; margin-top: 0;">Renewal Invoice</h3>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                      <span>Package:</span>
                      <span><strong>${data.packageName}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                      <span>Duration:</span>
                      <span><strong>${data.durationMonths} ${data.durationMonths === 1 ? 'month' : 'months'}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: bold; color: #ef4444;">
                      <span>Amount Due:</span>
                      <span>${formatCurrency(data.packagePrice)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; color: #6b7280;">
                      <span>Expiry Date:</span>
                      <span>${new Date(data.expiryDate!).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <p>Please complete your payment to continue enjoying all the benefits of your membership.</p>
                  
                  <div class="footer">
                    <p>We appreciate your membership at ${data.clubName}!</p>
                    <p>&copy; ${new Date().getFullYear()} ${data.clubName}. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        break;

      default:
        throw new Error('Invalid email type');
    }

    const { error } = await resend.emails.send({
      from: Deno.env.get('MAIL_FROM_ADDRESS') || "noreply@resend.dev",
      to: [data.memberEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    if (error) {
      console.error('[send-subscription-email] Error:', error);
      throw error;
    }

    console.log('[send-subscription-email] Email sent successfully to:', data.memberEmail);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-subscription-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
