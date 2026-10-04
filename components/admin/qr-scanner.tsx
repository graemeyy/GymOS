"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function cameraScanSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

// Scans a member's QR pass with the device camera, using the browser's
// built-in barcode detector (Chrome on Android, Edge, Safari 17+). No camera
// frames leave the device.
export function QrScannerDialog({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setError(null);

    (async () => {
      if (!cameraScanSupported() || !window.BarcodeDetector) {
        setError("This browser can't scan QR codes. Use a USB scanner or type the member's email.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setError("Camera access was blocked. Allow the camera for this site, or use a USB scanner.");
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          const value = codes.find((c) => c.rawValue.startsWith("GYM1."))?.rawValue;
          if (value) {
            onScan(value);
            return;
          }
        } catch {
          // Frame not ready yet; try again.
        }
        timer = setTimeout(tick, 250);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onScan]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Scan a member pass"
      description="Hold the member's phone so the QR code fills the square."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close camera
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="rounded bg-bad-tint px-3 py-2 text-sm font-medium text-bad">
          {error}
        </p>
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded bg-board">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Camera preview" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-8 rounded border-4 border-chalk" />
        </div>
      )}
    </Dialog>
  );
}
