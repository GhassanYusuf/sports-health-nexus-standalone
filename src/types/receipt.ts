/**
 * Types for Receipt/Invoice Generation
 */

export interface ReceiptItem {
  itemNo: number;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ClubReceiptInfo {
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
}

export interface CustomerInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ReceiptData {
  club: ClubReceiptInfo;
  customer: CustomerInfo;
  receiptNumber: string;
  issueDate: string;
  isPaid: boolean; // true = "RECEIPT TO", false = "INVOICE TO"
  items: ReceiptItem[];
  subTotal: number;
  vatAmount: number;
  grandTotal: number;
  notes?: string; // Optional notes (e.g., late payment, child registration)
  // Optional late payment info
  latePaymentInfo?: {
    childName: string;
    startDate: string;
  };
}
