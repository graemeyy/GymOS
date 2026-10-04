// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { QrScannerDialog } from "./qr-scanner";

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
});

describe("R-14 camera after closing the scanner", () => {
  it("stops a camera stream that arrives after the dialog closed", async () => {
    const stop = vi.fn();
    let resolveStream: (s: MediaStream) => void = () => undefined;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => (resolveStream = resolve)));
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    (window as { BarcodeDetector?: unknown }).BarcodeDetector = class {
      detect() {
        return Promise.resolve([]);
      }
    };
    const { rerender } = render(<QrScannerDialog open onClose={() => undefined} onScan={() => undefined} />);
    expect(getUserMedia).toHaveBeenCalled();
    rerender(<QrScannerDialog open={false} onClose={() => undefined} onScan={() => undefined} />);
    await act(async () => resolveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    expect(stop).toHaveBeenCalled();
  });

  it("doesn't restart the camera when the parent passes a new callback (R-53)", async () => {
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => undefined));
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    (window as { BarcodeDetector?: unknown }).BarcodeDetector = class {
      detect() {
        return Promise.resolve([]);
      }
    };
    const { rerender } = render(<QrScannerDialog open onClose={() => undefined} onScan={() => undefined} />);
    rerender(<QrScannerDialog open onClose={() => undefined} onScan={() => undefined} />);
    rerender(<QrScannerDialog open onClose={() => undefined} onScan={() => undefined} />);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
