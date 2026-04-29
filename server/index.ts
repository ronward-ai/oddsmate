import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

const app = express();
app.use(express.json({ limit: '10mb' }));
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
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts: [
            {
              inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
            },
            {
              text: `Analyze this poker table. Return all visible playing cards.
Board: community cards grouped in center. Hands: player hole cards in pairs.
For each card: rank (2-9,T,J,Q,K,A), suit (h,d,c,s), box_2d [ymin,xmin,ymax,xmax] normalized 0-1000.`
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

    const result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (err) {
    console.error('Gemini analyze error:', err);
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
