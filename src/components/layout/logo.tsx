import Image from "next/image";
import { cn } from "@/lib/utils";

/** Korasa mark: the torn grid-paper sheet (public/logo.png). */
export function KorasaMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      aria-hidden
      width={500}
      height={500}
      priority
      className={cn("size-6 shrink-0 object-contain", className)}
    />
  );
}

export function KorasaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <KorasaMark className="size-8" />
      <span className="font-display text-[22px] leading-none tracking-tight">Korasa</span>
    </span>
  );
}
