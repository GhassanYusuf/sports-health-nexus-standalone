import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationEmailRequest {
  email: string;
  token: string;
  type: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token, type }: VerificationEmailRequest = await req.json();
    
    console.log(`Sending verification email to: ${email}`);

    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('MAIL_HOST')!,
        port: parseInt(Deno.env.get('MAIL_PORT') || '465'),
        tls: Deno.env.get('MAIL_ENCRYPTION') === 'tls',
        auth: {
          username: Deno.env.get('MAIL_USERNAME')!,
          password: Deno.env.get('MAIL_PASSWORD')!,
        },
      },
    });

    const verificationUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${token}&type=${type}`;

    await client.send({
      from: Deno.env.get('MAIL_FROM_ADDRESS')!,
      to: email,
      subject: "TAKEONE S&H - Verify Your Email",
      content: "auto",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              text-align: center;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🎯 TakeOne</div>
            <h2>Welcome to the TakeOne Family! 🎉</h2>
            <p>Dear Valued Member,</p>
            <p>Thank you for joining TakeOne! We're thrilled to have you as part of our fitness community. Your journey to better health and wellness starts here.</p>
            <p>To get started and access all our amazing features, please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify My Account</a>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              <strong>Important:</strong> You won't be able to sign in until you verify your account.
            </p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-size: 12px; color: #666;">${verificationUrl}</p>
            <div class="footer">
              <p>We're excited to support you on your fitness journey!</p>
              <p>If you didn't create an account with TakeOne, you can safely ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} TakeOne. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    await client.close();

    console.log('Verification email sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Verification email sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
