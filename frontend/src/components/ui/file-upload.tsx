import * as React from "react";
import { Upload, X, FileIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface FileUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  accept?: string;
  maxSize?: number;
  onUpload?: (file: File) => void;
  isUploading?: boolean;
  progress?: number;
  disabled?: boolean;
}

const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  (
    {
      accept,
      maxSize,
      onUpload,
      isUploading = false,
      progress = 0,
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const isDisabled = disabled || isUploading;

    const validateFile = React.useCallback(
      (file: File): string | null => {
        if (accept) {
          const acceptedTypes = accept.split(",").map((t) => t.trim());
          const isAccepted = acceptedTypes.some((type) => {
            if (type.startsWith(".")) {
              return file.name.toLowerCase().endsWith(type.toLowerCase());
            }
            if (type.endsWith("/*")) {
              return file.type.startsWith(type.replace("/*", "/"));
            }
            return file.type === type;
          });
          if (!isAccepted) {
            return `File type not accepted. Allowed: ${accept}`;
          }
        }
        if (maxSize && file.size > maxSize) {
          return `File is too large. Maximum size: ${formatFileSize(maxSize)}`;
        }
        return null;
      },
      [accept, maxSize]
    );

    const handleFile = React.useCallback(
      (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          setSelectedFile(null);
          setPreviewUrl(null);
          return;
        }

        setError(null);
        setSelectedFile(file);

        // Generate image preview
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
        } else {
          setPreviewUrl(null);
        }

        onUpload?.(file);
      },
      [validateFile, onUpload]
    );

    // Cleanup preview URL on unmount
    React.useEffect(() => {
      return () => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDisabled) setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isDisabled) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    };

    const handleRemove = () => {
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setError(null);
    };

    const handleClick = () => {
      if (!isDisabled) {
        inputRef.current?.click();
      }
    };

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={isDisabled}
        />

        {/* Drop zone */}
        {!selectedFile && (
          <button
            type="button"
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={isDisabled}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-all duration-200",
              "bg-card hover:border-border-hover hover:bg-card-hover",
              isDragOver && "border-primary bg-primary/5",
              isDisabled && "cursor-not-allowed opacity-50",
              error && "border-destructive"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-body-sm font-medium text-foreground">
                Drag & drop or click to upload
              </p>
              {accept && (
                <p className="mt-1 text-caption text-muted-foreground">
                  Accepted: {accept}
                </p>
              )}
              {maxSize && (
                <p className="text-caption text-muted-foreground">
                  Max size: {formatFileSize(maxSize)}
                </p>
              )}
            </div>
          </button>
        )}

        {/* Selected file preview */}
        {selectedFile && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="h-14 w-14 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-body-sm font-medium text-foreground">
                  {selectedFile.name}
                </p>
                <p className="text-caption text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Upload progress */}
            {isUploading && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <p className="mt-1 text-caption text-muted-foreground">
                  Uploading... {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-2 flex items-center gap-1.5 text-caption text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);
FileUpload.displayName = "FileUpload";

export { FileUpload };
export type { FileUploadProps };
