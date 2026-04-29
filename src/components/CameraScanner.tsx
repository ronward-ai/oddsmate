import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Card, PlayerHand, Rank, Suit, SUIT_SYMBOLS, SUIT_COLORS } from '../types';
import { Camera, X, RefreshCw, Scan, Zap, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';

interface CameraScannerProps {
  onScan: (board: (Card | null)[], hands: PlayerHand[]) => void;
  onClose: () => void;
  currentHands: PlayerHand[];
  currentBoard: (Card | null)[];
}

interface DetectedHand {
  id: string;
  winProbability: number;
  center: { x: number, y: number } | null;
  cards: (Card | null)[];
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, onClose, currentHands, currentBoard }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [detectedHands, setDetectedHands] = useState<DetectedHand[]>([]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  };

  const performScan = useCallback(async () => {
    if (isScanning) return;
    const base64Image = captureFrame();
    if (!base64Image) return;

    setIsScanning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image
                }
              },
              {
                text: `Analyze this poker table. Identify EVERY visible card.
                1. Find the "community board" cards (usually 3-5 cards grouped together in the center).
                2. Find ALL "player hands" (each hand is a pair of 2 cards). There may be many players (up to 10).
                
                For EVERY card found, you MUST provide:
                - rank (2,3,4,5,6,7,8,9,T,J,Q,K,A)
                - suit (h,d,c,s)
                - box_2d: [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000).
                
                Return a JSON object:
                {
                  "board": [{"rank": "A", "suit": "h", "box_2d": [y1, x1, y2, x2]}, ...],
                  "hands": [
                    {
                      "cards": [
                        {"rank": "K", "suit": "s", "box_2d": [y1, x1, y2, x2]}, 
                        {"rank": "Q", "suit": "s", "box_2d": [y1, x1, y2, x2]}
                      ]
                    }
                  ]
                }
                Be extremely thorough. If there are 5 players, I expect 5 objects in the "hands" array.
                Be precise with the box_2d coordinates as they are used for AR overlays.`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              board: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rank: { type: Type.STRING },
                    suit: { type: Type.STRING },
                    box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                  },
                  required: ["rank", "suit", "box_2d"]
                }
              },
              hands: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cards: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          rank: { type: Type.STRING },
                          suit: { type: Type.STRING },
                          box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                        },
                        required: ["rank", "suit", "box_2d"]
                      }
                    }
                  },
                  required: ["cards"]
                }
              }
            },
            required: ["board", "hands"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      const newBoard: (Card | null)[] = [null, null, null, null, null];
      if (result.board) {
        result.board.forEach((c: any, i: number) => {
          if (i < 5) newBoard[i] = { rank: c.rank as Rank, suit: c.suit as Suit };
        });
      }

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
            // Add new hand if we have space
            const newHand: PlayerHand = {
              id: Math.random().toString(36).substr(2, 9),
              cards,
              winProbability: 0,
              isFolded: false
            };
            newHands.push(newHand);
          }

          const handId = i < newHands.length ? newHands[i].id : null;
          if (handId && count > 0) {
            newDetectedHands.push({
              id: handId,
              winProbability: 0, // Will be updated by useEffect
              center: { x: sumX / (count * 10), y: sumY / (count * 10) },
              cards
            });
          }
        });
      }

      setDetectedHands(newDetectedHands);
      onScan(newBoard, newHands);
    } catch (err) {
      console.error("Scan error:", err);
      setError("Failed to recognize cards. Try again with better lighting.");
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, onScan, currentHands]);

  useEffect(() => {
    setDetectedHands(prev => prev.map(dh => {
      const match = currentHands.find(h => h.id === dh.id);
      return match ? { ...dh, winProbability: match.winProbability } : dh;
    }));
  }, [currentHands]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoScan && isStreaming) {
      interval = setInterval(performScan, 5000);
    }
    return () => clearInterval(interval);
  }, [autoScan, isStreaming, performScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 sm:top-8 left-4 sm:left-8 right-4 sm:right-8 flex justify-center items-start">
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-black/90 backdrop-blur-2xl border-2 sm:border-4 border-om-red px-3 py-2 sm:px-6 sm:py-4 rounded-2xl sm:rounded-[2rem] flex items-center gap-3 sm:gap-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
            >
              <div className="flex flex-col items-center gap-1 border-r sm:border-r-2 border-zinc-800 pr-3 sm:pr-6">
                <LayoutGrid size={16} className="text-om-red sm:w-5 sm:h-5" />
                <span className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Board</span>
              </div>
              <div className="flex gap-1.5 sm:gap-3">
                {currentBoard.map((card, i) => (
                  <div 
                    key={`overlay-board-${i}`}
                    className={cn(
                      "w-8 h-11 sm:w-12 sm:h-16 rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-xs sm:text-base font-black transition-all shadow-inner",
                      card ? "bg-white text-zinc-950" : "bg-zinc-900 border border-zinc-800 sm:border-2"
                    )}
                  >
                    {card && (
                      <div className={cn("flex flex-col items-center leading-none", SUIT_COLORS[card.suit])}>
                        <span className="text-xl sm:text-3xl font-black">{card.rank}</span>
                        <span className="text-xs sm:text-lg">{SUIT_SYMBOLS[card.suit]}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {detectedHands.map((dh) => dh.center && (
              <motion.div
                key={`ar-badge-${dh.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                style={{ 
                  left: `${dh.center.x}%`, 
                  top: `${dh.center.y}%`,
                  transform: 'translate(-50%, -50%)' 
                }}
                className="absolute"
              >
                <div className="flex flex-col items-center">
                  {/* Card Tops */}
                  <div className="flex gap-1 mb-[-4px] z-0">
                    {dh.cards.map((card, i) => (
                      <div 
                        key={`ar-card-${i}`}
                        className={cn(
                          "w-10 h-12 rounded-t-xl border-2 border-om-red border-b-0 flex items-center justify-center transition-all",
                          card ? "bg-white" : "bg-zinc-900"
                        )}
                      >
                        {card && (
                          <div className={cn("flex flex-col items-center leading-none", SUIT_COLORS[card.suit])}>
                            <span className="text-xl font-black">{card.rank}</span>
                            <span className="text-xs">{SUIT_SYMBOLS[card.suit]}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Equity Badge (Bottom Half) */}
                  <div className="bg-black border-4 border-om-red rounded-2xl rounded-t-none px-4 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center min-w-[100px] z-10">
                    <span className={cn(
                      "text-3xl font-[900] tabular-nums tracking-tighter",
                      dh.winProbability > 50 ? "text-emerald-400" : 
                      dh.winProbability > 25 ? "text-om-red" : "text-white"
                    )}>
                      {dh.winProbability.toFixed(0)}%
                    </span>
                  </div>
                  
                  {/* Pointer line */}
                  <div className="w-1 h-8 bg-gradient-to-b from-om-red to-transparent shadow-lg" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-48 border-2 border-dashed border-white/10 rounded-3xl flex items-center justify-center">
              <span className="text-white/10 text-[10px] font-black uppercase tracking-[0.2em]">Center Table</span>
            </div>
          </div>
        </div>

        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
          <button
            onClick={onClose}
            className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <X size={24} />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all",
                autoScan ? "bg-om-red text-white" : "bg-black/50 text-white"
              )}
            >
              <Zap size={16} fill={autoScan ? "currentColor" : "none"} />
              {autoScan ? "AUTO SCAN ON" : "AUTO SCAN OFF"}
            </button>
          </div>
        </div>

        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="text-om-red animate-spin" size={64} />
              <span className="text-white font-black italic text-3xl drop-shadow-[0_0_20px_rgba(255,0,0,0.5)] uppercase tracking-tighter">Analyzing Table...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute bottom-24 left-4 right-4 p-4 bg-red-900/80 backdrop-blur-md border border-red-500 rounded-xl text-white text-sm text-center">
            {error}
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center pointer-events-none">
        <button
          onClick={performScan}
          disabled={isScanning}
          className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/20 flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-50 pointer-events-auto group hover:bg-om-red hover:border-om-red"
        >
          <div className="w-12 h-12 rounded-full border-2 border-white/40 flex items-center justify-center group-hover:border-white">
            <Scan size={24} className="text-white" />
          </div>
        </button>
      </div>
    </div>
  );
};
