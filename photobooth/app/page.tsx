'use client';

import { useState } from "react";
import Camera from "@/components/Camera";
import PhotoResult from "@/components/PhotoResult";

type ViewState = "camera" | "preview";

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("camera");
  const [photo, setPhoto] = useState("");

  const handleCapture = (image: string) => {
    setPhoto(image);
    setViewState("preview");
  };

  const handleRetake = () => {
    setPhoto("");
    setViewState("camera");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-8 text-zinc-950">
      {viewState === "preview" && photo ? (
        <PhotoResult image={photo} onRetake={handleRetake} />
      ) : (
        <Camera onCapture={handleCapture} />
      )}
    </main>
  );
}
