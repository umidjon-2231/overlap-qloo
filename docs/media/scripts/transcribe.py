"""Transcribe the voiceover clips with word timings, to check the reads and plan the edit."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

vo = Path(sys.argv[1])
model = WhisperModel("base.en", device="cpu", compute_type="int8")
out = {}
def pcm(f: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


for f in sorted(vo.glob("s*.wav")):
    segs, _ = model.transcribe(pcm(f), word_timestamps=True)
    words = [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)} for s in segs for w in s.words]
    out[f.stem] = words
    print(f.stem, " ".join(w["w"] for w in words))
(vo / "words.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
