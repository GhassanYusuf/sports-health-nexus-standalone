import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Mail, Eye } from "lucide-react";
import { generateReceiptFromTransaction, downloadReceipt, openReceiptInNewWindow, sendReceiptEmail } from "@/lib/receiptExample";
import { useToast } from "@/hooks/use-toast";

interface ReceiptPreviewProps {
  transactionId: string;
  isPaid?: boolean;
}

/**
 * Receipt Preview Component
 *
 * Provides actions for receipts/invoices:
 * - Preview in dialog
 * - Download as HTML
 * - Send via email (when SMTP configured)
 *
 * Usage:
 * <ReceiptPreview transactionId={transaction.id} isPaid={transaction.payment_status === 'paid'} />
 */
export function ReceiptPreview({ transactionId, isPaid = false }: ReceiptPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const html = await generateReceiptFromTransaction(transactionId);
      if (html) {
        setReceiptHtml(html);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate receipt",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate receipt",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const html = await generateReceiptFromTransaction(transactionId);
      if (html) {
        const filename = isPaid ? `receipt-${transactionId}.html` : `invoice-${transactionId}.html`;
        downloadReceipt(html, filename);
        toast({
          title: "Success",
          description: isPaid ? "Receipt downloaded" : "Invoice downloaded",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to generate receipt",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download receipt",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInNewWindow = async () => {
    setIsLoading(true);
    try {
      const html = await generateReceiptFromTransaction(transactionId);
      if (html) {
        openReceiptInNewWindow(html);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate receipt",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open receipt",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const success = await sendReceiptEmail(transactionId);
      if (success) {
        toast({
          title: "Success",
          description: isPaid ? "Receipt sent successfully" : "Invoice sent successfully",
        });
      } else {
        toast({
          title: "Email not configured",
          description: "SMTP server not configured. Receipt logged to console.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={isLoading}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isPaid ? "Receipt" : "Invoice"} Preview</DialogTitle>
          </DialogHeader>
          {receiptHtml ? (
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={receiptHtml}
                className="w-full h-[70vh]"
                title="Receipt Preview"
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Loading preview...
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleDownload} disabled={isLoading}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button onClick={handleOpenInNewWindow} disabled={isLoading}>
              <Eye className="h-4 w-4 mr-1" />
              Open in New Tab
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading}>
        <Download className="h-4 w-4 mr-1" />
        Download
      </Button>

      <Button variant="default" size="sm" onClick={handleSendEmail} disabled={isSending}>
        <Mail className="h-4 w-4 mr-1" />
        {isSending ? "Sending..." : "Send Email"}
      </Button>
    </div>
  );
}
