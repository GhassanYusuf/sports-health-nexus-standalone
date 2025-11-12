import { Database } from "@/integrations/supabase/types";
import { ReceiptData, ReceiptItem } from "@/types/receipt";

type Transaction = Database["public"]["Tables"]["transaction_ledger"]["Row"];
type Club = Database["public"]["Tables"]["clubs"]["Row"];

/**
 * Prepares receipt data from transaction and club information
 * @param transaction - Transaction ledger row
 * @param club - Club information
 * @param additionalItems - Optional additional items for the receipt (e.g., products, services)
 * @returns ReceiptData ready to be passed to generateReceiptHtml
 */
export function prepareReceiptData(
  transaction: Transaction,
  club: Club,
  additionalItems?: ReceiptItem[]
): ReceiptData {
  // Determine if paid
  const isPaid = transaction.payment_status === "paid";

  // Format date
  const issueDate = new Date(transaction.transaction_date).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );

  // Prepare items - if no additional items, create one from transaction description
  const items: ReceiptItem[] = additionalItems || [
    {
      itemNo: 1,
      description: transaction.description,
      quantity: 1,
      price: transaction.amount,
      total: transaction.amount,
    },
  ];

  // Calculate totals
  const subTotal = transaction.amount;
  const vatAmount = transaction.vat_amount;
  const grandTotal = transaction.total_amount;

  // Prepare club info
  const clubInfo = {
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
    website: undefined, // Add if you have this field
    address: club.location || undefined,
    currency: club.currency || "BHD",
    vatPercentage: club.vat_percentage || 0,
  };

  // Prepare customer info
  const customerInfo = {
    name: transaction.member_name || "N/A",
    phone: transaction.member_phone || undefined,
    email: transaction.member_email || undefined,
    address: undefined, // Add if you have this field in transaction
  };

  const receiptData: ReceiptData = {
    club: clubInfo,
    customer: customerInfo,
    receiptNumber: transaction.receipt_number || "N/A",
    issueDate,
    isPaid,
    items,
    subTotal,
    vatAmount,
    grandTotal,
    notes: transaction.notes || undefined,
  };

  return receiptData;
}

/**
 * Example: Prepare receipt data with multiple items
 * Use this when you have breakdown of items (e.g., package + products + services)
 */
export function prepareDetailedReceiptData(
  transaction: Transaction,
  club: Club,
  itemsBreakdown: Array<{
    description: string;
    quantity: number;
    price: number;
  }>
): ReceiptData {
  const items: ReceiptItem[] = itemsBreakdown.map((item, index) => ({
    itemNo: index + 1,
    description: item.description,
    quantity: item.quantity,
    price: item.price,
    total: item.quantity * item.price,
  }));

  return prepareReceiptData(transaction, club, items);
}
