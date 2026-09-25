import { CARD_BACK_SRC } from "@/lib/game/card-assets";

const SIZE_CLASSES = {
  sm: "w-8 h-11 md:w-11 md:h-[60px]",
  md: "w-10 h-14 md:w-12 md:h-16",
  lg: "w-[58px] h-[82px] md:w-20 md:h-[114px]",
} as const;

// Dorso de naipe: sprite real (VerzatileDev, CC0), no dibujado en CSS.
// Compartido por DrawPile (el mazo real) y el vuelo de "robaste una carta"
// (CardFlight).
export default function CardBack({
  size = "md",
  interactive,
  glow,
}: {
  size?: keyof typeof SIZE_CLASSES;
  interactive?: boolean;
  glow?: boolean;
}) {
  return (
    <img
      src={CARD_BACK_SRC}
      alt=""
      draggable={false}
      className={`${SIZE_CLASSES[size]} [image-rendering:pixelated] drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)] ${
        interactive ? "hover:brightness-110" : ""
      } ${glow ? "animate-pulse-glow" : ""}`}
    />
  );
}
