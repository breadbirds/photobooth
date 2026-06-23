'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Countdown from "./Countdown";

type CameraProps = {
  onCapture: (image: string) => void;
};

type ScreenState = "camera" | "countdown";

type Landmark = {
  x: number;
  y: number;
};

type HandsResults = {
  multiHandLandmarks?: Landmark[][];
};

type HandsInstance = {
  setOptions: (options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (callback: (results: HandsResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

type HandsConstructor = new (options: {
  locateFile: (file: string) => string;
}) => HandsInstance;

type CameraUtilsInstance = {
  start: () => Promise<void>;
  stop?: () => void;
};

type CameraUtilsConstructor = new (
  video: HTMLVideoElement,
  options: { onFrame: () => Promise<void>; width: number; height: number },
) => CameraUtilsInstance;

declare global {
  interface Window {
    Hands?: HandsConstructor;
    Camera?: CameraUtilsConstructor;
  }
}

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const HOLD_MS = 800;
const COUNTDOWN_START = 3;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));

    if (!existing) {
      document.body.appendChild(script);
    }
  });
}

function isPeaceSign(hand: Landmark[]) {
  return Boolean(
    hand[8]?.y < hand[6]?.y &&
      hand[12]?.y < hand[10]?.y &&
      hand[16]?.y > hand[14]?.y &&
      hand[20]?.y > hand[18]?.y,
  );
}

function isFist(hand: Landmark[]) {
  return Boolean(
    hand[8]?.y > hand[6]?.y &&
      hand[12]?.y > hand[10]?.y &&
      hand[16]?.y > hand[14]?.y &&
      hand[20]?.y > hand[18]?.y,
  );
}

export default function Camera({ onCapture }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const hasCapturedRef = useRef(false);
  const captureTriggeredRef = useRef(false);
  const holdStartedAtRef = useRef<number | null>(null);
  const stateRef = useRef<ScreenState>("camera");
  const [screenState, setScreenState] = useState<ScreenState>("camera");
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [message, setMessage] = useState("Detecting hands");
  const [error, setError] = useState("");

  const capture = useCallback(() => {
    if (hasCapturedRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;

    if (!video || !canvas) {
      return;
    }

    canvas.width = video.videoWidth || VIDEO_WIDTH;
    canvas.height = video.videoHeight || VIDEO_HEIGHT;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    hasCapturedRef.current = true;
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  }, [onCapture]);

  const startCountdown = useCallback(() => {
    stateRef.current = "countdown";
    captureTriggeredRef.current = false;
    setScreenState("countdown");
    setCountdown(COUNTDOWN_START);
    setMessage("Get ready");
  }, []);

  const cancelCountdown = useCallback(() => {
    stateRef.current = "camera";
    holdStartedAtRef.current = null;
    setScreenState("camera");
    setCountdown(COUNTDOWN_START);
    setMessage("Countdown canceled");
  }, []);

  useEffect(() => {
    if (screenState !== "countdown") {
      return;
    }

    const interval = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setMessage("Capture complete");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [capture, screenState]);

  useEffect(() => {
    if (screenState !== "countdown" || countdown !== 0 || captureTriggeredRef.current) {
      return;
    }

    captureTriggeredRef.current = true;
    stateRef.current = "camera";
    capture();
  }, [capture, countdown, screenState]);

  useEffect(() => {
    let active = true;
    let hands: HandsInstance | null = null;
    let camera: CameraUtilsInstance | null = null;

    const drawHands = (results: HandsResults) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        return;
      }

      canvas.width = video.videoWidth || VIDEO_WIDTH;
      canvas.height = video.videoHeight || VIDEO_HEIGHT;

      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(255, 255, 255, 0.9)";

      results.multiHandLandmarks?.forEach((hand) => {
        hand.forEach((point) => {
          context.beginPath();
          context.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, Math.PI * 2);
          context.fill();
        });
      });
    };

    const handleResults = (results: HandsResults) => {
      if (!active || hasCapturedRef.current) {
        return;
      }

      const handsList = results.multiHandLandmarks ?? [];
      drawHands(results);

      if (stateRef.current === "countdown") {
        if (handsList.some(isFist)) {
          cancelCountdown();
        }
        return;
      }

      const hasPeaceSign = handsList.some(isPeaceSign);

      if (!hasPeaceSign) {
        holdStartedAtRef.current = null;
        setMessage("Hold a V sign");
        return;
      }

      const now = performance.now();
      holdStartedAtRef.current ??= now;

      if (now - holdStartedAtRef.current >= HOLD_MS) {
        startCountdown();
      } else {
        setMessage("Hold a V sign");
      }
    };

    const setup = async () => {
      try {
        await Promise.all([
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"),
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
        ]);

        if (!active || !window.Hands || !window.Camera || !videoRef.current) {
          return;
        }

        hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
        hands.onResults(handleResults);

        camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && hands) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
        });

        await camera.start();
      } catch {
        if (active) {
          setError("Camera permission is required. Please allow it in browser settings.");
        }
      }
    };

    setup();

    return () => {
      active = false;
      camera?.stop?.();
      hands?.close?.();
    };
  }, [cancelCountdown, startCountdown]);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div className="relative overflow-hidden rounded-lg bg-zinc-950 shadow-xl">
        <video
          ref={videoRef}
          className="aspect-video w-full scale-x-[-1] object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full scale-x-[-1]" />
        {screenState === "countdown" ? <Countdown value={countdown} /> : null}
      </div>
      <canvas ref={captureCanvasRef} className="hidden" />
      <div className="rounded-lg bg-white px-5 py-4 text-center shadow-sm">
        <p className="text-lg font-semibold text-zinc-950">{message}</p>
        {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
