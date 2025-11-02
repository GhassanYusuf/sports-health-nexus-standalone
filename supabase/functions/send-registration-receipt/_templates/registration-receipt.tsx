import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Section,
  Text,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface ReceiptItem {
  itemNo: number;
  description: string;
  qty: number;
  price: number;
  total: number;
}

interface RegistrationReceiptProps {
  clubName: string;
  clubSlogan?: string;
  commercialRegNumber?: string;
  vatRegNumber?: string;
  logoUrl?: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientAddress?: string;
  receiptNumber: string;
  issueDate: string;
  items: ReceiptItem[];
  subtotal: number;
  vatPercentage: number;
  vatAmount: number;
  grandTotal: number;
  currency: string;
  clubPhone?: string;
  clubEmail?: string;
  clubAddress?: string;
}

export const RegistrationReceiptEmail = ({
  clubName,
  clubSlogan,
  commercialRegNumber,
  vatRegNumber,
  logoUrl,
  recipientName,
  recipientPhone,
  recipientEmail,
  recipientAddress,
  receiptNumber,
  issueDate,
  items,
  subtotal,
  vatPercentage,
  vatAmount,
  grandTotal,
  currency,
  clubPhone,
  clubEmail,
  clubAddress,
}: RegistrationReceiptProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Row>
            <Column style={headerInfo}>
              <Text style={receiptTitle}>{clubName.toUpperCase()}</Text>
              {clubSlogan && <Text style={slogan}>{clubSlogan}</Text>}
              
              {(commercialRegNumber || vatRegNumber) && (
                <Section style={registrationInfo}>
                  {commercialRegNumber && (
                    <Row style={regRow}>
                      <Column style={whiteBox}>COMMERCIAL REGISTRATION #</Column>
                      <Column style={whiteBoxSmall}>{commercialRegNumber}</Column>
                    </Row>
                  )}
                  {vatRegNumber && (
                    <Row style={regRow}>
                      <Column style={whiteBox}>VAT REGISTRATION #</Column>
                      <Column style={whiteBoxSmall}>{vatRegNumber}</Column>
                    </Row>
                  )}
                </Section>
              )}
            </Column>
            {logoUrl && (
              <Column style={logoColumn}>
                <Img src={logoUrl} alt={clubName} style={logo} />
              </Column>
            )}
          </Row>
        </Section>

        {/* Main Content */}
        <Section style={mainContent}>
          {/* Invoice Info */}
          <Row style={invoiceInfo}>
            <Column>
              <Text style={boldText}>RECEIPT TO:</Text>
              <Text style={infoText}>
                <strong>{recipientName}</strong><br/>
                {recipientPhone}<br/>
                {recipientEmail}<br/>
                {recipientAddress}
              </Text>
            </Column>
            <Column style={infoDetails}>
              <Section style={infoRow}>
                <Text style={infoLabel}>RECEIPT NO</Text>
                <Text style={whitePill}>{receiptNumber}</Text>
              </Section>
              <Section style={infoRow}>
                <Text style={infoLabel}>ISSUE DATE</Text>
                <Text style={whitePill}>{issueDate}</Text>
              </Section>
            </Column>
          </Row>

          {/* Items Table */}
          <table style={itemsTable}>
            <thead>
              <tr style={tableHeader}>
                <th style={th}>Item No</th>
                <th style={th}>Description</th>
                <th style={{...th, textAlign: 'right'}}>Qty</th>
                <th style={{...th, textAlign: 'right'}}>Price</th>
                <th style={{...th, textAlign: 'right'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={idx % 2 === 0 ? tableRowEven : tableRow}>
                  <td style={td}>{item.itemNo}</td>
                  <td style={td}>{item.description}</td>
                  <td style={{...td, textAlign: 'right'}}>{item.qty}</td>
                  <td style={{...td, textAlign: 'right'}}>{item.price.toFixed(2)}</td>
                  <td style={{...td, textAlign: 'right'}}>{item.total.toFixed(2)} {currency}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <table style={totalsTable}>
            <tbody>
              <tr style={totalRow}>
                <td style={totalLabel}>Sub Total:</td>
                <td style={totalValue}>{subtotal.toFixed(2)} {currency}</td>
              </tr>
              {vatPercentage > 0 && (
                <tr style={totalRow}>
                  <td style={totalLabel}>VAT ({vatPercentage}%):</td>
                  <td style={totalValue}>{vatAmount.toFixed(2)} {currency}</td>
                </tr>
              )}
              <tr style={grandTotalRow}>
                <td style={grandTotalLabel}>Grand Total:</td>
                <td style={grandTotalValue}>{grandTotal.toFixed(2)} {currency}</td>
              </tr>
            </tbody>
          </table>

          {/* Contact Info */}
          <Section style={contactInfo}>
            {clubPhone && (
              <Text style={contactItem}>
                ☎ {clubPhone}
              </Text>
            )}
            {clubEmail && (
              <Text style={contactItem}>
                ✉ {clubEmail}
              </Text>
            )}
            {clubAddress && (
              <Text style={contactItem}>
                ⌘ {clubAddress}
              </Text>
            )}
          </Section>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>© 2025 {clubName.toUpperCase()}. All Rights Reserved.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

// Styles
const main = {
  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  backgroundColor: '#f0f0f0',
  padding: '10px',
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  overflow: 'hidden',
};

const header = {
  backgroundColor: '#C41E3A',
  padding: '15px 20px',
  color: '#ffffff',
};

const headerInfo = {
  flex: '1',
};

const receiptTitle = {
  fontSize: '20px',
  fontWeight: '700',
  margin: '0 0 5px 0',
  color: '#ffffff',
};

const slogan = {
  fontSize: '13px',
  fontWeight: '600',
  margin: '0 0 8px 0',
  paddingBottom: '8px',
  borderBottom: '2px solid rgba(255, 255, 255, 0.5)',
  color: '#ffffff',
};

const registrationInfo = {
  marginTop: '8px',
};

const regRow = {
  marginBottom: '5px',
};

const whiteBox = {
  backgroundColor: '#ffffff',
  color: '#333',
  padding: '5px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: '600',
  flex: '7',
  textAlign: 'center' as const,
};

const whiteBoxSmall = {
  ...whiteBox,
  flex: '3',
};

const logoColumn = {
  textAlign: 'right' as const,
  verticalAlign: 'middle' as const,
};

const logo = {
  maxWidth: '120px',
  height: 'auto',
};

const mainContent = {
  padding: '10px 20px 30px',
};

const invoiceInfo = {
  marginBottom: '20px',
};

const boldText = {
  fontWeight: '700',
  fontSize: '14px',
};

const infoText = {
  fontSize: '14px',
  lineHeight: '1.6',
};

const infoDetails = {
  textAlign: 'right' as const,
};

const infoRow = {
  backgroundColor: '#C41E3A',
  borderRadius: '999px',
  padding: '5px 15px',
  marginBottom: '5px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const infoLabel = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700',
};

const whitePill = {
  backgroundColor: '#ffffff',
  borderRadius: '999px',
  padding: '3px 10px',
  color: '#C41E3A',
  fontSize: '14px',
  fontWeight: '700',
};

const itemsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginBottom: '20px',
};

const tableHeader = {
  backgroundColor: '#C41E3A',
  color: '#ffffff',
};

const th = {
  padding: '10px',
  textAlign: 'left' as const,
  fontSize: '12px',
  fontWeight: '600',
};

const td = {
  padding: '10px',
  fontSize: '12px',
  borderBottom: '1px solid #ddd',
};

const tableRow = {
  backgroundColor: '#ffffff',
};

const tableRowEven = {
  backgroundColor: '#F2F2F2',
};

const totalsTable = {
  width: '250px',
  float: 'right' as const,
  marginBottom: '30px',
};

const totalRow = {
  backgroundColor: '#F2F2F2',
};

const totalLabel = {
  padding: '8px',
  textAlign: 'right' as const,
  fontSize: '14px',
};

const totalValue = {
  padding: '8px',
  textAlign: 'right' as const,
  fontSize: '14px',
};

const grandTotalRow = {
  backgroundColor: '#C41E3A',
  color: '#ffffff',
};

const grandTotalLabel = {
  ...totalLabel,
  color: '#ffffff',
  fontWeight: '700',
};

const grandTotalValue = {
  ...totalValue,
  color: '#ffffff',
  fontWeight: '700',
};

const contactInfo = {
  marginTop: '20px',
  fontSize: '12px',
  lineHeight: '1.4',
};

const contactItem = {
  marginBottom: '5px',
};

const footer = {
  backgroundColor: '#C41E3A',
  padding: '10px 20px',
  textAlign: 'center' as const,
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: '600',
};

const footerText = {
  margin: '0',
  color: '#ffffff',
};

export default RegistrationReceiptEmail;
