"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BlobCardProps {
  header?: React.ReactNode;
  children?: React.ReactNode;
  headerHeight?: number;
  className?: string;
}

export function BlobCard({
  header,
  children,
  headerHeight = 224,
  className,
}: BlobCardProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <div className="absolute -inset-[1.5px] rounded-[21.5px] overflow-hidden z-0 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 opacity-60 blur-sm" />
      <div className="relative z-10 rounded-[20px] overflow-hidden bg-background">
        <div
          className="relative overflow-hidden rounded-t-[20px] bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-purple-900/50"
          style={{ height: headerHeight }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />
          {header && <div className="relative z-10 p-8 pb-0">{header}</div>}
        </div>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
