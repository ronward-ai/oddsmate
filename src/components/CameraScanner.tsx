import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card, PlayerHand, Rank, Suit, SUIT_SYMBOLS, SUIT_COLORS } from '../types';
import { Camera, X, RefreshCw, Scan, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { getHandLabel } from '../utils/pokerEngine';
import { BroadcastHUD, type HUDHand } from './BroadcastHUD';

interface CameraScannerProps {
  onScan: (board: (Card | null)[], hands: PlayerHand[]) => void;
  onClose: () => void;
  currentHands: PlayerHand[];
  currentBoard: (Card | null)[];
}

interface DetectedHand {
  id: string;
  winProbability: number;
  center: { x: number; y: number } | null;
  cards: (Card | null)[];
  handLabel: string;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, onClose, currentHands, currentBoard }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [detectedHands, setDetectedHands] = useState<DetectedHand[]>([]);
  const [hudVisible, setHudVisible] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const maxDim = 1024;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  const performScan = useCallback(async () => {
    if (isScanning) return;
    const base64Image = captureFrame();
    if (!base64Image) return;

    setIsScanning(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image }),
      });
      if (!response.ok) throw new Error('API request failed');
      const result = await response.json();

      const newBoard: (Card | null)[] = [null, null, null, null, null];
      if (result.board) {
        result.board.forEach((c: any, i: number) => {
          if (i < 5) newBoard[i] = { rank: c.rank as Rank, suit: c.suit as Suit };
        });
      }

      const boardCards = newBoard.filter((c): c is Card => c !== null);
      const newDetectedHands: DetectedHand[] = [];
      const newHands: PlayerHand[] = [...currentHands];

      if (result.hands) {
        result.hands.forEach((detectedHand: any, i: number) => {
          const cards: (Card | null)[] = [null, null];
          let sumX = 0;
          let sumY = 0;
          let count = 0;

          detectedHand.cards.forEach((c: any, j: number) => {
            if (j < 2) {
              cards[j] = { rank: c.rank as Rank, suit: c.suit as Suit };
              if (c.box_2d) {
                sumY += (c.box_2d[0] + c.box_2d[2]) / 2;
                sumX += (c.box_2d[1] + c.box_2d[3]) / 2;
                count++;
              }
            }
          });

          if (i < newHands.length) {
            newHands[i] = { ...newHands[i], cards };
          } else if (newHands.length < 10) {
            newHands.push({
              id: Math.random().toString(36).substr(2, 9),
              cards,
              winProbability: 0,
              isFolded: false,
            });
          }

          const handId = i < newHands.length ? newHands[i].id : null;
          const holeCards = cards.filter((c): c is Card => c !== null);
          const handLabel = holeCards.length >= 2
            ? getHandLabel([...holeCards, ...boardCards])
            : '';

          if (handId) {
            newDetectedHands.push({
              id: handId,
              winProbability: 0,
              center: count > 0 ? { x: (sumX / count) / 10, y: (sumY / count) / 10 } : null,
              cards,
              handLabel,
            });
          }
        });
      }

      setDetectedHands(newDetectedHands);
      setHudVisible(true);
      onScan(newBoard, newHands);
      setError(null);
    } catch (err) {
      console.error('Scan error:', err);
      setError('Failed to recognise cards. Try again with better lighting.');
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, onScan, currentHands]);

  // Sync win probabilities back into detectedHands from parent state
  useEffect(() => {
    setDetectedHands(prev => prev.map(dh => {
      const match = currentHands.find(h => h.id === dh.id);
      if (!match) return dh;
      const boardCards = currentBoard.filter((c): c is Card => c !== null);
      const holeCards = dh.cards.filter((c): c is Card => c !== null);
      const handLabel = holeCards.length >= 2
        ? getHandLabel([...holeCards, ...boardCards])
        : dh.handLabel;
      return { ...dh, winProbability: match.winProbability, handLabel };
    }));
  }, [currentHands, currentBoard]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoScan && isStreaming) {
      interval = setInterval(performScan, 3000);
    }
    return () => clearInterval(interval);
  }, [autoScan, isStreaming, performScan]);

  // Build HUDHand array from detectedHands
  const hudHands: HUDHand[] = detectedHands.map(dh => ({
    id: dh.id,
    cards: dh.cards,
    winProbability: dh.winProbability,
    handLabel: dh.handLabel,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* AR badges — secondary layer over detected hand positions */}
        <div className="absolute inset-0 pointer-events-none">
          <AnimatePresence>
            {detectedHands.map(dh => dh.center && (
              <motion.div
                key={`ar-${dh.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                style={{
                  left: `${dh.center.x}%`,
                  top: `${dh.center.y}%`,
                  transform: 'translate(-50%, -100%)',
                }}
                className="absolute"
              >
                <div className="bg-black/80 border-2 border-om-red rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl">
                  <div className="flex gap-0.5">
                    {dh.cards.map((card, i) => (
                      <div key={i} className={cn(
                        'w-6 h-8 rounded flex flex-col items-center justify-center text-[8px] font-black leading-none',
                        card ? 'bg-white' : 'bg-zinc-800 border border-zinc-700'
                      )}>
                        {card && (
                          <span className={cn('flex flex-col items-center', SUIT_COLORS[card.suit])}>
                            <span>{card.rank}</span>
                            <span>{SUIT_SYMBOLS[card.suit]}</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className={cn(
                    'text-lg font-[900] tabular-nums tracking-tighter',
                    dh.winProbability > 50 ? 'text-emerald-400' :
                    dh.winProbability > 25 ? 'text-amber-400' : 'text-zinc-400'
                  )}>
                    {dh.winProbability.toFixed(0)}%
                  </span>
                </div>
                <div className="w-0.5 h-4 bg-gradient-to-b from-om-red to-transparent mx-auto" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 pointer-events-auto">
          <button
            onClick={onClose}
            className="p-3 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-colors"
          >
            <X size={22} />
          </button>
          <button
            onClick={() => setAutoScan(!autoScan)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all backdrop-blur-md',
              autoScan ? 'bg-om-red text-white' : 'bg-black/60 text-white hover:bg-black/80'
            )}
          >
            <Zap size={14} fill={autoScan ? 'currentColor' : 'none'} />
            {autoScan ? 'AUTO ON' : 'AUTO OFF'}
          </button>
        </div>

        {/* Scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="text-om-red animate-spin" size={52} />
              <span className="text-white font-black italic text-2xl drop-shadow-[0_0_20px_rgba(255,0,0,0.6)] uppercase tracking-tighter">
                Scanning...
              </span>
            </div>
          </div>
        )}

        {/* Scan button — floats above the HUD panel */}
        <div
          className="absolute left-0 right-0 flex justify-center items-center pointer-events-auto transition-all duration-300"
          style={{ bottom: hudVisible ? `${Math.min(hands_height(hudHands), 240) + 24}px` : '40px' }}
        >
          <button
            onClick={performScan}
            disabled={isScanning}
            className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/20 flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-40 group hover:bg-om-red hover:border-om-red"
          >
            <div className="w-12 h-12 rounded-full border-2 border-white/40 flex items-center justify-center group-hover:border-white">
              <Scan size={22} className="text-white" />
            </div>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute left-4 right-4 p-3 bg-red-900/80 backdrop-blur-md border border-red-500 rounded-xl text-white text-sm text-center"
            style={{ bottom: hudVisible ? `${Math.min(hands_height(hudHands), 240) + 88}px` : '112px' }}
          >
            {error}
          </div>
        )}

        {/* WSOP Broadcast HUD */}
        <BroadcastHUD
          hands={hudHands}
          board={currentBoard}
          isVisible={hudVisible}
        />
      </div>
    </motion.div>
  );
};

function hands_height(hands: HUDHand[]): number {
  // Approximate HUD panel height in px based on number of hands
  const headerHeight = 28;
  const rowHeight = hands.length > 3 ? 40 : 48;
  return headerHeight + hands.length * rowHeight;
}
