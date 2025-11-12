# Receipt/Invoice Email System Setup

This document explains how to use and configure the receipt/invoice email system for Sports Health Nexus.

## Overview

The system consists of:
1. **TypeScript Types** (`src/types/receipt.ts`) - Data structures for receipts
2. **HTML Template Generator** (`src/lib/generateReceiptHtml.ts`) - Generates dynamic HTML
3. **Data Preparation Utilities** (`src/lib/prepareReceiptData.ts`) - Converts DB data to receipt format
4. **Edge Function** (`supabase/functions/send-receipt-email/`) - Sends emails via SMTP
5. **Usage Examples** (`src/lib/receiptExample.ts`) - Integration examples

## Features

- ✅ Dynamic club information (name, logo, registration numbers)
- ✅ Automatic "RECEIPT TO" (paid) vs "INVOICE TO" (unpaid)
- ✅ Multi-currency support
- ✅ VAT calculation
- ✅ Multiple line items
- ✅ Custom notes and late payment info
- ✅ Responsive HTML design
- ✅ Professional branding with club colors

## Quick Start (Without SMTP)

You can use the receipt generation without SMTP configured:

```typescript
import { generateReceiptFromTransaction, downloadReceipt } from '@/lib/receiptExample';

// Generate and download receipt as HTML file
const handleDownload = async (transactionId: string) => {
  const html = await generateReceiptFromTransaction(transactionId);
  if (html) {
    downloadReceipt(html, 'receipt.html');
  }
};
```

## SMTP Configuration (For Email Sending)

### Step 1: Choose an SMTP Provider

Popular options:
- **SendGrid** - https://sendgrid.com/
- **Mailgun** - https://www.mailgun.com/
- **Amazon SES** - https://aws.amazon.com/ses/
- **Gmail SMTP** - For testing only
- **Custom SMTP Server**

### Step 2: Set Environment Variables

Add these to your Supabase Edge Function secrets:

```bash
# Navigate to your Supabase project
cd sports-health-nexus-main

# Set secrets (replace with your actual values)
supabase secrets set SMTP_HOST=smtp.sendgrid.net
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=apikey
supabase secrets set SMTP_PASSWORD=your_sendgrid_api_key
supabase secrets set SMTP_FROM_EMAIL=noreply@yourclub.com
supabase secrets set SMTP_FROM_NAME="Your Club Name"
```

### Step 3: Update the Edge Function

Open `supabase/functions/send-receipt-email/index.ts` and uncomment the SMTP implementation section.

You'll need to add an SMTP library. For Deno, you can use:

```typescript
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
```

Then uncomment and update the `sendEmail` function to use the SMTP client.

### Step 4: Deploy the Edge Function

```bash
supabase functions deploy send-receipt-email
```

## Usage Examples

### 1. Send Receipt After Payment Approval

```typescript
// In your payment approval handler
import { sendReceiptEmail } from '@/lib/receiptExample';

const handleApprovePayment = async (transactionId: string) => {
  // Approve payment logic...

  // Send receipt email
  const emailSent = await sendReceiptEmail(transactionId);

  if (emailSent) {
    toast.success('Payment approved and receipt sent!');
  }
};
```

### 2. Manual Receipt Sending

```typescript
// Add a "Send Receipt" button to your transaction list
<Button onClick={() => sendReceiptEmail(transaction.id)}>
  Send Receipt
</Button>
```

### 3. Generate Receipt with Custom Items

```typescript
import { generateDetailedReceipt } from '@/lib/receiptExample';

const items = [
  { description: 'Monthly Membership', quantity: 1, price: 50.00 },
  { description: 'Training Uniform', quantity: 2, price: 25.00 },
  { description: 'Equipment Rental', quantity: 1, price: 10.00 },
];

const html = await generateDetailedReceipt(transactionId, items);
```

### 4. Add Late Payment Note

```typescript
import { generateReceiptHtml } from '@/lib/generateReceiptHtml';
import { prepareReceiptData } from '@/lib/prepareReceiptData';

// Fetch transaction and club...
const receiptData = prepareReceiptData(transaction, club);

// Add late payment info
receiptData.latePaymentInfo = {
  childName: 'Ahmed Ali',
  startDate: 'September 15, 2025'
};

const html = generateReceiptHtml(receiptData);
```

## Customization

### Change Brand Colors

Edit `src/lib/generateReceiptHtml.ts` and modify the CSS variables:

```css
:root {
    --primary-color: #C41E3A;  /* Change to your club color */
    --primary-white: #FFFFFF;
    --text-color: #333;
    --light-gray: #F2F2F2;
}
```

### Customize Email Subject

Edit the Edge Function in `supabase/functions/send-receipt-email/index.ts`:

```typescript
const subject = isPaid
  ? `Receipt ${transaction.receipt_number} - ${club.name}`
  : `Invoice ${transaction.receipt_number} - ${club.name}`;
```

### Add Club Website

Update the club data to include website, or modify `prepareReceiptData.ts`:

```typescript
website: 'https://yourclub.com', // Add this
```

## Integration Points

### When to Send Receipts/Invoices

1. **After Payment Approval** - Send receipt
   - Hook: `approve-payment` Edge Function
   - Location: Payment approval dialog

2. **On Transaction Creation** - Send invoice (if unpaid)
   - Hook: `create-transaction` Edge Function
   - Location: After creating enrollment

3. **Manual Send** - Admin can resend
   - Location: Transaction ledger admin panel
   - Button: "Send Receipt/Invoice"

### Example: Auto-send on Payment Approval

Modify `supabase/functions/approve-payment/index.ts`:

```typescript
// After approving payment...
await supabase.functions.invoke('send-receipt-email', {
  body: { transactionId: transaction.id }
});
```

## Testing

### Test Without SMTP (Local)

```typescript
// The Edge Function will log email details without sending
// Check Supabase logs to see the output
const result = await sendReceiptEmail(transactionId);
console.log(result);
```

### Test with SMTP (Development)

Use a service like **Mailtrap** for testing:
- https://mailtrap.io/
- Catches all emails in development
- No emails sent to real users

```bash
supabase secrets set SMTP_HOST=smtp.mailtrap.io
supabase secrets set SMTP_PORT=2525
supabase secrets set SMTP_USER=your_mailtrap_user
supabase secrets set SMTP_PASSWORD=your_mailtrap_password
```

## Troubleshooting

### Email Not Sending

1. Check Edge Function logs:
   ```bash
   supabase functions logs send-receipt-email
   ```

2. Verify SMTP credentials:
   ```bash
   supabase secrets list
   ```

3. Test SMTP connection separately

### HTML Rendering Issues

- Test the HTML by downloading it first
- Open in browser to check rendering
- Some email clients strip CSS - test with major clients (Gmail, Outlook)

### Missing Data

- Ensure club has all required fields (name, currency, VAT %)
- Transaction must have member email for auto-send
- Receipt number must be generated

## Security Notes

- ✅ SMTP credentials stored as Edge Function secrets (encrypted)
- ✅ Email sending requires authentication
- ✅ Receipts only sent to transaction member email
- ✅ HTML is generated server-side (no XSS risk)

## Next Steps

1. ✅ Configure SMTP provider
2. ✅ Set environment variables
3. ✅ Update Edge Function with SMTP library
4. ✅ Deploy Edge Function
5. ✅ Test with Mailtrap
6. ✅ Integrate with payment approval flow
7. ✅ Add manual send buttons to admin panel
8. ✅ Monitor email delivery logs

## Support

For issues or questions:
- Check Supabase Edge Function logs
- Review SMTP provider documentation
- Test HTML generation separately from email sending
- Verify database data completeness
