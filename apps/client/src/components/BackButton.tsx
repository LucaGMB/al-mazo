"use client";

import { useRouter } from "next/navigation";
import IconButton from "./IconButton";

export default function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return <IconButton icon="chevron-left" onClick={() => router.back()} className={className} />;
}
