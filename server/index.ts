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
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            {
              inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
            },
            {
              text: `You are a professional poker card recognition system. Carefully examine this poker table image and identify ALL visible playing cards.

TASK 1 — BOARD: Locate the community cards (face-up cards in the center/middle of the table). There may be 0, 3, 4, or 5 board cards.

TASK 2 — HANDS: Locate every player's hole cards (pairs of face-up cards near player seats around the table edge). Count every visible pair.

For each card return:
- rank: exactly one of: 2 3 4 5 6 7 8 9 T J Q K A
- suit: exactly one of: h (hearts ♥) d (diamonds ♦) c (clubs ♣) s (spades ♠)
- box_2d: bounding box [ymin, xmin, ymax, xmax] in 0–1000 normalised coordinates

RULES:
- Identify every card you can see, including partially visible ones
- Use pip count and suit symbol/colour to determine rank and suit
- Red cards = hearts or diamonds; black cards = clubs or spades
- Be confident — commit to your best reading of each card
- If you see 6 players, return 6 hand objects
- Return an empty array for board or hands only if truly none are visible`
            }
          ]
        }
      ],
      config: {
        temperature: 0,
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
                required: ['rank', 'suit']
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
                      required: ['rank', 'suit']
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
    const msg = err?.message ?? String(err);
    const status = err?.status ?? err?.httpStatus ?? '';
    console.error(`Gemini error [${status}]: ${msg}`);
    res.status(500).json({ error: 'Card recognition failed', detail: msg });
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
