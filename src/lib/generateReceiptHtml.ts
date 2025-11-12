import { ReceiptData } from "@/types/receipt";

/**
 * Generates HTML receipt/invoice template with dynamic data
 * @param data - Receipt data including club, customer, and transaction info
 * @returns HTML string ready to be sent via email
 */
export function generateReceiptHtml(data: ReceiptData): string {
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

  // Generate table rows for items
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

  // Conditional note HTML
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

        :root {
            --primary-color: #C41E3A;
            --primary-white: #FFFFFF;
            --text-color: #333;
            --light-gray: #F2F2F2;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            padding: 10px;
            color: var(--text-color);
        }

        .invoice-container {
            max-width: 148mm;
            width: 100%;
            margin: 0 auto;
            background-color: var(--primary-white);
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            border-radius: 6px;
        }

        .header {
            background-color: var(--primary-color);
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--primary-white);
            margin-bottom: 5px;
        }

        .header-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            flex: 1;
            margin-right: 20px;
        }

        .receipt-title-wrapper {
            display: flex;
            flex-direction: column;
            gap: 5px;
            padding-bottom: 8px;
            border-bottom: 2px solid rgba(255, 255, 255, 0.5);
            width: 100%;
        }

        .receipt-title-wrapper h1 {
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
            margin: 0;
            text-transform: uppercase;
        }

        .receipt-title-wrapper .slogan {
            font-size: 13px;
            font-weight: 600;
            margin: 0;
        }

        .registration-info {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-top: 0;
            width: 100%;
        }

        .reg-row {
            display: flex;
            gap: 10px;
        }

        .white-box {
            background-color: var(--primary-white);
            color: var(--text-color);
            padding: 5px 10px;
            border-radius: 999px;
            font-size: 12px;
            line-height: 1.2;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
        }

        .reg-row .white-box:first-child {
            flex: 7 1 0%;
        }

        .reg-row .white-box:last-child {
            flex: 3 1 0%;
        }

        .header img {
            max-width: 120px;
            height: auto;
        }

        .main-content {
            padding: 10px 20px 30px;
        }

        .invoice-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
            line-height: 1.6;
        }

        .info-details {
            text-align: left;
        }

        @media (min-width: 500px) {
            .invoice-info {
                flex-direction: row;
                justify-content: space-between;
            }
            .info-details {
                text-align: right;
            }
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--primary-color);
            border-radius: 999px;
            color: var(--primary-white);
            font-weight: 700;
            font-size: 14px;
            padding: 5px 15px;
            margin-left: auto;
            width: 220px;
            margin-bottom: 5px;
        }

        .info-row span.white-pill {
            background-color: var(--primary-white);
            border-radius: 999px;
            padding: 3px 10px;
            color: var(--primary-color);
            font-weight: 700;
            text-align: center;
            line-height: 1;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            text-align: left;
        }

        table thead {
            background-color: var(--primary-color);
            color: var(--primary-white);
        }

        table th, table td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
            font-size: 12px;
        }

        table tbody tr:nth-child(even) {
            background-color: var(--light-gray);
        }

        table td:last-child {
            text-align: right;
        }

        table td:nth-child(3),
        table td:nth-child(4) {
            text-align: right;
        }

        .sub-total-table {
            width: 250px;
            float: right;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .sub-total-table td {
            padding: 8px;
            text-align: right;
            font-size: 14px;
        }

        .sub-total-table tr:not(:last-child) {
            background-color: var(--light-gray);
        }

        .sub-total-table .grand-total-row {
            background-color: var(--primary-color) !important;
            color: var(--primary-white);
            font-weight: 700;
        }

        .receipt-note {
            background-color: #fff3cd;
            border-left: 5px solid #ffc107;
            padding: 10px 15px;
            margin-top: 20px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #664d03;
            line-height: 1.4;
        }

        .receipt-note strong {
            color: #333;
        }

        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 15px;
            line-height: 1.4;
            font-size: 12px;
        }

        .contact-info-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
        }

        .contact-info-item .icon {
            font-size: 16px;
            color: var(--primary-color);
            line-height: 1;
        }

        .footer {
            background-color: var(--primary-color);
            padding: 10px 20px;
            text-align: center;
            color: var(--primary-white);
            font-size: 12px;
            font-weight: 600;
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
        }
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
                ${
                  club.commercialRegistrationNumber
                    ? `
                <div class="reg-row">
                    <div class="white-box">COMMERCIAL REGISTRATION #</div>
                    <div class="white-box">${club.commercialRegistrationNumber}</div>
                </div>`
                    : ""
                }
                ${
                  club.vatRegistrationNumber
                    ? `
                <div class="reg-row">
                    <div class="white-box">VAT REGISTRATION #</div>
                    <div class="white-box">${club.vatRegistrationNumber}</div>
                </div>`
                    : ""
                }
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
            <thead>
                <tr>
                    <th>Item No</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        ${noteHtml}

        <table class="sub-total-table">
            <tbody>
                <tr>
                    <td>Sub Total:</td>
                    <td>${subTotal.toFixed(2)} ${club.currency}</td>
                </tr>
                <tr>
                    <td>VAT (${club.vatPercentage}%):</td>
                    <td>${vatAmount.toFixed(2)} ${club.currency}</td>
                </tr>
                <tr class="grand-total-row">
                    <td>Grand Total:</td>
                    <td>${grandTotal.toFixed(2)} ${club.currency}</td>
                </tr>
            </tbody>
        </table>

        <div class="contact-info">
            ${
              club.phone
                ? `
            <div class="contact-info-item">
                <span class="icon">&#9742;</span>
                <div>${club.phone}</div>
            </div>`
                : ""
            }
            ${
              club.email || club.website
                ? `
            <div class="contact-info-item">
                <span class="icon">&#9993;</span>
                <div>
                    ${club.website ? `${club.website}<br>` : ""}
                    ${club.email || ""}
                </div>
            </div>`
                : ""
            }
            ${
              club.address
                ? `
            <div class="contact-info-item">
                <span class="icon">&#9906;</span>
                <div>${club.address.replace(/\n/g, "<br>")}</div>
            </div>`
                : ""
            }
        </div>

    </div>
    <div class="footer">
        © ${new Date().getFullYear()} ${club.name.toUpperCase()}. All Rights Reserved.
    </div>
</div>

</body>
</html>`;
}
