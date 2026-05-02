import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
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
  isLandscape: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
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

const EquityBar: React.FC<{ pct: number; isLeader: boolean }> = ({ pct, isLeader }) => (
  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
    <motion.div
      className={cn('h-full rounded-full', isLeader ? 'bg-emerald-500' : 'bg-zinc-600')}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(pct, 100)}%` }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
  </div>
);

export const LANDSCAPE_HUD_WIDTH = 148; // px — used by CameraScanner to offset scan button

export const BroadcastHUD: React.FC<BroadcastHUDProps> = ({
  hands, board, isVisible, isLandscape, collapsed, onToggleCollapse
}) => {
  if (!isVisible || hands.length === 0) return null;

  const maxProb = Math.max(...hands.map(h => h.winProbability));
  const isLeader = (h: HUDHand) => h.winProbability === maxProb && h.winProbability > 0;
  const boardCards = board.filter((c): c is Card => c !== null);

  /* ── LANDSCAPE: right-side panel ── */
  if (isLandscape) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute right-0 top-0 bottom-0 z-20 flex"
        style={{ width: collapsed ? 28 : LANDSCAPE_HUD_WIDTH }}
      >
        {/* Collapse toggle tab */}
        <button
          onClick={onToggleCollapse}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-6 h-12 bg-black/80 border border-om-red/30 border-r-0 rounded-l-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-10"
        >
          <ChevronRight size={14} className={cn('transition-transform', !collapsed && 'rotate-180')} />
        </button>

        {!collapsed && (
          <div className="flex-1 bg-black/90 backdrop-blur-md border-l-2 border-om-red/40 flex flex-col overflow-hidden">
            {/* Brand */}
            <div className="px-2 py-1 border-b border-white/5 flex-shrink-0">
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-om-red">
                Odds<span className="text-zinc-500">Mate</span>
              </span>
            </div>

            {/* Board */}
            {boardCards.length > 0 && (
              <div className="px-2 py-1.5 border-b border-white/5 flex-shrink-0">
                <div className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-1">Board</div>
                <div className="flex flex-wrap gap-0.5">
                  {board.map((card, i) => <MiniCard key={i} card={card} size="xs" />)}
                </div>
              </div>
            )}

            {/* Player rows */}
            <div className="flex-1 overflow-y-auto">
              {hands.map((hand, idx) => (
                <div key={hand.id} className="px-2 py-1.5 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-1 mb-1">
                    <div className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black flex-shrink-0',
                      isLeader(hand) ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex gap-0.5">
                      {hand.cards.map((card, i) => <MiniCard key={i} card={card} size="xs" />)}
                    </div>
                    <span className={cn(
                      'ml-auto text-sm font-[900] tabular-nums tracking-tighter flex-shrink-0',
                      isLeader(hand) ? 'text-emerald-400' :
                      hand.winProbability > 25 ? 'text-amber-400' : 'text-zinc-500'
                    )}>
                      {hand.winProbability.toFixed(0)}%
                    </span>
                  </div>
                  <EquityBar pct={hand.winProbability} isLeader={isLeader(hand)} />
                  {hand.handLabel && (
                    <div className="text-[7px] text-zinc-500 uppercase tracking-wide truncate mt-0.5">
                      {hand.handLabel}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  /* ── PORTRAIT: bottom bar ── */
  const compact = hands.length > 3;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur-md border-t-2 border-om-red/40"
    >
      {/* Header strip with collapse toggle */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-white/5">
        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-om-red">
          Odds<span className="text-zinc-500">Mate</span>
        </span>
        <div className="flex items-center gap-2">
          {boardCards.length > 0 && !collapsed && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Board</span>
              <div className="flex gap-0.5">
                {board.map((card, i) => <MiniCard key={i} card={card} size="xs" />)}
              </div>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Player rows */}
      {!collapsed && (
        <div>
          {hands.map((hand, idx) => (
            <div key={hand.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 last:border-0">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0',
                isLeader(hand) ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'
              )}>
                {idx + 1}
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                {hand.cards.map((card, i) => (
                  <MiniCard key={i} card={card} size={compact ? 'xs' : 'sm'} />
                ))}
              </div>
              <span className={cn(
                'flex-1 truncate uppercase tracking-wider font-bold min-w-0',
                compact ? 'text-[9px]' : 'text-[10px]',
                isLeader(hand) ? 'text-emerald-300' : 'text-zinc-400'
              )}>
                {hand.handLabel || '—'}
              </span>
              <span className={cn(
                'font-[900] tabular-nums tracking-tighter flex-shrink-0 text-right w-12',
                isLeader(hand) ? 'text-emerald-400' :
                hand.winProbability > 25 ? 'text-amber-400' : 'text-zinc-500'
              )}>
                {hand.winProbability.toFixed(1)}%
              </span>
              <div className="w-16 flex-shrink-0">
                <EquityBar pct={hand.winProbability} isLeader={isLeader(hand)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
