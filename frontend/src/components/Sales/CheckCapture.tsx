import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Image as ImageIcon, RefreshCw, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CheckCaptureProps {
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;
  onCapture: (blob: Blob, previewUrl: string) => void;
  onRemove: () => void;
}

export function CheckCapture({
  imageBlob: _imageBlob,
  imagePreviewUrl,
  onCapture,
  onRemove,
}: CheckCaptureProps) {
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const compressedBlob = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedBlob);
      onCapture(compressedBlob, previewUrl);
    } catch (err) {
      console.error("[CheckCapture] Failed to compress image:", err);
    }
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so same file can be re-selected
    e.target.value = "";
    handleFile(file);
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleFile(file);
  }

  function handleRetake() {
    onRemove();
    // Short delay to let state update before opening camera
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 50);
  }

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
        aria-label={t("capture.takePhoto")}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryChange}
        aria-label={t("capture.chooseFromGallery")}
      />

      {imagePreviewUrl ? (
        /* Preview mode */
        <div className="flex flex-col items-center gap-3">
          {/* Preview image with optional scanning overlay */}
          <div className="relative w-full max-w-xs">
            <img
              src={imagePreviewUrl}
              alt={t("capture.checkPhoto")}
              className="w-full rounded-lg object-cover border border-border"
              style={{ maxHeight: "220px" }}
            />
          </div>

          {/* Action buttons row */}
          <div className="flex w-full max-w-xs gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleRetake}
            >
              <RefreshCw className="h-4 w-4 me-1.5" />
              {t("capture.retake")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={onRemove}
            >
              <X className="h-4 w-4 me-1.5" />
              {t("capture.removePhoto")}
            </Button>
          </div>

        </div>
      ) : (
        /* Capture mode */
        <div className="flex flex-col items-center gap-3">
          <span className="text-body-sm text-muted-foreground">
            {t("capture.checkPhoto")}
          </span>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              className={cn(
                "flex flex-col items-center gap-1.5 h-auto py-4 px-6",
                "border-dashed border-border/60 hover:border-primary/50"
              )}
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-caption text-muted-foreground">
                {t("capture.takePhoto")}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              className={cn(
                "flex flex-col items-center gap-1.5 h-auto py-4 px-6",
                "border-dashed border-border/60 hover:border-primary/50"
              )}
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-caption text-muted-foreground">
                {t("capture.chooseFromGallery")}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
