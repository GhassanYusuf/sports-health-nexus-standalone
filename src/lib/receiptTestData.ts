import { ReceiptData } from "@/types/receipt";

/**
 * Sample receipt data for testing the receipt template
 * Use this to preview the receipt without needing real database data
 */
export const sampleReceiptData: ReceiptData = {
  club: {
    name: "EMPEROR TAEKWONDO ACADEMY",
    slogan: "Empower Your Strength, Master Your Discipline.",
    logoUrl: "https://bio.innovator.bh/assets/img/2_1757425606.png",
    commercialRegistrationNumber: "123456-01",
    vatRegistrationNumber: "123456789",
    phone: "+973 17123456",
    email: "info@emperortkd.bh",
    website: "www.emperortkd.bh",
    address: "Building 123, Street 456\nBlock 789, Hamad Town",
    currency: "BHD",
    vatPercentage: 5,
  },
  customer: {
    name: "Ali Al-Ammar",
    phone: "973-17123456",
    email: "ali.a@example.com",
    address: "Road 123, Block 456, Manama",
  },
  receiptNumber: "2024-001",
  issueDate: "15-09-2025",
  isPaid: true, // Change to false to see "INVOICE TO" instead of "RECEIPT TO"
  items: [
    {
      itemNo: 1,
      description: "Taekwondo Membership (1 Month)",
      quantity: 1,
      price: 30.0,
      total: 30.0,
    },
    {
      itemNo: 2,
      description: "Private Training Session (1 Hour)",
      quantity: 2,
      price: 25.0,
      total: 50.0,
    },
    {
      itemNo: 3,
      description: "Emperor Taekwondo Uniform (Adult)",
      quantity: 1,
      price: 15.5,
      total: 15.5,
    },
    {
      itemNo: 4,
      description: "Belt Promotion Exam Fee",
      quantity: 1,
      price: 10.0,
      total: 10.0,
    },
    {
      itemNo: 5,
      description: "Sparring Gear Set (Gloves & Pads)",
      quantity: 1,
      price: 40.0,
      total: 40.0,
    },
    {
      itemNo: 6,
      description: "Annual Enrollment Fee",
      quantity: 1,
      price: 20.0,
      total: 20.0,
    },
  ],
  subTotal: 165.5,
  vatAmount: 8.275,
  grandTotal: 173.775,
  // Uncomment to add a late payment note:
  // latePaymentInfo: {
  //   childName: "Ahmed Al-Khalifa",
  //   startDate: "September 10, 2025"
  // }
  // Or add a custom note:
  // notes: "This is a custom note for the receipt."
};

/**
 * Sample invoice data (unpaid)
 */
export const sampleInvoiceData: ReceiptData = {
  ...sampleReceiptData,
  receiptNumber: "INV-2024-002",
  isPaid: false, // This will show "INVOICE TO" instead of "RECEIPT TO"
  notes: "Payment due within 30 days. Please contact us if you have any questions.",
};

/**
 * Sample receipt with late payment info
 */
export const sampleLatePaymentReceipt: ReceiptData = {
  ...sampleReceiptData,
  receiptNumber: "2024-003",
  items: [
    {
      itemNo: 1,
      description: "Monthly Package Fee (Child: Ahmed)",
      quantity: 1,
      price: 45.0,
      total: 45.0,
    },
  ],
  subTotal: 45.0,
  vatAmount: 2.25,
  grandTotal: 47.25,
  latePaymentInfo: {
    childName: "Ahmed Al-Khalifa",
    startDate: "September 10, 2025",
  },
};

/**
 * Sample receipt for a different club - Elite Fitness Center
 */
export const sampleFitnessClubReceipt: ReceiptData = {
  club: {
    name: "ELITE FITNESS & WELLNESS CENTER",
    slogan: "Transform Your Body, Elevate Your Mind.",
    logoUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&h=200&fit=crop",
    commercialRegistrationNumber: "654321-02",
    vatRegistrationNumber: "987654321",
    phone: "+973 17654321",
    email: "info@elitefitness.bh",
    website: "www.elitefitness.bh",
    address: "Seef District, Building 789\nManama, Kingdom of Bahrain",
    currency: "BHD",
    vatPercentage: 10,
  },
  customer: {
    name: "Fatima Al-Mansoor",
    phone: "+973 39876543",
    email: "fatima.m@example.com",
    address: "Juffair, Block 234, Road 567",
  },
  receiptNumber: "EFC-2025-156",
  issueDate: "11-11-2025",
  isPaid: true,
  items: [
    {
      itemNo: 1,
      description: "Premium Membership (3 Months)",
      quantity: 1,
      price: 120.0,
      total: 120.0,
    },
    {
      itemNo: 2,
      description: "Personal Training Sessions (5 Sessions)",
      quantity: 1,
      price: 75.0,
      total: 75.0,
    },
    {
      itemNo: 3,
      description: "Yoga & Pilates Classes Package",
      quantity: 1,
      price: 40.0,
      total: 40.0,
    },
    {
      itemNo: 4,
      description: "Nutrition Consultation",
      quantity: 1,
      price: 25.0,
      total: 25.0,
    },
  ],
  subTotal: 260.0,
  vatAmount: 26.0,
  grandTotal: 286.0,
};

/**
 * Sample receipt for Swimming Academy
 */
export const sampleSwimmingClubReceipt: ReceiptData = {
  club: {
    name: "AQUA CHAMPIONS SWIMMING ACADEMY",
    slogan: "Making Waves, Building Champions.",
    logoUrl: "https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=200&h=200&fit=crop",
    commercialRegistrationNumber: "789012-03",
    vatRegistrationNumber: "456789012",
    phone: "+973 17789012",
    email: "contact@aquachampions.bh",
    website: "www.aquachampions.bh",
    address: "Saar Area, Highway 45\nNext to Saar Mall, Bahrain",
    currency: "BHD",
    vatPercentage: 5,
  },
  customer: {
    name: "Mohammed Al-Khalifa",
    phone: "+973 36123456",
    email: "mohammed.k@example.com",
    address: "Budaiya, Block 789",
  },
  receiptNumber: "ACA-2025-089",
  issueDate: "10-11-2025",
  isPaid: false,
  items: [
    {
      itemNo: 1,
      description: "Junior Swimming Course (Beginner - 8 Weeks)",
      quantity: 1,
      price: 80.0,
      total: 80.0,
    },
    {
      itemNo: 2,
      description: "Swimming Cap & Goggles Kit",
      quantity: 1,
      price: 12.0,
      total: 12.0,
    },
    {
      itemNo: 3,
      description: "Locker Rental (2 Months)",
      quantity: 1,
      price: 8.0,
      total: 8.0,
    },
  ],
  subTotal: 100.0,
  vatAmount: 5.0,
  grandTotal: 105.0,
  notes: "Invoice for swimming lessons starting November 15, 2025. Payment due within 7 days.",
};

/**
 * Function to test receipt generation
 * Copy and paste this into browser console or use in a test component
 */
export function testReceiptGeneration() {
  // This is for testing purposes only
  // Import generateReceiptHtml and use it with sample data
  console.log("Sample Receipt Data:", sampleReceiptData);
  console.log("Sample Invoice Data:", sampleInvoiceData);
  console.log("Sample Late Payment Receipt:", sampleLatePaymentReceipt);
}
