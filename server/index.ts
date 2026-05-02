import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(distPath));

app.post('/api/analyze', async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: 'imageBase64 is required' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: [
        {
          parts: [
            {
              inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
            },
            {
              text: `You are analyzing a poker table image. Identify every visible playing card with high accuracy.

1. BOARD: Find the community cards (3-5 cards) laid face-up in the center of the table.
2. HANDS: Find all player hole cards (pairs of 2 cards face-up near each player position).

For EVERY card you can see, identify:
- rank: one of 2,3,4,5,6,7,8,9,T,J,Q,K,A
- suit: one of h (hearts), d (diamonds), c (clubs), s (spades)
- box_2d: bounding box [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates

Be thorough — if there are 4 players, return 4 hand objects each with 2 cards.
Only include cards you can clearly identify. Do not guess.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
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
                required: ['rank', 'suit', 'box_2d']
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
                      required: ['rank', 'suit', 'box_2d']
                    }
                  }
                },
                required: ['cards']
              }
            }
          },
          required: ['board', 'hands']
        }
      }
    });

    const raw = response.text || '{}';
    const result = JSON.parse(raw);

    const boardCount = result.board?.length ?? 0;
    const handCount = result.hands?.length ?? 0;
    const cardCount = result.hands?.reduce((n: number, h: any) => n + (h.cards?.length ?? 0), 0) ?? 0;
    console.log(`Scan: board=${boardCount} cards, hands=${handCount} (${cardCount} hole cards)`);

    res.json(result);
  } catch (err: any) {
    console.error('Gemini analyze error:', err?.message ?? err);
    res.status(500).json({ error: 'Card recognition failed' });
  }
});

// SPA fallback — must be last
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`OddsMate server running on port ${PORT}`);
});
