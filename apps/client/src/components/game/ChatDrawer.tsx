"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import IconButton from "@/components/IconButton";
import { useRoom } from "@/lib/room/use-room";
import { decodePlayerName } from "@/lib/room/player-name";

const QUICK_REACTIONS = [
  { icon: "pixelarticons:bullhorn", label: "¡AL MAZO!" },
  { icon: "pixelarticons:trophy", label: "GG" },
  { icon: "pixelarticons:zap", label: "¡Buena!" },
  { icon: "pixelarticons:heart", label: "Bien jugado" },
  { icon: "pixelarticons:alert", label: "¡Cuidado!" },
  { icon: "pixelarticons:reload", label: "Revancha" },
];

export default function ChatDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { chatMessages, sendChatMessage, selfPlayerId } = useRoom();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, chatMessages]);

  if (!isOpen) return null;

  async function handleSend(value: string) {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await sendChatMessage(trimmed);
      setText("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar chat"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <aside className="relative z-10 flex h-full w-full max-w-[360px] flex-col bg-surface border-l border-subtle shadow-xl">
        <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-subtle">
          <div className="flex items-center gap-2 text-ink font-bold text-sm">
            <Icon icon="pixelarticons:message-text" width={18} height={18} />
            Chat de la sala
          </div>
          <IconButton icon="close" size={16} onClick={onClose} aria-label="Cerrar chat" />
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {chatMessages.length === 0 && (
            <div className="text-[12px] text-ink-faint text-center py-6">
              Todavía no hay mensajes.
            </div>
          )}

          {chatMessages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center text-[11px] text-ink-faint py-0.5">
                  {msg.text}
                </div>
              );
            }

            const isOwn = msg.senderId === selfPlayerId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isOwn ? "self-end items-end" : "self-start items-start"}`}
              >
                {!isOwn && (
                  <span className="text-[10px] text-ink-faint px-1 mb-0.5">
                    {decodePlayerName(msg.senderName).display}
                  </span>
                )}
                <div
                  className={`rounded-lg px-3 py-1.5 text-[13px] break-words ${
                    isOwn
                      ? "bg-accent/20 border border-accent/40 text-ink"
                      : "bg-app border border-subtle text-ink"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex-none border-t border-subtle px-3 py-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction.label}
                type="button"
                onClick={() => void handleSend(reaction.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-subtle px-2.5 py-1 text-[11px] text-ink hover:border-accent hover:bg-subtle transition-colors"
              >
                <Icon icon={reaction.icon} width={14} height={14} />
                {reaction.label}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder="Escribí un mensaje..."
              className="flex-1 min-w-0 rounded border border-subtle bg-app px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
            />
            <IconButton
              icon="send"
              size={16}
              type="submit"
              disabled={isSending || text.trim().length === 0}
              aria-label="Enviar mensaje"
            />
          </form>
        </div>
      </aside>
    </div>
  );
}
