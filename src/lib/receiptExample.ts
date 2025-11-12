/**
 * Example usage of receipt/invoice generation utilities
 *
 * This file demonstrates how to use the receipt generation functions
 * in your application.
 */

import { generateReceiptHtml } from "./generateReceiptHtml";
import { prepareReceiptData, prepareDetailedReceiptData } from "./prepareReceiptData";
import { supabase } from "@/integrations/supabase/client";

/**
 * Example 1: Generate receipt from transaction ID
 */
export async function generateReceiptFromTransaction(transactionId: string): Promise<string | null> {
  try {
    // Fetch transaction
    const { data: transaction, error: txError } = await supabase
      .from("transaction_ledger")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found:", txError);
      return null;
    }

    // Fetch club
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", transaction.club_id)
      .single();

    if (clubError || !club) {
      console.error("Club not found:", clubError);
      return null;
    }

    // Prepare receipt data
    const receiptData = prepareReceiptData(transaction, club);

    // Generate HTML
    const html = generateReceiptHtml(receiptData);

    return html;
  } catch (error) {
    console.error("Error generating receipt:", error);
    return null;
  }
}

/**
 * Example 2: Generate detailed receipt with multiple items
 */
export async function generateDetailedReceipt(
  transactionId: string,
  items: Array<{ description: string; quantity: number; price: number }>
): Promise<string | null> {
  try {
    const { data: transaction, error: txError } = await supabase
      .from("transaction_ledger")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found:", txError);
      return null;
    }

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", transaction.club_id)
      .single();

    if (clubError || !club) {
      console.error("Club not found:", clubError);
      return null;
    }

    // Prepare detailed receipt data
    const receiptData = prepareDetailedReceiptData(transaction, club, items);

    // Generate HTML
    const html = generateReceiptHtml(receiptData);

    return html;
  } catch (error) {
    console.error("Error generating detailed receipt:", error);
    return null;
  }
}

/**
 * Example 3: Send receipt via Edge Function (when SMTP is configured)
 */
export async function sendReceiptEmail(
  transactionId: string,
  recipientEmail?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-receipt-email", {
      body: {
        transactionId,
        recipientEmail, // Optional override
      },
    });

    if (error) {
      console.error("Error sending receipt email:", error);
      return false;
    }

    console.log("Email sent:", data);
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Example 4: Download receipt as HTML file
 */
export function downloadReceipt(html: string, filename: string = "receipt.html"): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Example 5: Open receipt in new window/tab
 */
export function openReceiptInNewWindow(html: string): void {
  const newWindow = window.open("", "_blank");
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
}

/**
 * Example usage in a React component:
 *
 * import { generateReceiptFromTransaction, downloadReceipt } from '@/lib/receiptExample';
 *
 * const handleDownloadReceipt = async (transactionId: string) => {
 *   const html = await generateReceiptFromTransaction(transactionId);
 *   if (html) {
 *     downloadReceipt(html, `receipt-${transactionId}.html`);
 *   }
 * };
 *
 * const handleEmailReceipt = async (transactionId: string) => {
 *   const success = await sendReceiptEmail(transactionId);
 *   if (success) {
 *     toast.success('Receipt sent successfully!');
 *   } else {
 *     toast.error('Failed to send receipt');
 *   }
 * };
 */
