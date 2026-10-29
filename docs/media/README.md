# Media

Everything behind the demo video and the Devpost page, kept so it can be rebuilt.

| Path | What |
|---|---|
| `../video/overlap-demo.mp4` | The finished video (1:50, 1080p) |
| `../video/overlap-demo-youtube.mp4` | The 9 MB re-encode uploaded to YouTube (https://youtu.be/3R5Q4iu-UtA) |
| `thumbnail.png` | Devpost thumbnail (3:2) |
| `gallery/` | Devpost gallery screenshots of the live site (3:2, 2x) |
| `cards/` | Title and end cards, thumbnail, and the HTML they are rendered from |
| `recordings/` | Raw scripted screen recordings, one per scene, plus `marks.json` (timestamps of key moments) |
| `voiceover/` | Narration per scene (Gemini 3.8 Flash TTS in Google AI Studio, voice "Koda") and `words.json` word timings |
| `captions.ass` | The burned-in captions |
| `scripts/` | The tools below |

## Rebuild

From `scripts/` (Node 22+, Python 3.12, ffmpeg on PATH; Playwright's Chromium 1248 installed):

```bash
npm install                      # playwright-core
node record.mjs [scene ...]      # re-record scenes from https://overlap.u.co.uz into ../recordings
node cards.mjs                   # re-render ../cards
uv run --with faster-whisper python transcribe.py ../voiceover   # word timings for captions
python edit.py                   # cut, retime to the voice, caption -> ../build/overlap-demo.mp4
node gallery.mjs ../gallery      # Devpost screenshots
node shot.mjs ../../img/results.png   # README hero
```

Recordings are 1536x864 pages inside a padded 1920x1080 frame; `edit.py` crops and scales them.
