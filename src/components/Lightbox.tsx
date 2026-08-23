import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/utils";
import { toast } from "sonner";

interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  isVideo?: boolean;
  title?: string;
  downloadFilename?: string;
}

/**
 * Full-size viewer for a generated image or video. Reuses the same stored asset the grid
 * thumbnail already points at — no separate full-resolution fetch or duplicate storage.
 */
export function Lightbox({ open, onOpenChange, url, isVideo, title, downloadFilename }: LightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] p-2 sm:p-3 bg-background/95 backdrop-blur">
        <DialogTitle className="sr-only">{title ?? "Full size view"}</DialogTitle>
        {url ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-fit max-w-full mx-auto max-h-[80vh] bg-muted rounded-lg overflow-hidden">
              {isVideo ? (
                <video src={url} controls autoPlay loop className="block max-h-[80vh] max-w-full w-auto h-auto" />
              ) : (
                <img src={url} alt={title ?? "Full size"} className="block max-h-[80vh] max-w-full w-auto h-auto object-contain" />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                void downloadFile(url, downloadFilename ?? "tryverse-download").catch(() =>
                  toast.error("Download failed")
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
