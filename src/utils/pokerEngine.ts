import { Card, Rank, Suit } from '../types';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export enum HandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8
}

export interface EvaluationResult {
  score: number;
  handRank: HandRank;
}

/**
 * Evaluates the best 5-card hand from a set of 5 to 7 cards.
 */
export function evaluateHand(cards: Card[]): EvaluationResult {
  const sorted = [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const ranks = sorted.map(c => RANK_VALUE[c.rank]);
  
  const rankCounts: Record<number, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
  
  const suitCounts: Record<string, number> = {};
  sorted.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);

  const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
  const isFlush = !!flushSuit;

  // Straight detection
  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
  let straightHigh = -1;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
      straightHigh = uniqueRanks[i];
      break;
    }
  }
  if (straightHigh === -1 && [14, 5, 4, 3, 2].every(r => uniqueRanks.includes(r))) {
    straightHigh = 5;
  }

  // Straight Flush
  if (isFlush) {
    const flushCards = sorted.filter(c => c.suit === flushSuit);
    const flushRanks = flushCards.map(c => RANK_VALUE[c.rank]);
    const uniqueFlushRanks = Array.from(new Set(flushRanks)).sort((a, b) => b - a);
    
    let sfHigh = -1;
    for (let i = 0; i <= uniqueFlushRanks.length - 5; i++) {
      if (uniqueFlushRanks[i] - uniqueFlushRanks[i + 4] === 4) {
        sfHigh = uniqueFlushRanks[i];
        break;
      }
    }
    if (sfHigh === -1 && [14, 5, 4, 3, 2].every(r => uniqueFlushRanks.includes(r))) {
      sfHigh = 5;
    }
    
    if (sfHigh !== -1) {
      return { handRank: HandRank.STRAIGHT_FLUSH, score: 800000000 + sfHigh };
    }
  }

  const counts = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank: parseInt(rank), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Four of a Kind
  if (counts[0].count === 4) {
    const kicker = ranks.find(r => r !== counts[0].rank) || 0;
    return { handRank: HandRank.FOUR_OF_A_KIND, score: 700000000 + counts[0].rank * 100 + kicker };
  }

  // Full House
  if (counts[0].count === 3 && counts[1].count >= 2) {
    return { handRank: HandRank.FULL_HOUSE, score: 600000000 + counts[0].rank * 100 + counts[1].rank };
  }

  // Flush
  if (isFlush) {
    const flushRanks = sorted.filter(c => c.suit === flushSuit).slice(0, 5).map(c => RANK_VALUE[c.rank]);
    let score = 500000000;
    flushRanks.forEach((r, i) => score += r * Math.pow(15, 4 - i));
    return { handRank: HandRank.FLUSH, score };
  }

  // Straight
  if (straightHigh !== -1) {
    return { handRank: HandRank.STRAIGHT, score: 400000000 + straightHigh };
  }

  // Three of a Kind
  if (counts[0].count === 3) {
    const kickers = ranks.filter(r => r !== counts[0].rank).slice(0, 2);
    return { handRank: HandRank.THREE_OF_A_KIND, score: 300000000 + counts[0].rank * 10000 + kickers[0] * 100 + kickers[1] };
  }

  // Two Pair
  if (counts[0].count === 2 && counts[1].count === 2) {
    const kicker = ranks.find(r => r !== counts[0].rank && r !== counts[1].rank) || 0;
    return { handRank: HandRank.TWO_PAIR, score: 200000000 + counts[0].rank * 10000 + counts[1].rank * 100 + kicker };
  }

  // Pair
  if (counts[0].count === 2) {
    const kickers = ranks.filter(r => r !== counts[0].rank).slice(0, 3);
    return { handRank: HandRank.PAIR, score: 100000000 + counts[0].rank * 1000000 + kickers[0] * 10000 + kickers[1] * 100 + kickers[2] };
  }

  // High Card
  let score = 0;
  ranks.slice(0, 5).forEach((r, i) => score += r * Math.pow(15, 4 - i));
  return { handRank: HandRank.HIGH_CARD, score };
}

/**
 * Calculates winning probabilities.
 * Uses exhaustive enumeration for Flop and Turn, and Monte Carlo for Pre-flop.
 */
export function calculateOdds(playerHands: Card[][], board: Card[]) {
  const deck: Card[] = [];
  const suits: Suit[] = ['h', 'd', 'c', 's'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ rank: r, suit: s });
    }
  }

  const usedCards = new Set([...board, ...playerHands.flat()].map(c => `${c.rank}${c.suit}`));
  const availableDeck = deck.filter(c => !usedCards.has(`${c.rank}${c.suit}`));
  const neededBoard = 5 - board.length;

  const wins = new Array(playerHands.length).fill(0);
  let totalSimulations = 0;

  // If 1 or 2 cards left, use exhaustive enumeration
  if (neededBoard === 1 || neededBoard === 2) {
    const combinations: Card[][] = [];
    
    if (neededBoard === 1) {
      availableDeck.forEach(c => combinations.push([c]));
    } else {
      for (let i = 0; i < availableDeck.length; i++) {
        for (let j = i + 1; j < availableDeck.length; j++) {
          combinations.push([availableDeck[i], availableDeck[j]]);
        }
      }
    }

    totalSimulations = combinations.length;
    combinations.forEach(combo => {
      const simBoard = [...board, ...combo];
      const scores = playerHands.map(hand => evaluateHand([...hand, ...simBoard]).score);
      const maxScore = Math.max(...scores);
      const winners = scores.reduce((acc, score, idx) => score === maxScore ? [...acc, idx] : acc, [] as number[]);
      
      const share = 1 / winners.length;
      winners.forEach(w => wins[w] += share);
    });
  } else if (neededBoard === 0) {
    totalSimulations = 1;
    const scores = playerHands.map(hand => evaluateHand([...hand, ...board]).score);
    const maxScore = Math.max(...scores);
    const winners = scores.reduce((acc, score, idx) => score === maxScore ? [...acc, idx] : acc, [] as number[]);
    const share = 1 / winners.length;
    winners.forEach(w => wins[w] += share);
  } else {
    // Pre-flop or other high-complexity states: Monte Carlo
    totalSimulations = 5000;
    for (let i = 0; i < totalSimulations; i++) {
      const shuffled = [...availableDeck];
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }

      const simBoard = [...board, ...shuffled.slice(0, neededBoard)];
      const scores = playerHands.map(hand => evaluateHand([...hand, ...simBoard]).score);
      const maxScore = Math.max(...scores);
      const winners = scores.reduce((acc, score, idx) => score === maxScore ? [...acc, idx] : acc, [] as number[]);
      
      const share = 1 / winners.length;
      winners.forEach(w => wins[w] += share);
    }
  }

  return wins.map(w => (w / totalSimulations) * 100);
}
