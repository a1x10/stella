"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
  className?: string;
  gridColor?: string;
}

export function AnimatedGridPattern({
  numSquares = 30,
  maxOpacity = 0.1,
  duration = 3,
  repeatDelay = 1,
  className,
  gridColor = "#a855f7",
}: AnimatedGridPatternProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const squares = svg.querySelectorAll<SVGRectElement>(".grid-square");
    squares.forEach((square, i) => {
      const delay = (i / squares.length) * duration;
      square.style.animationDelay = `${delay}s`;
    });
  }, [numSquares, duration]);

  const squares = Array.from({ length: numSquares }, (_, i) => {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = Math.random() * 20 + 10;
    return { x, y, size, id: i };
  });

  return (
    <svg
      ref={svgRef}
      className={cn("absolute inset-0 h-full w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke={gridColor}
            strokeWidth="0.5"
            strokeOpacity="0.3"
          />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid-pattern)" />

      {squares.map((square) => (
        <rect
          key={square.id}
          className="grid-square"
          x={`${square.x}%`}
          y={`${square.y}%`}
          width={square.size}
          height={square.size}
          fill={gridColor}
          opacity="0"
          rx="2"
        >
          <animate
            attributeName="opacity"
            values={`0;${maxOpacity};0`}
            dur={`${duration}s`}
            begin="0s"
            repeatCount="indefinite"
            fill="freeze"
          />
        </rect>
      ))}
    </svg>
  );
}
