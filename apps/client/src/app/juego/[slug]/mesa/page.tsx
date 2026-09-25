"use client";

import { useParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import CreateRoomForm from "@/components/game/CreateRoomForm";

export default function MesaEntryPage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="relative min-h-screen bg-app flex flex-col">
      <div className="absolute top-4 left-4 z-10">
        <BackButton />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <CreateRoomForm slug={slug} />
      </div>
    </div>
  );
}
