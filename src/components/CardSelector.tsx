import React, { useState, useEffect } from 'react';
import { Card, Rank, RANKS, SUITS, SUIT_SYMBOLS, SUIT_COLORS } from '../types';
import { cn } from '../utils/cn';
import { X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CardSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (card: Card | null) => void;
  usedCards: Set<string>;
}

export const CardSelector: React.FC<CardSelectorProps> = ({ isOpen, onClose, onSelect, usedCards }) => {
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRank(null);
    }
  }, [isOpen]);

  const handleRankSelect = (rank: Rank) => {
    setSelectedRank(rank);
  };

  const handleSuitSelect = (suit: Card['suit']) => {
    if (selectedRank) {
      onSelect({ rank: selectedRank, suit });
      setSelectedRank(null);
    }
  };

  const handleClear = () => {
    onSelect(null);
    setSelectedRank(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="relative w-full max-w-md bg-zinc-900 border border-poker-gold/30 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md">
              <div className="flex items-center gap-2">
                {selectedRank && (
                  <button 
                    onClick={() => setSelectedRank(null)}
                    className="p-2 hover:bg-zinc-800 rounded-full text-poker-gold transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <h3 className="text-zinc-100 font-serif italic font-bold">
                  {!selectedRank ? 'Select Rank' : `Select Suit for ${selectedRank}`}
                </h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {!selectedRank ? (
                  <motion.div
                    key="rank-grid"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="grid grid-cols-4 gap-3"
                  >
                    {RANKS.map(rank => {
                      // Check if all suits for this rank are used
                      const allSuitsUsed = SUITS.every(s => usedCards.has(`${rank}${s}`));
                      return (
                        <button
                          key={rank}
                          disabled={allSuitsUsed}
                          onClick={() => handleRankSelect(rank)}
                          className={cn(
                            "aspect-square flex items-center justify-center rounded-xl border-2 text-xl font-black transition-all active:scale-95 shadow-sm",
                            allSuitsUsed
                              ? "bg-zinc-800/50 border-zinc-800 text-zinc-700 opacity-50 cursor-not-allowed"
                              : "bg-zinc-800 border-zinc-700 text-zinc-100 hover:border-poker-gold hover:bg-zinc-800/80 hover:text-poker-gold"
                          )}
                        >
                          {rank}
                        </button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="suit-grid"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {SUITS.map(suit => {
                      const isUsed = usedCards.has(`${selectedRank}${suit}`);
                      return (
                        <button
                          key={suit}
                          disabled={isUsed}
                          onClick={() => handleSuitSelect(suit)}
                          className={cn(
                            "aspect-[4/3] flex flex-col items-center justify-center rounded-2xl border-2 transition-all active:scale-95 shadow-md",
                            isUsed
                              ? "bg-zinc-800/50 border-zinc-800 text-zinc-700 opacity-50 cursor-not-allowed"
                              : cn("bg-zinc-800 border-zinc-700 hover:border-poker-gold", SUIT_COLORS[suit])
                          )}
                        >
                          <span className="text-7xl mb-1 drop-shadow-sm">{SUIT_SYMBOLS[suit]}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                            {suit === 's' ? 'Spades' : suit === 'h' ? 'Hearts' : suit === 'd' ? 'Diamonds' : 'Clubs'}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-8">
                <button
                  onClick={handleClear}
                  className="w-full py-4 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 rounded-2xl font-bold transition-colors border border-zinc-800 flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  CLEAR SLOT
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
