import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { generateReceiptHtml } from "@/lib/generateReceiptHtml";
import { ReceiptData } from "@/types/receipt";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Receipt Preview Test Page - Using Real Club Data
 *
 * This page fetches actual clubs and transactions from the database
 * Navigate to: /receipt-preview-test
 */
export default function ReceiptPreviewTest() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string>("");
  const [templates, setTemplates] = useState<Record<string, { data: ReceiptData; title: string; description: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadRealClubData();
  }, []);

  const loadRealClubData = async () => {
    setIsLoading(true);
    try {
      // Fetch clubs from database
      const { data: clubs, error: clubsError } = await supabase
        .from("clubs")
        .select("*")
        .limit(5);

      if (clubsError) throw clubsError;

      if (!clubs || clubs.length === 0) {
        toast({
          title: "No clubs found",
          description: "Please create some clubs in your database first",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Fetch some transactions for each club
      const templatesData: Record<string, { data: ReceiptData; title: string; description: string }> = {};

      for (let i = 0; i < clubs.length; i++) {
        const club = clubs[i];

        // Fetch a transaction for this club
        const { data: transactions } = await supabase
          .from("transaction_ledger")
          .select("*")
          .eq("club_id", club.id)
          .is("deleted_at", null)
          .limit(2);

        // Create receipt data for this club
        const isPaid = transactions && transactions.length > 0
          ? transactions[0].payment_status === "paid"
          : i % 2 === 0; // Alternate between paid/unpaid for demo

        const transaction = transactions && transactions.length > 0 ? transactions[0] : null;

        const receiptData: ReceiptData = {
          club: {
            name: club.name,
            slogan: club.slogan || undefined,
            logoUrl: club.logo_url || undefined,
            commercialRegistrationNumber: club.commercial_registration_number || undefined,
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
            name: transaction?.member_name || "Sample Customer",
            phone: transaction?.member_phone || undefined,
            email: transaction?.member_email || undefined,
            address: undefined,
          },
          receiptNumber: transaction?.receipt_number || `${club.receipt_code_prefix || "REC"}-2025-${String(i + 1).padStart(3, "0")}`,
          issueDate: transaction?.transaction_date
            ? new Date(transaction.transaction_date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }),
          isPaid,
          items: transaction
            ? [
                {
                  itemNo: 1,
                  description: transaction.description,
                  quantity: 1,
                  price: transaction.amount,
                  total: transaction.amount,
                },
              ]
            : [
                {
                  itemNo: 1,
                  description: "Sample Package - Monthly Membership",
                  quantity: 1,
                  price: 50.0,
                  total: 50.0,
                },
                {
                  itemNo: 2,
                  description: "Registration Fee",
                  quantity: 1,
                  price: 10.0,
                  total: 10.0,
                },
              ],
          subTotal: transaction?.amount || 60.0,
          vatAmount: transaction?.vat_amount || 3.0,
          grandTotal: transaction?.total_amount || 63.0,
          notes: transaction?.notes || undefined,
        };

        const key = `club-${i}`;
        templatesData[key] = {
          data: receiptData,
          title: `${club.name}`,
          description: `${isPaid ? "Receipt" : "Invoice"} - ${club.currency} ${receiptData.grandTotal.toFixed(2)}`,
        };
      }

      setTemplates(templatesData);

      // Auto-select first template
      const firstKey = Object.keys(templatesData)[0];
      if (firstKey) {
        setSelectedTemplate(firstKey);
        const html = generateReceiptHtml(templatesData[firstKey].data);
        setReceiptHtml(html);
      }

      toast({
        title: "Success",
        description: `Loaded ${clubs.length} clubs from database`,
      });
    } catch (error) {
      console.error("Error loading club data:", error);
      toast({
        title: "Error",
        description: "Failed to load club data from database",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = (key: string) => {
    setSelectedTemplate(key);
    const html = generateReceiptHtml(templates[key].data);
    setReceiptHtml(html);
  };

  const handleDownload = () => {
    if (!receiptHtml) return;

    const blob = new Blob([receiptHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate}-preview.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenNewTab = () => {
    if (!receiptHtml) return;

    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(receiptHtml);
      newWindow.document.close();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Loading Club Data...</h2>
            <p className="text-muted-foreground">Fetching clubs from database</p>
          </div>
        </div>
      </div>
    );
  }

  if (Object.keys(templates).length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">No Clubs Found</h2>
          <p className="text-muted-foreground mb-6">
            Please create some clubs in your database first to preview receipts.
          </p>
          <Button onClick={loadRealClubData}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Receipt/Invoice Preview</h1>
        <p className="text-muted-foreground">
          Preview receipts using real club data from your database
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {Object.entries(templates).map(([key, template]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all ${
              selectedTemplate === key
                ? "ring-2 ring-primary shadow-lg"
                : "hover:shadow-md"
            }`}
            onClick={() => handleGenerate(key)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{template.title}</CardTitle>
              <CardDescription className="line-clamp-2">{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">
                    {template.data.isPaid ? "Receipt" : "Invoice"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{template.data.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">
                    {template.data.grandTotal.toFixed(2)} {template.data.club.currency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {selectedTemplate && templates[selectedTemplate]?.title} - Click a club above to change
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadRealClubData}
              >
                Refresh Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!receiptHtml}
              >
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenNewTab}
                disabled={!receiptHtml}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {receiptHtml ? (
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <iframe
                srcDoc={receiptHtml}
                className="w-full h-[800px]"
                title="Receipt Preview"
                style={{ border: 'none' }}
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-20">
              Select a club above to preview
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTemplate && templates[selectedTemplate] && (
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>Current template configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Club Information</h3>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Name:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.club.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Currency:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.club.currency}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">VAT:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.club.vatPercentage}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">CR Number:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.club.commercialRegistrationNumber || "N/A"}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Transaction Information</h3>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Receipt/Invoice No:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.receiptNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.issueDate}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status:</dt>
                    <dd className="font-medium">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        templates[selectedTemplate].data.isPaid
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {templates[selectedTemplate].data.isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Customer:</dt>
                    <dd className="font-medium">{templates[selectedTemplate].data.customer.name}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Using Real Database Data</h3>
        <p className="text-sm text-blue-800">
          This page is now showing receipts from your actual clubs and transactions in the database.
          The receipts are automatically generated using your club's branding, currency, VAT settings,
          and real transaction data.
        </p>
      </div>
    </div>
  );
}
