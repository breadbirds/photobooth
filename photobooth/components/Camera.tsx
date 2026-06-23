'use client';

import Image from "next/image";
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
const V_TRIGGER_DELAY_MS = 300;
const COUNTDOWN_START = 3;
const STICKER_RENDER_SIZE = 96;

type Sticker = {
  id: string;
  label: string;
  src: string;
};

type StickerInstance = {
  id: string;
  stickerId: string;
  x: number;
  y: number;
};

const STICKERS: Sticker[] = [
  { id: "flower", label: "Flower", src: "/stickers/flower.svg" },
  { id: "sparkle", label: "Sparkle", src: "/stickers/sparkle.svg" },
  { id: "heart", label: "Heart", src: "/stickers/heart.svg" },
  { id: "bow", label: "Bow", src: "/stickers/bow.svg" },
  { id: "sunglasses", label: "Cool", src: "/stickers/sunglasses.svg" },
];

const stickerImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadStickerImage(src: string) {
  const cached = stickerImageCache.get(src);

  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load sticker image: ${src}`));
    image.src = src;
  });

  stickerImageCache.set(src, promise);
  return promise;
}

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
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const hasCapturedRef = useRef(false);
  const captureTriggeredRef = useRef(false);
  const vTriggerPendingRef = useRef(false);
  const vTriggerTimeoutRef = useRef<number | null>(null);
  const dragCenterOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activeStickerIdRef = useRef<string | null>(null);
  const stateRef = useRef<ScreenState>("camera");
  const [screenState, setScreenState] = useState<ScreenState>("camera");
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [message, setMessage] = useState("Detecting hands");
  const [error, setError] = useState("");
  const [stickers, setStickers] = useState<StickerInstance[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);

  const activeSticker = activeStickerId
    ? stickers.find((sticker) => sticker.id === activeStickerId) ?? null
    : null;

  const addSticker = useCallback((stickerId: string) => {
    const id = crypto.randomUUID();

    setStickers((current) => [
      ...current,
      {
        id,
        stickerId,
        x: 0.76 + Math.min(current.length * 0.03, 0.16),
        y: 0.74 + Math.min(current.length * 0.02, 0.12),
      },
    ]);

    setActiveStickerId(id);
    activeStickerIdRef.current = id;
  }, []);

  const updateStickerPosition = useCallback((clientX: number, clientY: number) => {
    const preview = previewRef.current;
    const activeStickerInstanceId = activeStickerIdRef.current;

    if (!preview || !activeStickerInstanceId) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const halfWidth = STICKER_RENDER_SIZE / 2;
    const halfHeight = STICKER_RENDER_SIZE / 2;

    const nextX = Math.min(
      Math.max(clientX - bounds.left - dragCenterOffsetRef.current.x, halfWidth),
      bounds.width - halfWidth,
    );
    const nextY = Math.min(
      Math.max(clientY - bounds.top - dragCenterOffsetRef.current.y, halfHeight),
      bounds.height - halfHeight,
    );

    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === activeStickerInstanceId
          ? { ...sticker, x: nextX / bounds.width, y: nextY / bounds.height }
          : sticker,
      ),
    );
  }, []);

  const beginStickerDrag = useCallback((clientX: number, clientY: number, pointerId: number, stickerId: string) => {
    const preview = previewRef.current;
    const activeStickerInstance = stickers.find((sticker) => sticker.id === stickerId);

    if (!preview || !activeStickerInstance) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const stickerCenterX = bounds.left + bounds.width * activeStickerInstance.x;
    const stickerCenterY = bounds.top + bounds.height * activeStickerInstance.y;

    setActiveStickerId(stickerId);
    activeStickerIdRef.current = stickerId;
    activePointerIdRef.current = pointerId;
    isDraggingRef.current = true;
    dragCenterOffsetRef.current = {
      x: clientX - stickerCenterX,
      y: clientY - stickerCenterY,
    };
  }, [stickers]);

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
  }, []);

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

    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    const composeStickers = async () => {
      for (const sticker of stickers) {
        const stickerAsset = STICKERS.find((item) => item.id === sticker.stickerId);

        if (!stickerAsset) {
          continue;
        }

        try {
          const image = await loadStickerImage(stickerAsset.src);
          const stickerX = canvas.width * sticker.x;
          const stickerY = canvas.height * sticker.y;
          const stickerSize = Math.round(Math.min(canvas.width, canvas.height) * 0.18);

          context.save();
          context.shadowColor = "rgba(0, 0, 0, 0.25)";
          context.shadowBlur = 20;
          context.drawImage(
            image,
            stickerX - stickerSize / 2,
            stickerY - stickerSize / 2,
            stickerSize,
            stickerSize,
          );
          context.restore();
        } catch {
          continue;
        }
      }

      hasCapturedRef.current = true;
      onCapture(canvas.toDataURL("image/jpeg", 0.85));
    };

    void composeStickers();
  }, [onCapture, stickers]);

  const startCountdown = useCallback(() => {
    if (vTriggerTimeoutRef.current) {
      window.clearTimeout(vTriggerTimeoutRef.current);
      vTriggerTimeoutRef.current = null;
    }

    vTriggerPendingRef.current = false;

    stateRef.current = "countdown";
    captureTriggeredRef.current = false;
    setScreenState("countdown");
    setCountdown(COUNTDOWN_START);
    setMessage("Get ready");
  }, []);

  const cancelCountdown = useCallback(() => {
    if (vTriggerTimeoutRef.current) {
      window.clearTimeout(vTriggerTimeoutRef.current);
      vTriggerTimeoutRef.current = null;
    }

    vTriggerPendingRef.current = false;

    stateRef.current = "camera";
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
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current || activePointerIdRef.current !== event.pointerId) {
        return;
      }

      updateStickerPosition(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) {
        stopDragging();
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) {
        stopDragging();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [stopDragging, updateStickerPosition]);

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
        if (!vTriggerPendingRef.current) {
          setMessage("Show a V sign");
        }
        return;
      }

      if (stateRef.current === "camera") {
        if (!vTriggerPendingRef.current) {
          vTriggerPendingRef.current = true;
          setMessage("V detected");
          vTriggerTimeoutRef.current = window.setTimeout(() => {
            vTriggerTimeoutRef.current = null;
            if (stateRef.current === "camera" && vTriggerPendingRef.current) {
              startCountdown();
            }
          }, V_TRIGGER_DELAY_MS);
        }
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
      if (vTriggerTimeoutRef.current) {
        window.clearTimeout(vTriggerTimeoutRef.current);
        vTriggerTimeoutRef.current = null;
      }
      camera?.stop?.();
      hands?.close?.();
    };
  }, [cancelCountdown, startCountdown]);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div ref={previewRef} className="relative overflow-hidden rounded-lg bg-zinc-950 shadow-xl">
        <video
          ref={videoRef}
          className="aspect-video w-full scale-x-[-1] object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full scale-x-[-1]" />
        {stickers.map((sticker) => {
          const stickerAsset = STICKERS.find((item) => item.id === sticker.stickerId);

          if (!stickerAsset) {
            return null;
          }

          const isActiveSticker = activeSticker?.id === sticker.id;

          return (
            <button
              key={sticker.id}
              type="button"
              aria-label={`Drag ${stickerAsset.label}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                beginStickerDrag(event.clientX, event.clientY, event.pointerId, sticker.id);
              }}
              onPointerUp={() => {
                stopDragging();
              }}
              onPointerCancel={() => {
                stopDragging();
              }}
              onLostPointerCapture={() => {
                stopDragging();
              }}
              style={{
                left: `${sticker.x * 100}%`,
                top: `${sticker.y * 100}%`,
              }}
              className={`absolute flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 bg-white/20 shadow-2xl backdrop-blur-sm touch-none cursor-grab active:cursor-grabbing ${
                isActiveSticker ? "z-30 border-white/95 ring-4 ring-white/35" : "z-20 border-white/80"
              }`}
            >
              <Image
                src={stickerAsset.src}
                alt={stickerAsset.label}
                width={96}
                height={96}
                className="h-full w-full object-contain"
              />
            </button>
          );
        })}
        {screenState === "countdown" ? <Countdown value={countdown} /> : null}
      </div>
      <canvas ref={captureCanvasRef} className="hidden" />
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-zinc-700">Choose a sticker</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          <button
            type="button"
            onClick={() => {
              setActiveStickerId(null);
              activeStickerIdRef.current = null;
            }}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              activeStickerId === null
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span className="text-2xl">×</span>
            None
          </button>
          {STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => addSticker(sticker.id)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
                <Image src={sticker.src} alt={sticker.label} width={64} height={64} className="h-full w-full object-contain" />
              </span>
              Add {sticker.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-white px-5 py-4 text-center shadow-sm">
        <p className="text-lg font-semibold text-zinc-950">{message}</p>
        {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
