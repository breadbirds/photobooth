'use client';

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useState } from "react";

type QRModalProps = {
  image: string;
  url: string;
  onClose: () => void;
};

export default function QRModal({ image, url, onClose }: QRModalProps) {
  const [qrImage, setQrImage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 160,
    })
      .then((dataUrl) => {
        if (active) {
          setQrImage(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setError("QR generation failed. Please try again.");
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    const closeTimer = window.setTimeout(onClose, 30000);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearInterval(interval);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="grid w-full max-w-2xl gap-6 rounded-lg bg-white p-5 shadow-2xl sm:grid-cols-2">
        <Image
          src={image}
          alt="Captured photo preview"
          width={640}
          height={360}
          unoptimized
          className="h-full max-h-80 w-full rounded-md bg-zinc-100 object-contain"
        />
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {qrImage ? (
            <Image src={qrImage} alt="Download QR code" width={160} height={160} unoptimized />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-md bg-zinc-100 text-sm text-zinc-500">
              Preparing QR
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-zinc-950">Download by QR</p>
            <p className="mt-1 text-sm text-zinc-600">Time left: {secondsLeft}s</p>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
