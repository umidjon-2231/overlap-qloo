"""Assemble the demo video: title card, seven narrated scenes, end card, burned-in captions.

Each scene takes ranges from its recorded clip, retimes them to fit its voiceover, and lays the
voiceover on top. Captions are timed from the voiceover's word timings.
Usage: python edit.py   (writes docs/media/build/overlap-demo.mp4)
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # docs/media
REC = ROOT / "recordings"
VO = ROOT / "voiceover"
OUT = ROOT / "build"  # intermediate and final renders (gitignored)
OUT.mkdir(exist_ok=True)
FPS = 30
LEAD = 0.35  # voice starts this long after the cut
TAIL = 0.55  # picture holds this long after the voice ends

marks = json.loads((REC / "marks.json").read_text(encoding="utf-8"))
words = json.loads((VO / "words.json").read_text(encoding="utf-8"))


def dur(p: Path) -> float:
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout)


def m(scene: str, label: str) -> float:
    return next(x["t"] for x in marks[scene] if x["label"] == label)


# (scene clip, [(in, out), ...], voice clip, caption lines). Ranges are seconds in the recording.
# None as out means the clip end.
SCENES = [
    ("home", lambda: [(m("home", "start"), m("home", "click") + 0.6)], "s1", [
        "Sponsorship sellers pitch the same few brands for every tour.",
        "Overlap tells you which brands to pitch, in which cities, and why,",
        "straight from Qloo's taste graph.",
    ]),
    ("replay", lambda: [(m("replay", "start") + 0.3, m("replay", "results") + 1.2)], "s2", [
        "Here's Phoebe Bridgers, five cities across the US.",
        "A Claude agent works through Qloo, city by city:",
        "which brands her fans love, how each city ranks them, and where the fans gather.",
        "Every brand and venue it reports is checked against the Qloo call it came from.",
    ]),
    ("results", lambda: [(m("results", "start"), None)], "s3", [
        "The short answer comes first.",
        "Lead with Dr. Martens, the fans' top match.",
        "Then Polaroid, Boxed Water and Airbnb, top three in most of the tour's cities.",
        "And nothing is a black box:",
        "show the data, and you see the exact Qloo request and result behind every number.",
    ]),
    ("compare", lambda: [(m("compare", "start"), None)], "s4", [
        "So why not just ask a chatbot? We did. Same model, no Qloo.",
        "Then Overlap scores its picks in Qloo anyway.",
        "They average a fan fit of 80. Overlap's list averages 87.",
        "Modelo and Amtrak barely register with these fans,",
        "and it misses Polaroid and Boxed Water entirely.",
    ]),
    ("cities", lambda: [(m("cities", "start"), None)], "s5", [
        "Every city gets its own read:",
        "the music, books and places these fans love, where they gather,",
        "and venues nearby, each paired with a brand and an event idea.",
    ]),
    ("pitch", lambda: [(m("pitch", "start"), m("pitch", "writing") + 2.0), (m("pitch", "written") - 0.4, None)], "s6", [
        "Pick a brand, and Overlap writes the pitch:",
        "why this brand, city by city, a measurement plan, and a ready-to-send email.",
        "You edit it and approve it.",
        "Only then can it leave the app, as an email or a branded PDF.",
    ]),
    ("own", lambda: [(m("own", "start"), None)], "s7", [
        "Try your own tour: any artist, any cities, in about a minute.",
        "That's Overlap: sponsors your fans already love.",
    ]),
]


def ass_time(t: float) -> str:
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def captions(voice: str, lines: list[str], offset: float) -> list[tuple[float, float, str]]:
    """Spread caption lines over the voice's words in proportion to their word counts."""
    w = words[voice]
    counts = [len(l.split()) for l in lines]
    total = sum(counts)
    out, cum = [], 0
    for line, n in zip(lines, counts):
        a = w[min(len(w) - 1, round(cum / total * len(w)))]["s"]
        cum += n
        b = w[min(len(w) - 1, round(cum / total * len(w)) - 1)]["e"]
        out.append((offset + a, offset + b + 0.15, line))
    # Never show two lines at once: each caption ends just before the next starts.
    return [(a, min(b, out[i + 1][0] - 0.03) if i + 1 < len(out) else b, text) for i, (a, b, text) in enumerate(out)]


def run(args):
    subprocess.run(args, check=True, capture_output=True)


TITLE, END = 3.2, 4.5
segments, subs, t = [], [], TITLE
for i, (clip, ranges, voice, lines) in enumerate(SCENES):
    src = REC / f"{clip}.webm"
    full = dur(src)
    rs = [(a, b if b is not None else full - 0.3) for a, b in ranges()]
    picture = sum(b - a for a, b in rs)
    target = LEAD + dur(VO / f"{voice}.wav") + TAIL
    factor = target / picture  # setpts multiplier: >1 slows, <1 speeds up
    parts = "".join(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[p{j}];" for j, (a, b) in enumerate(rs))
    cat = "".join(f"[p{j}]" for j in range(len(rs))) + f"concat=n={len(rs)}:v=1:a=0[c];"
    seg = OUT / f"seg{i}.mp4"
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(src), "-i", str(VO / f"{voice}.wav"),
        "-filter_complex",
        # Recordings hold the 1536x864 page in the top-left of a padded 1920x1080 frame.
        parts + cat + f"[c]crop=1536:864:0:0,setpts={factor:.5f}*PTS,fps={FPS},scale=1920:1080:flags=lanczos,format=yuv420p[v];"
        f"[1:a]adelay={int(LEAD * 1000)}|{int(LEAD * 1000)},apad,atrim=0:{target:.3f},aresample=48000,aformat=channel_layouts=stereo[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{target:.3f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-c:a", "aac", "-b:a", "192k", str(seg),
    ])
    print(f"{clip:8s} picture {picture:5.1f}s -> {target:5.1f}s (x{factor:.2f})")
    subs += captions(voice, lines, t + LEAD)
    segments.append(seg)
    t += target

# Title and end cards with silent audio.
for name, length in (("title", TITLE), ("end", END)):
    run([
        "ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(ROOT / "cards" / f"card-{name}.png"),
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", str(length),
        "-vf", f"fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.4" + (",fade=t=out:st=%.2f:d=0.5" % (length - 0.5) if name == "end" else ""),
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-c:a", "aac", "-b:a", "192k", str(OUT / f"{name}.mp4"),
    ])

# Captions (ASS): bottom-centre, paper text on an ink box.
ass = OUT / "captions.ass"
ass.write_text(
    "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n"
    "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
    "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
    # ASS colours are &HAABBGGRR with 00 = opaque; BorderStyle 3 draws the box in OutlineColour.
    "Style: Cap,Segoe UI Semibold,40,&H00F1F3F3,&H00F1F3F3,&H14161211,&H14161211,0,0,0,0,100,100,0,0,3,16,0,2,220,220,48,1\n\n"
    "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    + "".join(f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Cap,,0,0,0,,{text}\n" for a, b, text in subs),
    encoding="utf-8",
)

lst = OUT / "list.txt"
lst.write_text("".join(f"file '{p.name}'\n" for p in [OUT / "title.mp4", *segments, OUT / "end.mp4"]), encoding="utf-8")
run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(OUT / "joined.mp4")])
# Burn captions; ffmpeg's subtitles filter wants a path relative to the working directory on Windows.
subprocess.run([
    "ffmpeg", "-y", "-v", "error", "-i", "joined.mp4", "-vf", "subtitles=captions.ass",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    "overlap-demo.mp4",
], cwd=OUT, check=True, capture_output=True)
print(f"total {dur(OUT / 'overlap-demo.mp4'):.1f}s -> {OUT / 'overlap-demo.mp4'}")
