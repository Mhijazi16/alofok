import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Download, Upload, CheckCircle } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Progress } from "@/components/ui/progress";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/useToast";
import { adminApi } from "@/services/adminApi";

interface ParsedRow {
  [key: string]: string;
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    if (values.length === headers.length) {
      const row: ParsedRow = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

function downloadTemplate() {
  const header = "name,phone,city,address,assigned_day,assigned_rep";
  const sample =
    '"أحمد","0599000000","رام الله","شارع الإرسال","Sunday","rep1"';
  const blob = new Blob([header + "\n" + sample], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customers_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CustomerImport() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  const importMutation = useMutation({
    mutationFn: (file: File) => adminApi.importCustomers(file),
    onMutate: () => {
      // Simulate progress ticks
      setImportProgress(10);
      const interval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 400);
      return { interval };
    },
    onSuccess: (data, _file, context) => {
      if (context?.interval) clearInterval(context.interval);
      setImportProgress(100);
      toast({
        title: t("admin.importSuccess", { count: data.created }),
        variant: "success",
      });
    },
    onError: (_err, _file, context) => {
      if (context?.interval) clearInterval(context.interval);
      setImportProgress(0);
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setImportProgress(0);
    importMutation.reset();

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const { headers, rows } = parseCSV(text);
        setParsedHeaders(headers);
        setParsedRows(rows);
      }
    };
    reader.readAsText(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const isImporting = importMutation.isPending;
  const isComplete = importMutation.isSuccess;
  const importResult = importMutation.data;
  const importErrors = importResult?.errors ?? [];

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-h2 font-bold text-foreground">
            {t("admin.importCustomers")}
          </h1>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            {t("admin.downloadTemplate")}
          </Button>
        </div>

        {/* File upload */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>{t("actions.upload")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              accept=".csv"
              maxSize={5 * 1024 * 1024}
              onUpload={handleFileSelected}
              disabled={isImporting}
            />
          </CardContent>
        </Card>

        {/* Preview table */}
        {parsedRows.length > 0 && !isComplete && (
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {t("admin.previewData")}
                  <Badge variant="outline" size="sm" className="ms-2">
                    {parsedRows.length}
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsedHeaders.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <TableRow key={idx}>
                      {parsedHeaders.map((h) => (
                        <TableCell key={h}>{row[h]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 10 && (
                <p className="mt-3 text-center text-caption text-muted-foreground">
                  +{parsedRows.length - 10} {t("table.entries")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Import button + progress */}
        {parsedRows.length > 0 && !isComplete && (
          <div className="space-y-4">
            {isImporting && (
              <Progress
                value={importProgress}
                color="primary"
                size="lg"
                label={t("fileUpload.uploading")}
              />
            )}
            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              onClick={handleStartImport}
              isLoading={isImporting}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4" />
              {t("admin.startImport")}
            </Button>
          </div>
        )}

        {/* Results */}
        {isComplete && importResult && (
          <Card variant="glass">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-body-sm font-semibold text-foreground">
                    {t("admin.importSuccess", { count: importResult.created })}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {importResult.created} / {parsedRows.length}
                  </p>
                </div>
              </div>

              <Progress
                value={(importResult.created / Math.max(parsedRows.length, 1)) * 100}
                color="success"
                size="lg"
              />

              {/* Errors list */}
              {importErrors.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-body-sm font-semibold text-destructive">
                    {t("admin.importErrors")} ({importErrors.length})
                  </p>
                  {importErrors.map((err, idx) => (
                    <Alert
                      key={idx}
                      variant="error"
                      description={err}
                      dismissible
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state when no file selected */}
        {!selectedFile && parsedRows.length === 0 && (
          <EmptyState
            preset="no-data"
            title={t("admin.importCustomers")}
            description={t("fileUpload.dragDrop")}
          />
        )}
      </div>
    </PageContainer>
  );
}
