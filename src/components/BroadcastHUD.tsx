import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, SUIT_SYMBOLS, SUIT_COLORS } from '../types';
import { cn } from '../utils/cn';

export interface HUDHand {
  id: string;
  cards: (Card | null)[];
  winProbability: number;
  handLabel: string;
}

interface BroadcastHUDProps {
  hands: HUDHand[];
  board: (Card | null)[];
  isVisible: boolean;
}

const MiniCard: React.FC<{ card: Card | null; size?: 'sm' | 'xs' }> = ({ card, size = 'sm' }) => (
  <div className={cn(
    'rounded flex items-center justify-center font-black leading-none flex-shrink-0',
    card ? 'bg-white' : 'bg-zinc-800 border border-zinc-700',
    size === 'sm' ? 'w-7 h-9' : 'w-5 h-7'
  )}>
    {card && (
      <span className={cn('flex flex-col items-center', SUIT_COLORS[card.suit], size === 'sm' ? 'text-[9px]' : 'text-[7px]')}>
        <span className="font-black leading-none">{card.rank}</span>
        <span className="leading-none">{SUIT_SYMBOLS[card.suit]}</span>
      </span>
    )}
  </div>
);

const PlayerRow: React.FC<{ hand: HUDHand; index: number; isLeader: boolean; compact: boolean }> = ({
  hand, index, isLeader, compact
}) => (
  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b border-white/5 last:border-0">
    <div className={cn(
      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0',
      isLeader ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'
    )}>
      {index + 1}
    </div>

    <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
      {hand.cards.map((card, i) => (
        <MiniCard key={i} card={card} size={compact ? 'xs' : 'sm'} />
      ))}
    </div>

    <span className={cn(
      'flex-1 truncate uppercase tracking-wider font-bold min-w-0',
      compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]',
      isLeader ? 'text-emerald-300' : 'text-zinc-400'
    )}>
      {hand.handLabel || '—'}
    </span>

    <span className={cn(
      'font-[900] tabular-nums tracking-tighter flex-shrink-0',
      compact ? 'text-base w-12' : 'text-lg sm:text-xl w-14',
      'text-right',
      isLeader ? 'text-emerald-400' :
      hand.winProbability > 25 ? 'text-amber-400' : 'text-zinc-500'
    )}>
      {hand.winProbability.toFixed(1)}%
    </span>

    <div className="w-16 sm:w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
      <motion.div
        className={cn('h-full rounded-full', isLeader ? 'bg-emerald-500' : 'bg-zinc-600')}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(hand.winProbability, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  </div>
);

export const BroadcastHUD: React.FC<BroadcastHUDProps> = ({ hands, board, isVisible }) => {
  if (!isVisible || hands.length === 0) return null;

  const maxProb = Math.max(...hands.map(h => h.winProbability));
  const isLeader = (hand: HUDHand) => hand.winProbability === maxProb && hand.winProbability > 0;
  const compact = hands.length > 3;

  const boardCards = board.filter((c): c is Card => c !== null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur-md border-t-2 border-om-red/40"
      >
        {/* Brand strip */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-1 border-b border-white/5">
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-om-red">
            Odds<span className="text-zinc-500">Mate</span>
          </span>
          {boardCards.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Board</span>
              <div className="flex gap-0.5">
                {board.map((card, i) => (
                  <MiniCard key={i} card={card} size="xs" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Player rows */}
        <div>
          {hands.map((hand, idx) => (
            <PlayerRow
              key={hand.id}
              hand={hand}
              index={idx}
              isLeader={isLeader(hand)}
              compact={compact}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
