import { useState } from "react";
import { getImageUrl } from "@/lib/image";

interface CheckPhotoThumbnailProps {
  imageUrl: string | null | undefined;
}

export function CheckPhotoThumbnail({ imageUrl }: CheckPhotoThumbnailProps) {
  const [zoomed, setZoomed] = useState(false);

  const resolvedUrl = getImageUrl(imageUrl);
  if (!resolvedUrl) return null;

  return (
    <>
      <img
        src={resolvedUrl}
        alt=""
        className="h-10 w-14 rounded object-cover border border-border cursor-zoom-in shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setZoomed(true);
        }}
      />

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img
            src={resolvedUrl}
            alt=""
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
