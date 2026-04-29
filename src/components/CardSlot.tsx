import React from 'react';
import { Card, SUIT_SYMBOLS, SUIT_COLORS } from '../types';
import { cn } from '../utils/cn';
import { Plus } from 'lucide-react';

interface CardSlotProps {
  card: Card | null;
  onClick: () => void;
  label?: string;
  className?: string;
}

export const CardSlot: React.FC<CardSlotProps> = ({ card, onClick, label, className }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative aspect-[2/3] w-16 sm:w-20 rounded-xl border-4 flex flex-col items-center justify-center transition-all active:scale-95 overflow-hidden shadow-2xl",
        card 
          ? "bg-white border-white ring-1 ring-black/5" 
          : "bg-zinc-900/40 border-dashed border-zinc-700/50 hover:border-om-red/50 hover:bg-zinc-800/40",
        className
      )}
    >
      {card ? (
        <>
          <div className="absolute top-2 left-2 flex flex-col items-center leading-none">
            <span className={cn("text-lg sm:text-xl font-[900] tracking-tighter", SUIT_COLORS[card.suit])}>{card.rank}</span>
            <span className={cn("text-sm sm:text-base", SUIT_COLORS[card.suit])}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div className={cn("flex flex-col items-center", SUIT_COLORS[card.suit])}>
            <span className="text-5xl sm:text-7xl leading-none drop-shadow-sm">{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div className="absolute bottom-2 right-2 flex flex-col items-center rotate-180 leading-none">
            <span className={cn("text-lg sm:text-xl font-[900] tracking-tighter", SUIT_COLORS[card.suit])}>{card.rank}</span>
            <span className={cn("text-sm sm:text-base", SUIT_COLORS[card.suit])}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center text-zinc-700 group-hover:text-om-red/70 transition-colors">
          <Plus size={24} className="mb-2" />
          {label && <span className="text-xs uppercase font-black tracking-widest">{label}</span>}
        </div>
      )}
    </button>
  );
};
