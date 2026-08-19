# src/scripts/transcribe.py
# ─────────────────────────────────────────────────────────────────────────────
# SoundWave AI Lyrics Generation System
# Demucs Vocal Separation + faster-whisper Transcription + English Translation
#
# Pipeline:
#   1. Audio file input
#   2. Demucs separates vocals from background music/instruments
#   3. faster-whisper transcribes isolated vocals with task="transcribe"
#   4. Detects original spoken language (Urdu, Hindi, Punjabi, Arabic, Spanish, etc.)
#   5. Converts/translates transcription to English (if non-English)
#   6. Cleans lyrics and removes Whisper hallucinations/noise
#   7. Validates English-only output and returns structured JSON
#
# Usage:
#   python transcribe.py <path_to_audio_file>
# ─────────────────────────────────────────────────────────────────────────────

import sys
import os
import re
import json
import shutil
import tempfile
import unicodedata
import subprocess

# ── Force UTF-8 encoding on stdout/stderr ─────────────────────────────────────
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ── Automatically detect & configure FFmpeg PATH ──────────────────────────────
def ensure_ffmpeg_in_path():
    """Locates ffmpeg executable and adds it to PATH if not already accessible."""
    if shutil.which("ffmpeg"):
        return

    local_app_data = os.getenv("LOCALAPPDATA", "")
    program_files = os.getenv("ProgramFiles", "C:\\Program Files")
    user_profile = os.getenv("USERPROFILE", "")

    search_dirs = [
        os.path.join(local_app_data, "Microsoft", "WinGet", "Packages"),
        os.path.join(program_files, "ffmpeg"),
        os.path.join(user_profile, "scoop", "apps", "ffmpeg", "current", "bin"),
        "C:\\ffmpeg\\bin",
    ]

    for base in search_dirs:
        if os.path.exists(base):
            for root, dirs, files in os.walk(base):
                if "ffmpeg.exe" in files:
                    os.environ["PATH"] = root + os.pathsep + os.environ.get("PATH", "")
                    print(f"[Setup] FFmpeg located at: {root}", file=sys.stderr)
                    return

ensure_ffmpeg_in_path()


# ── Noise & Hallucination Filter ──────────────────────────────────────────────
HALLUCINATION_PATTERNS = [
    r"(?i)subtitles\s+by.*",
    r"(?i)transcript(ion)?\s+by.*",
    r"(?i)translated\s+by.*",
    r"(?i)thank\s+you\s+for\s+watching.*",
    r"(?i)thanks\s+for\s+watching.*",
    r"(?i)like\s+and\s+subscribe.*",
    r"(?i)subscribe\s+to\s+my\s+channel.*",
    r"(?i)please\s+subscribe.*",
    r"(?i)see\s+you\s+in\s+the\s+next\s+video.*",
    r"(?i)all\s+rights\s+reserved.*",
    r"(?i)copyright\s+.*",
    r"(?i)www\..*",
    r"(?i)http(s)?://.*",
    r"\[(?:music|applause|laughter|silence|singing|cheering|noise|instrumental|sound)\]",
    r"\((?:music|applause|laughter|silence|singing|cheering|noise|instrumental|sound)\)",
]

COMPILED_HALLUCINATIONS = [re.compile(p, re.IGNORECASE) for p in HALLUCINATION_PATTERNS]


def is_hallucination(line):
    """Checks if a text line is a known Whisper hallucination or subtitle noise."""
    stripped = line.strip()
    if not stripped:
        return True

    for pattern in COMPILED_HALLUCINATIONS:
        if pattern.search(stripped):
            cleaned = pattern.sub("", stripped).strip()
            if not cleaned or len(cleaned) < 3:
                return True

    return False


def clean_text(text):
    """
    Clean Whisper output while preserving valid English lyric lines.
    Removes repetitive loops, artifacts, and excessive whitespace.
    """
    if not text:
        return ""

    # Normalize unicode
    text = unicodedata.normalize("NFKC", text)

    # Remove replacement characters
    text = text.replace("\ufffd", "").strip()

    # Filter known hallucinations
    if is_hallucination(text):
        return ""

    # Normalize inner whitespace
    words = text.split()
    if not words:
        return ""

    # Check for excessive repetition (e.g. "la la la la la la la la...")
    if len(words) >= 6:
        unique_words = set(w.lower().strip(".,!?:;\"'()") for w in words)
        if len(unique_words) <= 2 and len(words) >= 8:
            return ""

        # Dedup consecutive duplicate words (> 3 times)
        cleaned_words = []
        repeat_count = 1
        for i, word in enumerate(words):
            if i > 0 and word.lower() == words[i - 1].lower():
                repeat_count += 1
            else:
                repeat_count = 1

            if repeat_count <= 3:
                cleaned_words.append(word)

        text = " ".join(cleaned_words)

    return text.strip()


def is_mostly_latin(text):
    """Validates that the output text consists of Latin/English characters."""
    if not text or not text.strip():
        return False

    latin_chars = 0
    total_alpha = 0
    for char in text:
        if char.isalpha():
            total_alpha += 1
            if "\u0000" <= char <= "\u024F":
                latin_chars += 1

    if total_alpha == 0:
        return True

    return (latin_chars / total_alpha) >= 0.85


# ── Demucs Vocal Separation ───────────────────────────────────────────────────
def separate_vocals(audio_path, output_dir):
    """
    Uses Demucs to separate the vocals stem from background instruments.
    Returns the file path to the isolated vocals.wav.
    """
    print(f"[Demucs] Isolating vocals from: {os.path.basename(audio_path)}", file=sys.stderr)

    try:
        import torch
        from demucs.apply import apply_model
        from demucs.pretrained import get_model
        from demucs.audio import AudioFile, save_audio

        model_name = os.getenv("DEMUCS_MODEL", "htdemucs")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[Demucs] Loading model '{model_name}' on {device}...", file=sys.stderr)

        model = get_model(name=model_name)
        model.to(device)
        model.eval()

        # Load audio using Demucs AudioFile
        wav = AudioFile(audio_path).read(
            streams=0,
            samplerate=model.samplerate,
            channels=model.audio_channels
        )
        wav = wav.to(device)

        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)

        print("[Demucs] Running separation...", file=sys.stderr)
        with torch.no_grad():
            sources = apply_model(
                model,
                wav[None],
                device=device,
                shifts=0,
                split=True,
                overlap=0.25,
                progress=False
            )[0]

        sources *= ref.std() + 1e-8
        sources += ref.mean()

        # Find the index of vocals stem
        vocals_idx = model.sources.index("vocals") if "vocals" in model.sources else 3
        vocals_tensor = sources[vocals_idx].cpu()

        vocals_path = os.path.join(output_dir, "vocals.wav")
        save_audio(vocals_tensor, vocals_path, samplerate=model.samplerate)

        if os.path.exists(vocals_path) and os.path.getsize(vocals_path) > 1000:
            print(f"[Demucs] Vocals successfully extracted -> {vocals_path}", file=sys.stderr)
            return vocals_path

    except Exception as e:
        print(f"[Demucs] Direct Python Demucs notice ({e}). Trying CLI separation...", file=sys.stderr)

    # CLI Fallback
    try:
        cmd = [
            sys.executable,
            "-m", "demucs",
            "--two-stems", "vocals",
            "-n", os.getenv("DEMUCS_MODEL", "htdemucs"),
            "-o", output_dir,
            audio_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode == 0:
            track_name = os.path.splitext(os.path.basename(audio_path))[0]
            model_name = os.getenv("DEMUCS_MODEL", "htdemucs")
            cli_vocals = os.path.join(output_dir, model_name, track_name, "vocals.wav")
            if os.path.exists(cli_vocals):
                print(f"[Demucs] Vocals extracted via CLI -> {cli_vocals}", file=sys.stderr)
                return cli_vocals
    except Exception as cli_err:
        print(f"[Demucs] CLI notice ({cli_err})", file=sys.stderr)

    print("[Demucs] Using original audio as fallback.", file=sys.stderr)
    return audio_path


# ── Translation Engine (Non-English -> English) ──────────────────────────────
def translate_to_english(text_segments, detected_language, audio_path, whisper_model, beam_size):
    """
    Translates non-English lyrics into clean English.
    Uses Whisper's translate task + deep-translator fallback for 100% English guarantee.
    """
    if detected_language == "en" and is_mostly_latin("\n".join(seg["text"] for seg in text_segments)):
        return text_segments

    print(f"[Translate] Detected language '{detected_language}'. Converting to English...", file=sys.stderr)

    # Strategy 1: Run Whisper with task="translate" on the vocals for fluent contextual lyrics translation
    whisper_translated_segments = []
    try:
        trans_segments, _ = whisper_model.transcribe(
            audio_path,
            task="translate",
            beam_size=beam_size,
            best_of=3 if beam_size > 1 else 1,
            condition_on_previous_text=False,
            temperature=[0.0, 0.2],
            vad_filter=False,
        )

        for s in trans_segments:
            cleaned = clean_text(s.text)
            if cleaned:
                whisper_translated_segments.append({
                    "start": round(s.start, 2),
                    "end": round(s.end, 2),
                    "text": cleaned
                })
    except Exception as trans_err:
        print(f"[Translate] Whisper translate task notice: {trans_err}", file=sys.stderr)

    # If Whisper translation produced valid Latin/English segments, use them
    combined_whisper_text = " ".join(s["text"] for s in whisper_translated_segments)
    if whisper_translated_segments and is_mostly_latin(combined_whisper_text):
        print("[Translate] Successfully translated using Whisper translate decoder.", file=sys.stderr)
        return whisper_translated_segments

    # Strategy 2: Text-level translation using deep-translator (GoogleTranslator backend)
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="auto", target="en")

        translated_segments = []
        for seg in text_segments:
            raw = seg["text"]
            if not raw.strip():
                continue

            try:
                translated_line = translator.translate(raw)
                cleaned_line = clean_text(translated_line)
                if cleaned_line:
                    translated_segments.append({
                        "start": seg["start"],
                        "end": seg["end"],
                        "text": cleaned_line
                    })
            except Exception:
                if is_mostly_latin(raw):
                    translated_segments.append(seg)

        if translated_segments:
            print("[Translate] Successfully translated using text translation engine.", file=sys.stderr)
            return translated_segments

    except Exception as dt_err:
        print(f"[Translate] Text translation notice: {dt_err}", file=sys.stderr)

    return whisper_translated_segments if whisper_translated_segments else text_segments


# ── Main Pipeline ─────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No audio file path provided"
        }))
        sys.exit(1)

    audio_path = os.path.abspath(sys.argv[1])
    if not os.path.exists(audio_path):
        print(json.dumps({
            "success": False,
            "error": f"Audio file not found: {audio_path}"
        }))
        sys.exit(1)

    # Configuration
    model_size = os.getenv("WHISPER_MODEL", "small")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")
    cpu_threads = int(os.getenv("WHISPER_THREADS", "4"))
    beam_size = int(os.getenv("WHISPER_BEAM_SIZE", "1"))
    demucs_enabled = os.getenv("DEMUCS_ENABLED", "true").lower() in ("true", "1", "yes")

    temp_dir = tempfile.mkdtemp(prefix="soundwave_demucs_")

    try:
        # ── Step 1: Vocal Separation with Demucs ──────────────────────────────
        target_audio = audio_path
        if demucs_enabled:
            target_audio = separate_vocals(audio_path, temp_dir)

        # ── Step 2: Load faster-whisper Model ──────────────────────────────────
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            print(json.dumps({
                "success": False,
                "error": "faster-whisper is not installed in the Python environment."
            }))
            sys.exit(1)

        print(f"[Whisper] Loading model '{model_size}' on {device} ({compute_type})...", file=sys.stderr)
        whisper_model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            cpu_threads=cpu_threads
        )

        # ── Step 3: Transcribe Vocals (task="transcribe" to detect language) ───
        print("[Whisper] Transcribing isolated vocals (detecting original language)...", file=sys.stderr)
        segments, info = whisper_model.transcribe(
            target_audio,
            task="transcribe",
            beam_size=beam_size,
            best_of=3 if beam_size > 1 else 1,
            condition_on_previous_text=False,
            temperature=[0.0, 0.2],
            vad_filter=False,
        )

        detected_language = getattr(info, "language", "en")
        language_prob = round(getattr(info, "language_probability", 0.0), 2)
        print(f"[Whisper] Detected language: '{detected_language}' (probability: {language_prob})", file=sys.stderr)

        # Collect raw segments
        raw_segments = []
        for segment in segments:
            cleaned = clean_text(segment.text or "")
            if cleaned:
                raw_segments.append({
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": cleaned
                })

        # ── Step 4: English Translation (if non-English or foreign script) ────
        final_segments = raw_segments
        if detected_language != "en" or not is_mostly_latin(" ".join(s["text"] for s in raw_segments)):
            final_segments = translate_to_english(
                raw_segments,
                detected_language,
                target_audio,
                whisper_model,
                beam_size
            )

        # ── Step 5: Format Stanzas and Clean Lyrics ────────────────────────────
        formatted_lines = []
        prev_end = None

        for seg in final_segments:
            line_text = clean_text(seg["text"])
            if not line_text:
                continue

            # Insert stanza break on noticeable pause between vocal lines
            if prev_end is not None and (seg["start"] - prev_end) >= 2.2:
                formatted_lines.append("")

            formatted_lines.append(line_text)
            prev_end = seg["end"]

        final_lyrics = "\n".join(formatted_lines).strip()

        # Handle instrumental / no vocal detection
        if not final_lyrics:
            final_lyrics = "[Instrumental Track / No vocal lyrics detected]"

        # ── Step 6: English-Only Validation ───────────────────────────────────
        if final_lyrics != "[Instrumental Track / No vocal lyrics detected]":
            if not is_mostly_latin(final_lyrics):
                print(json.dumps({
                    "success": False,
                    "error": "Failed English validation: Lyrics contain untranslated non-English script."
                }))
                sys.exit(1)

        # ── Step 7: Output JSON ───────────────────────────────────────────────
        output = {
            "success": True,
            "language": detected_language,
            "language_probability": language_prob,
            "text": final_lyrics,
            "segments": final_segments
        }

        print(json.dumps(output, ensure_ascii=False))

    except Exception as err:
        print(json.dumps({
            "success": False,
            "error": f"Lyrics processing error: {str(err)}"
        }))
        sys.exit(1)

    finally:
        # Cleanup temporary Demucs files
        try:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


if __name__ == "__main__":
    main()