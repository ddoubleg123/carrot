#!/usr/bin/env python3
"""Transcribe one audio or video file with the local Vosk model.

Prints a single JSON object to stdout. Speech recognition stays on this
machine: no hosted transcription service is called.
"""

import json
import os
import subprocess
import sys
import tempfile
import wave

os.environ.setdefault("VOSK_LOG_LEVEL", "-1")

try:
    import numpy as np
except ImportError:  # pragma: no cover - transcription still works without speaker splits
    np = None

from vosk import KaldiRecognizer, Model  # noqa: E402


def model_path():
    configured = os.environ.get("VOSK_MODEL_PATH")
    if configured:
        return configured
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(root, ".cache", "vosk", "vosk-model-small-en-us-0.15")


def has_audio_stream(path):
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            path,
        ],
        capture_output=True,
        text=True,
    )
    return probe.returncode == 0 and "audio" in probe.stdout


def to_wav(src):
    handle, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(handle)
    convert = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            src,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            wav_path,
        ],
        capture_output=True,
    )
    if convert.returncode != 0:
        os.remove(wav_path)
        detail = convert.stderr.decode("utf-8", "ignore")[-500:]
        raise RuntimeError(f"Could not read audio from that file. {detail}")
    return wav_path


QUESTION_STARTS = {
    "am", "is", "are", "was", "were", "do", "does", "did",
    "can", "could", "would", "will", "what", "where", "who", "why", "how",
}
QUESTION_PRONOUNS = {"i", "you", "we", "they", "he", "she", "it", "there"}
GREETINGS = {"hello", "hi", "hey", "yes", "no", "well", "okay", "ok"}
FOLLOWING_GERUND = {
    "looking", "going", "being", "doing", "coming", "trying", "getting",
    "making", "saying", "taking", "giving", "running", "waiting", "asking",
    "talking", "working", "listening",
}
PAUSE_BREAK = 0.45


def restore_contractions(words):
    restored = []
    index = 0
    while index < len(words):
        word = words[index]
        nxt = words[index + 1] if index + 1 < len(words) else ""
        if word == "your" and nxt in FOLLOWING_GERUND:
            restored.append("you're")
        elif word == "i":
            restored.append("I")
        else:
            restored.append(word)
        index += 1
    return restored


def capitalize_word(word):
    if not word:
        return word
    if word.lower() == "i":
        return "I"
    if word.startswith("I'"):
        return word
    return word[0].upper() + word[1:]


def finish_clause(words):
    if not words:
        return ""
    words = restore_contractions([word.lower() for word in words])
    if words[0] in GREETINGS and len(words) > 1:
        rest = words[1:]
        ending = "?" if is_question(rest) else "."
        return capitalize_word(words[0]) + ", " + " ".join(rest) + ending
    ending = "?" if is_question(words) else "."
    words[0] = capitalize_word(words[0])
    return " ".join(words) + ending


def is_question(words):
    if not words:
        return False
    first = words[0].lower()
    if first in {"what", "where", "who", "why", "how"}:
        return True
    return first in QUESTION_STARTS and len(words) > 1 and words[1].lower() in QUESTION_PRONOUNS


MIN_SPEAKER_SECONDS = 3.0
MIN_SPEAKER_SHARE = 0.08


def read_mono(wav_path):
    with wave.open(wav_path, "rb") as audio:
        rate = audio.getframerate()
        channels = audio.getnchannels()
        frames = audio.readframes(audio.getnframes())
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, rate


def frame_pitch(samples, rate):
    """Local pitch track. No network call and no extra model."""
    frame = int(rate * 0.04)
    hop = int(rate * 0.08)
    if frame < 32 or len(samples) < frame:
        return np.zeros(0), np.zeros(0)
    min_lag = max(1, int(rate / 320))
    max_lag = max(min_lag + 1, int(rate / 75))
    window = np.hanning(frame)
    times = []
    pitches = []
    for start in range(0, len(samples) - frame, hop):
        chunk = samples[start:start + frame] * window
        rms = float(np.sqrt(np.mean(chunk * chunk)))
        times.append((start + frame / 2) / rate)
        if rms < 0.015:
            pitches.append(0.0)
            continue
        corr = np.correlate(chunk, chunk, mode="full")[frame - 1:]
        region = corr[min_lag:max_lag]
        if region.size == 0 or float(region.max()) <= 0:
            pitches.append(0.0)
            continue
        lag = int(np.argmax(region)) + min_lag
        if corr[lag] < 0.3 * corr[0]:
            pitches.append(0.0)
            continue
        pitches.append(rate / float(lag))
    return np.asarray(times), np.asarray(pitches, dtype=np.float32)


def fold_octaves(pitches):
    voiced = pitches[pitches > 0]
    if voiced.size < 8:
        return pitches
    base = float(np.median(voiced))
    fixed = pitches.copy()
    for index, pitch in enumerate(fixed):
        if pitch <= 0:
            continue
        while pitch > base * 1.65 and pitch / 2 >= 70:
            pitch /= 2
        fixed[index] = pitch
    return fixed


def smooth_pitch(times, pitches):
    if len(pitches) == 0:
        return pitches
    hop = float(times[1] - times[0]) if len(times) > 1 else 0.08
    window = max(1, int(round(0.45 / hop)))
    smoothed = pitches.copy()
    for index, pitch in enumerate(pitches):
        if pitch <= 0:
            continue
        left = max(0, index - window)
        right = min(len(pitches), index + window + 1)
        neighbors = pitches[left:right]
        neighbors = neighbors[neighbors > 0]
        if neighbors.size:
            smoothed[index] = float(np.median(neighbors))
    return smoothed


def label_by_pitch_turns(times, pitches):
    """Split a clip only when a second voice stays away from the main voice's pitch.

    A person moving their pitch inside one answer stays one speaker. Two people
    show up as a stretch of at least a few seconds in a different range.
    """
    if len(times) < 8:
        return None
    hop = float(times[1] - times[0]) if len(times) > 1 else 0.08
    block = max(1, int(round(1.0 / hop)))
    blocks = []
    index = 0
    while index < len(pitches):
        end = min(len(pitches), index + block)
        chunk = pitches[index:end]
        voiced = chunk[chunk > 0]
        pitch = float(np.median(voiced)) if voiced.size >= max(2, int(0.35 * (end - index))) else 0.0
        blocks.append((float(times[index]), float(times[min(end, len(times)) - 1]) + hop, pitch))
        index = end

    voiced_blocks = [pitch for _start, _end, pitch in blocks if pitch > 0]
    if len(voiced_blocks) < 6:
        return None
    histogram, edges = np.histogram(voiced_blocks, bins=np.arange(70, 320, 10))
    mode = float(edges[int(np.argmax(histogram))]) + 5.0
    # Second voice: far enough from the main voice that it is not just emphasis.
    # +1 is higher than the main voice, -1 is lower. A dip and a rise are not the same person.
    side = []
    for _start, _end, pitch in blocks:
        if pitch >= mode + 28:
            side.append(1)
        elif pitch > 0 and pitch <= mode - 28:
            side.append(-1)
        else:
            side.append(0)
    for slot in range(1, len(side) - 1):
        if side[slot] == 0 and side[slot - 1] != 0 and side[slot - 1] == side[slot + 1]:
            side[slot] = side[slot - 1]
    runs = []
    start = 0
    for slot in range(1, len(side) + 1):
        if slot == len(side) or side[slot] != side[start]:
            runs.append((start, slot, side[start]))
            start = slot
    # Drop blips. A real second person holds the other pitch for a few seconds.
    for start, end, value in runs:
        if value != 0 and end - start < 3:
            for slot in range(start, end):
                side[slot] = 0
    other = [value != 0 for value in side]

    other_seconds = sum(end - start for start, end, flag in (
        (blocks[slot][0], blocks[slot][1], other[slot]) for slot in range(len(blocks))
    ) if flag)
    main_seconds = sum(blocks[slot][1] - blocks[slot][0] for slot in range(len(blocks)) if blocks[slot][2] > 0 and not other[slot])
    if other_seconds < MIN_SPEAKER_SECONDS or main_seconds < MIN_SPEAKER_SECONDS:
        return None
    if other_seconds / (other_seconds + main_seconds) < MIN_SPEAKER_SHARE:
        return None

    labels = np.zeros(len(times), dtype=int)
    for slot, (start, end, _pitch) in enumerate(blocks):
        if blocks[slot][2] <= 0:
            continue
        speaker = 1 if side[slot] == 0 else (2 if side[slot] > 0 else 3)
        labels[(times >= start) & (times < end)] = speaker
    if len({int(label) for label in labels if label}) < 2:
        return None
    return labels


def speaker_at(times, labels, moment):
    if len(times) == 0:
        return 0
    index = int(np.searchsorted(times, moment))
    index = min(max(index, 0), len(times) - 1)
    hop = float(times[1] - times[0]) if len(times) > 1 else 0.08
    radius = max(1, int(round(0.7 / hop)))
    best = 0
    best_distance = 0.7
    for candidate in range(max(0, index - radius), min(len(labels), index + radius + 1)):
        if not labels[candidate]:
            continue
        distance = abs(float(times[candidate]) - moment)
        if distance < best_distance:
            best = int(labels[candidate])
            best_distance = distance
    return best


def format_speaker_turns(words, speakers):
    turns = []
    current_speaker = 0
    current = []
    for word, speaker in zip(words, speakers):
        if not speaker:
            speaker = current_speaker
        if not speaker:
            continue
        if current and speaker != current_speaker:
            turns.append((current_speaker, current))
            current = []
        current_speaker = speaker
        current.append(word)
    if current:
        turns.append((current_speaker, current))
    order = []
    for speaker, _turn in turns:
        if speaker not in order:
            order.append(speaker)
    if len(order) < 2:
        return None
    names = {speaker: index + 1 for index, speaker in enumerate(order)}
    blocks = []
    for speaker, turn in turns:
        text = punctuate(turn)
        if text:
            blocks.append(f"Speaker {names[speaker]}\n{text}")
    if len(blocks) < 2:
        return None
    return "\n\n".join(blocks)


def diarize(wav_path, words):
    plain = punctuate(words)
    if np is None or len(words) < 8:
        return plain
    try:
        samples, rate = read_mono(wav_path)
        times, pitches = frame_pitch(samples, rate)
        pitches = smooth_pitch(times, fold_octaves(pitches))
        labels = label_by_pitch_turns(times, pitches)
        if labels is None:
            return plain
        speakers = [
            speaker_at(times, labels, (float(word.get("start") or 0) + float(word.get("end") or 0)) / 2)
            for word in words
        ]
        return format_speaker_turns(words, speakers) or plain
    except Exception:
        return plain


def punctuate(words):
    clauses = []
    current = []
    previous_end = None
    for word in words:
        start = float(word.get("start") or 0)
        if current and previous_end is not None and start - previous_end >= PAUSE_BREAK:
            clauses.append(current)
            current = []
        current.append(word.get("word") or "")
        previous_end = float(word.get("end") or start)
    if current:
        clauses.append(current)
    return " ".join(finish_clause(clause) for clause in clauses if any(clause)).strip()


def transcribe(path):
    if not has_audio_stream(path):
        return {"ok": True, "text": "", "silent": True}

    folder = model_path()
    if not os.path.isdir(folder):
        raise RuntimeError(f"Vosk model is not installed at {folder}")

    wav_path = to_wav(path)
    try:
        model = Model(folder)
        words = []
        with wave.open(wav_path, "rb") as audio:
            rate = audio.getframerate() or 16000
            frames = audio.getnframes()
            recognizer = KaldiRecognizer(model, rate)
            recognizer.SetWords(True)
            while True:
                chunk = audio.readframes(4000)
                if not chunk:
                    break
                if recognizer.AcceptWaveform(chunk):
                    words.extend(json.loads(recognizer.Result()).get("result") or [])
            words.extend(json.loads(recognizer.FinalResult()).get("result") or [])
        duration = frames / float(rate)
        # Topic videos keep the whole spoken track. A long clip skips the
        # pitch split so a 20-minute file finishes as one transcript.
        if os.environ.get("VOSK_KEEP") == "1":
            kept = [word for word in words if word.get("word") and float(word.get("conf") or 0) >= 0.5]
            if len(kept) < 8:
                return {"ok": True, "text": "", "silent": True}
            text = punctuate(kept) if duration > 180 else (diarize(wav_path, kept) or "")
            return {"ok": True, "text": text, "silent": not text}
        # The small model invents words when it is unsure. Keep a transcript
        # only when most of the words are confident, then restore punctuation
        # from the pauses between those words.
        kept = [word for word in words if word.get("word") and float(word.get("conf") or 0) >= 0.6]
        confidences = [float(word.get("conf") or 0) for word in words]
        average = sum(confidences) / len(confidences) if confidences else 0
        reliable = bool(kept) and average >= 0.7 and len(kept) >= max(1, int(len(words) * 0.6))
        text = diarize(wav_path, kept) if reliable else ""
        return {"ok": True, "text": text, "silent": not text}
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "error": "Usage: vosk_transcribe.py <file>"}))
        return 1
    try:
        print(json.dumps(transcribe(sys.argv[1])))
        return 0
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(error)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
