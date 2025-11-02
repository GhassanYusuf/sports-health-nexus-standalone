import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Upload, Database, AlertTriangle, CheckCircle2, Info, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DatabaseBackupRestore = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .single();

      if (error || !roleData) {
        toast({
          title: "Access Denied",
          description: "You need Super Admin privileges to access this page.",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

      setIsSuperAdmin(true);
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/admin");
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsLoading(true);
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      setProgress(30);

      const response = await supabase.functions.invoke("database-backup", {
        method: "POST",
      });

      setProgress(70);

      if (response.error) {
        throw new Error(response.error.message || "Failed to create backup");
      }

      // The response.data contains the JSON backup
      const backupJson = JSON.stringify(response.data, null, 2);
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `database-backup-${timestamp}.json`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);

      toast({
        title: "Backup Downloaded",
        description: "Database backup has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Backup error:", error);
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to create database backup.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith(".json")) {
      toast({
        title: "Invalid File",
        description: "Please select a valid .json backup file.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setShowRestoreDialog(true);
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setShowRestoreDialog(false);
    setIsLoading(true);
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      setProgress(30);

      // Read file content and validate JSON
      const text = await selectedFile.text();
      let backupObject: any;
      try {
        backupObject = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid backup JSON file.');
      }

      const response = await supabase.functions.invoke('database-restore', {
        method: 'POST',
        body: { backup: backupObject },
      });

      setProgress(90);

      const result = response.data as any;

      if (response.error || !result?.success) {
        const failed = result?.details?.failedTables || [];
        const msg = result?.message || 'Failed to restore database';
        throw new Error(failed.length ? `${msg}. Failed tables: ${failed.join(', ')}` : msg);
      }

      setProgress(100);

      toast({
        title: 'Restore Complete',
        description: result?.message || 'Database has been restored successfully.',
      });

      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Restore error:", error);
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore database.",
        variant: "destructive",
      });
      setProgress(0);
      setIsLoading(false);
    } finally {
      setSelectedFile(null);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Database Backup & Restore
            </h1>
            <p className="text-muted-foreground">
              Manage your database backups with ease
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/admin")}
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Warning Alert */}
        <Alert className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <AlertTitle className="text-warning">Important</AlertTitle>
          <AlertDescription>
            Database backup and restore operations are powerful tools. Always test backups in a safe environment before using them in production.
          </AlertDescription>
        </Alert>

        {/* Progress Bar */}
        {isLoading && (
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {progress < 50 ? "Preparing..." : progress < 90 ? "Processing..." : "Finalizing..."}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Download Backup Card */}
          <Card className="border-primary/20 hover:shadow-lg transition-all duration-300 hover:border-primary/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Download Backup</CardTitle>
                  <CardDescription>
                    Export a complete database backup
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a full backup of your database as a JSON file (.json).
                This includes all tables and data from the public schema.
              </p>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleDownloadBackup}
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Backup
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Creates and downloads a complete database backup</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="pt-4 border-t">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Best Practices:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Schedule regular backups</li>
                      <li>Store backups securely off-site</li>
                      <li>Test restore process periodically</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Restore Database Card */}
          <Card className="border-wellness/20 hover:shadow-lg transition-all duration-300 hover:border-wellness/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-wellness/10">
                  <Upload className="w-6 h-6 text-wellness" />
                </div>
                <div>
                  <CardTitle className="text-xl">Restore Database</CardTitle>
                  <CardDescription>
                    Upload and restore from a backup
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Restore your database from a previously created backup file.
                This will replace current data with the backup content.
              </p>
              
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Only .json backup files are accepted
                </p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning" />
                  <div>
                    <p className="font-medium mb-1 text-warning">Warning:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>This will replace all current data</li>
                      <li>Cannot be undone once started</li>
                      <li>Create a backup before restoring</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Information Card */}
        <Card className="border-info/20 bg-gradient-to-br from-background to-info/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-info" />
              <CardTitle>Database Management Tips</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <h4 className="font-medium text-sm">Backup Frequency</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create backups before major updates, migrations, or at regular intervals based on data importance.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <h4 className="font-medium text-sm">Secure Storage</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store backups in multiple secure locations, preferably encrypted and off-site from your main system.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <h4 className="font-medium text-sm">Test Restores</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Regularly test your backup files by restoring them in a development environment to ensure they work.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirm Database Restore
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to restore the database from this backup?
              </p>
              <p className="font-medium text-warning">
                This action will replace all current data and cannot be undone.
              </p>
              <p className="text-xs">
                File: {selectedFile?.name}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedFile(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-warning hover:bg-warning/90">
              Restore Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DatabaseBackupRestore;
