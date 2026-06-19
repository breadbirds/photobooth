'use client';

import { useCallback, useState } from "react";
import Image from "next/image";
import QRModal from "./QRModal";

type PhotoResultProps = {
  image: string;
  onRetake: () => void;
};

type UploadResponse = {
  url?: unknown;
};

export default function PhotoResult({ image, onRetake }: PhotoResultProps) {
  const [blobUrl, setBlobUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = useCallback(async () => {
    setIsUploading(true);
    setError("");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image }),
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = (await response.json()) as UploadResponse;

      if (typeof data.url !== "string") {
        throw new Error("Invalid upload response");
      }

      setBlobUrl(data.url);
    } catch {
      setError("QR generation failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [image]);

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-5">
      <div className="w-full overflow-hidden rounded-lg bg-zinc-950 shadow-xl">
        <Image
          src={image}
          alt="Captured result"
          width={1280}
          height={720}
          unoptimized
          className="max-h-[70vh] w-full object-contain"
        />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="rounded-md border border-zinc-300 bg-white px-5 py-3 font-semibold text-zinc-900 transition hover:bg-zinc-100"
        >
          Retake
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isUploading}
          className="rounded-md bg-zinc-950 px-5 py-3 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isUploading ? "Uploading" : "QR Download"}
        </button>
      </div>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {blobUrl ? (
        <QRModal image={image} url={blobUrl} onClose={() => setBlobUrl("")} />
      ) : null}
    </div>
  );
}
