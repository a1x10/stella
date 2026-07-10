"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export interface OrbitalImage {
  src: string;
  alt?: string;
  label?: string;
}

export interface OrbitalImageWheelProps {
  images: OrbitalImage[];
  turns?: number;
  itemWidth?: number;
  itemHeight?: number;
  className?: string;
}

export function OrbitalImageWheel({
  images,
  turns = 3,
  itemWidth = 200,
  itemHeight = 280,
  className,
}: OrbitalImageWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotation, setRotation] = useState(0);

  const radius = 400;

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const newRotation = (scrollY / 10) * turns;
    setRotation(newRotation);
    const idx = Math.floor((newRotation / 360) * images.length) % images.length;
    setActiveIndex(idx);
  }, [images.length, turns]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className={cn("relative w-full h-[600px] overflow-hidden", className)}>
      <div
        ref={wheelRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: "1200px" }}
      >
        {images.map((img, i) => {
          const angle = (i / images.length) * 360 + rotation;
          const rad = (angle * Math.PI) / 180;
          const x = Math.sin(rad) * radius;
          const z = Math.cos(rad) * radius;
          const scale = (z + radius) / (2 * radius);
          const opacity = 0.3 + scale * 0.7;

          return (
            <div
              key={i}
              className={cn(
                "absolute left-1/2 top-1/2 transition-all duration-300 rounded-xl overflow-hidden",
                i === activeIndex && "ring-2 ring-purple-500"
              )}
              style={{
                width: itemWidth,
                height: itemHeight,
                marginLeft: -itemWidth / 2,
                marginTop: -itemHeight / 2,
                transform: `translateX(${x}px) scale(${0.5 + scale * 0.5})`,
                zIndex: Math.round(scale * 100),
                opacity,
              }}
            >
              <img
                src={img.src}
                alt={img.alt || img.label || `Image ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OrbitalImageWheel;
