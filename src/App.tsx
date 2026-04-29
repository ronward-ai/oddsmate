import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, PlayerHand } from './types';
import { CardSlot } from './components/CardSlot';
import { CardSelector } from './components/CardSelector';
import { CameraScanner } from './components/CameraScanner';
import { calculateOdds } from './utils/pokerEngine';
import { cn } from './utils/cn';
import { Plus, Trash2, RotateCcw, Info, Users, LayoutGrid, Camera, Tv, Heart, Spade, Diamond, Club, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const OddsMateLogo = () => (
  <div className="flex items-center gap-3">
    <div className="w-1.5 h-10 bg-om-red rounded-full" />
    <div className="flex flex-col">
      <h1 className="text-2xl font-[1000] italic tracking-tighter leading-none text-white uppercase">
        Odds<span className="text-om-red">Mate</span>
      </h1>
      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mt-1">
        Pro Equity Engine
      </span>
    </div>
  </div>
);

export default function App() {
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [hands, setHands] = useState<PlayerHand[]>([
    { id: '1', cards: [null, null], winProbability: 0, isFolded: false },
    { id: '2', cards: [null, null], winProbability: 0, isFolded: false },
  ]);
  
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ type: 'board' | 'hand', index: number, handId?: string } | null>(null);

  const boardKey = useMemo(() => board.map(c => c ? `${c.rank}${c.suit}` : 'null').join(','), [board]);
  const handsKey = useMemo(() => hands.map(h => h.cards.map(c => c ? `${c.rank}${c.suit}` : 'null').join(',')).join('|'), [hands]);

  const usedCards = useMemo(() => {
    const set = new Set<string>();
    board.forEach(c => c && set.add(`${c.rank}${c.suit}`));
    hands.forEach(h => h.cards.forEach(c => c && set.add(`${c.rank}${c.suit}`)));
    return set;
  }, [boardKey, handsKey]);

  const updateOdds = useCallback(() => {
    const validHands = hands.filter(h => h.cards.every(c => c !== null));
    if (validHands.length < 2) {
      setHands(prev => prev.map(h => ({ ...h, winProbability: 0 })));
      return;
    }

    const boardCards = board.filter((c): c is Card => c !== null);
    const handCards = validHands.map(h => h.cards as Card[]);
    
    // Use the improved engine which handles iterations internally
    const results = calculateOdds(handCards, boardCards);
    
    setHands(prev => {
      let resultIdx = 0;
      return prev.map(h => {
        if (h.cards.every(c => c !== null)) {
          return { ...h, winProbability: results[resultIdx++] };
        }
        return { ...h, winProbability: 0 };
      });
    });
  }, [boardKey, handsKey]);

  useEffect(() => {
    // Small delay to ensure UI feels responsive during card selection
    const timer = setTimeout(updateOdds, 50);
    return () => clearTimeout(timer);
  }, [boardKey, handsKey]);

  const handleSlotClick = (type: 'board' | 'hand', index: number, handId?: string) => {
    setActiveSlot({ type, index, handId });
    setSelectorOpen(true);
  };

  const handleCardSelect = (card: Card | null) => {
    if (!activeSlot) return;

    if (activeSlot.type === 'board') {
      const newBoard = [...board];
      newBoard[activeSlot.index] = card;
      setBoard(newBoard);
    } else if (activeSlot.type === 'hand' && activeSlot.handId) {
      setHands(prev => prev.map(h => {
        if (h.id === activeSlot.handId) {
          const newCards = [...h.cards];
          newCards[activeSlot.index] = card;
          return { ...h, cards: newCards };
        }
        return h;
      }));
    }

    setSelectorOpen(false);
    setActiveSlot(null);
  };

  const addHand = () => {
    if (hands.length >= 10) return;
    setHands(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), cards: [null, null], winProbability: 0, isFolded: false }
    ]);
  };

  const removeHand = (id: string) => {
    if (hands.length <= 2) return;
    setHands(prev => prev.filter(h => h.id !== id));
  };

  const reset = () => {
    setBoard([null, null, null, null, null]);
    setHands(prev => prev.map(h => ({ ...h, cards: [null, null], winProbability: 0 })));
  };

  const handleCameraScan = (newBoard: (Card | null)[], newHands: PlayerHand[]) => {
    setBoard(newBoard);
    setHands(newHands);
  };

  return (
    <div className={cn(
      "min-h-screen bg-zinc-950",
      "text-zinc-100 font-sans selection:bg-om-red/30"
    )}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/60 backdrop-blur-xl border-b-4 border-om-red px-6 py-4 flex items-center justify-between">
        <OddsMateLogo />
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCameraOpen(true)}
            className="p-3 bg-zinc-900 border-2 border-zinc-800 rounded-xl text-zinc-400 hover:text-om-red hover:border-om-red transition-all active:scale-95 shadow-lg"
            title="Open Camera Scanner"
          >
            <Camera size={24} />
          </button>
          <button 
            onClick={reset}
            className="p-3 bg-zinc-900 border-2 border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-95 shadow-lg"
            title="Reset All"
          >
            <RotateCcw size={24} />
          </button>
        </div>
      </header>

      <main className={cn(
        "max-w-4xl mx-auto p-6 pb-32 space-y-12 transition-all duration-500"
      )}>
        {/* Board Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className={cn(
              "text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3 text-zinc-500"
            )}>
              <div className="w-2 h-2 bg-om-red rounded-full" />
              Community Board
            </h2>
          </div>
          
          <div className={cn(
            "felt-texture border-[6px] p-8 rounded-[3rem] flex justify-center gap-4 sm:gap-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-700 border-zinc-800"
          )}>
            <div className="absolute inset-0 border border-white/5 rounded-[42px] pointer-events-none" />
            {board.map((card, i) => (
              <CardSlot
                key={`board-${i}`}
                card={card}
                onClick={() => handleSlotClick('board', i)}
                className={cn(
                  "flex-1 aspect-[2/3] max-w-[120px]"
                )}
              />
            ))}
          </div>
        </section>

        {/* Hands Section */}
        <section className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className={cn(
              "text-sm font-black uppercase tracking-[0.3em] flex items-center gap-3 text-zinc-500"
            )}>
              <div className="w-2 h-2 bg-om-red rounded-full" />
              Player Hands
            </h2>
            <button
              onClick={addHand}
              disabled={hands.length >= 10}
              className="px-6 py-3 bg-zinc-900 border-2 border-zinc-800 rounded-2xl text-xs font-black text-zinc-400 hover:text-om-red hover:border-om-red transition-all flex items-center gap-2 shadow-xl"
            >
              <Plus size={16} />
              ADD PLAYER
            </button>
          </div>

          <div className={cn(
            "grid gap-4 sm:gap-8",
            hands.length === 2 ? "grid-cols-2" : "grid-cols-1"
          )}>
            <AnimatePresence mode="popLayout">
              {hands.map((hand, idx) => (
                <motion.div
                  key={hand.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "group relative rounded-[2.5rem] flex flex-col gap-6 transition-all duration-500 border-4 bg-zinc-900/40 backdrop-blur-md border-zinc-800 hover:border-zinc-700 shadow-2xl",
                    hands.length === 2 ? "p-4 sm:p-8" : "p-8"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-2xl border-2 font-black text-xl shadow-lg bg-zinc-800 text-zinc-400 border-zinc-700"
                      )}>
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Position</span>
                        <span className="text-lg font-black text-white">Player {idx + 1}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Equity</span>
                      <div className={cn(
                        "text-4xl font-[900] tabular-nums tracking-tighter transition-colors",
                        hand.winProbability > 50 ? "text-emerald-400" : 
                        hand.winProbability > 25 ? "text-om-red" : "text-zinc-500"
                      )}>
                        {hand.winProbability.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {hand.cards.map((card, i) => (
                      <CardSlot
                        key={`${hand.id}-${i}`}
                        card={card}
                        onClick={() => handleSlotClick('hand', i, hand.id)}
                        className={cn(
                          "flex-1 aspect-[2/3]"
                        )}
                      />
                    ))}
                  </div>

                  {hands.length > 2 && (
                    <button
                      onClick={() => removeHand(hand.id)}
                      className="absolute -right-3 -top-3 w-12 h-12 bg-zinc-900 border-4 border-om-red rounded-full text-white hover:bg-om-red transition-all flex items-center justify-center shadow-2xl z-10"
                      title="Remove Player"
                    >
                      <X size={24} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <CardSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleCardSelect}
        usedCards={usedCards}
      />

      <AnimatePresence>
        {cameraOpen && (
          <CameraScanner
            onClose={() => setCameraOpen(false)}
            onScan={handleCameraScan}
            currentHands={hands}
            currentBoard={board}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
