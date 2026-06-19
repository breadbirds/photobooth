'use client';

type CountdownProps = {
  value: number;
};

export default function Countdown({ value }: CountdownProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25">
      <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-white bg-black/40 text-7xl font-bold text-white shadow-2xl">
        {value}
      </div>
    </div>
  );
}
