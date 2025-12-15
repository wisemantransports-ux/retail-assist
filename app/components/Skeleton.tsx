"use client";

export default function Skeleton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`animate-pulse bg-card-border ${className}`}>{children}</div>
  );
}
