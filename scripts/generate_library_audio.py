import os
import math
import numpy as np
import soundfile as sf
import subprocess

SR = 44100

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def to_mp3(wav_path, mp3_path):
    cmd = ["ffmpeg", "-y", "-i", wav_path, "-c:a", "libmp3lame", "-b:a", "192k", mp3_path]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 1000:
        os.remove(wav_path)

def generate_rain_storm(duration_sec=60):
    t = np.linspace(0, duration_sec, int(SR * duration_sec), endpoint=False)
    # Pink noise approximation for rain
    white = np.random.normal(0, 1, len(t))
    # Integrator filter
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    rain = np.convolve(white, [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05], mode='same')
    # Soft rumble every 12 seconds
    thunder = np.zeros_like(t)
    for hit in [8, 22, 38, 52]:
        idx = int(hit * SR)
        dur = int(3.5 * SR)
        if idx + dur < len(t):
            tt = np.linspace(0, 3.5, dur)
            env = np.exp(-tt * 0.9) * (1 - np.exp(-tt * 4))
            sub = np.sin(2 * np.pi * 42 * tt) + 0.5 * np.sin(2 * np.pi * 32 * tt)
            thunder[idx:idx+dur] += sub * env * 0.45

    left = rain * 0.25 + thunder * 0.7
    right = np.roll(rain, 350) * 0.25 + thunder * 0.65
    return np.stack([left, right], axis=1)

def generate_eerie_wind(duration_sec=60):
    t = np.linspace(0, duration_sec, int(SR * duration_sec), endpoint=False)
    noise = np.random.normal(0, 1, len(t))
    # Modulate filter frequency with slow LFO
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.12 * t)
    carrier = np.sin(2 * np.pi * (140 + 70 * lfo) * t) * 0.15
    carrier2 = np.sin(2 * np.pi * (220 + 90 * lfo) * t) * 0.08
    wind = (noise * 0.12 + carrier + carrier2) * (0.6 + 0.4 * lfo)
    left = np.clip(wind, -0.95, 0.95)
    right = np.clip(np.roll(wind, 200) * 0.95, -0.95, 0.95)
    return np.stack([left, right], axis=1)

def generate_heartbeat(duration_sec=60):
    t = np.linspace(0, duration_sec, int(SR * duration_sec), endpoint=False)
    sig = np.zeros_like(t)
    bpm = 64
    beat_gap = 60.0 / bpm
    cur = 0.5
    while cur < duration_sec - 1.0:
        for offset, amp in [(0.0, 0.7), (0.16, 0.45)]:
            idx = int((cur + offset) * SR)
            dur = int(0.28 * SR)
            if idx + dur < len(t):
                tt = np.linspace(0, 0.28, dur)
                env = np.exp(-tt * 18)
                sub = np.sin(2 * np.pi * 48 * tt)
                sig[idx:idx+dur] += sub * env * amp
        cur += beat_gap
    return np.stack([sig, sig], axis=1)

def generate_deep_drone(duration_sec=60):
    t = np.linspace(0, duration_sec, int(SR * duration_sec), endpoint=False)
    # Detuned low sines (48Hz, 50Hz, 72Hz, 108Hz)
    d1 = np.sin(2 * np.pi * 48.0 * t) * 0.35
    d2 = np.sin(2 * np.pi * 49.2 * t) * 0.32
    d3 = np.sin(2 * np.pi * 72.0 * t) * 0.18
    d4 = np.sin(2 * np.pi * 107.5 * t) * 0.12
    lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.08 * t)
    left = (d1 + d3) * lfo
    right = (d2 + d4) * lfo
    return np.stack([left, right], axis=1)

def generate_dark_cello(duration_sec=60):
    t = np.linspace(0, duration_sec, int(SR * duration_sec), endpoint=False)
    # Slow ominous chords: Dm -> Ebm -> Dm -> C#dim
    chords = [
        [73.42, 110.0, 146.83, 174.61], # Dm
        [77.78, 116.54, 155.56, 185.0], # Ebm (tension)
        [73.42, 110.0, 146.83, 174.61], # Dm
        [69.30, 103.83, 138.59, 164.81], # C#dim
    ]
    bar_dur = 15.0
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    for b_idx, chord in enumerate(chords):
        start = int(b_idx * bar_dur * SR)
        end = int(min(len(t), (b_idx + 1) * bar_dur * SR))
        tt = t[start:end] - b_idx * bar_dur
        env = np.sin(np.pi * (tt / bar_dur)) ** 1.5
        sig_l = np.zeros_like(tt)
        sig_r = np.zeros_like(tt)
        for i, f in enumerate(chord):
            saw = np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2 * tt) + 0.2 * np.sin(2 * np.pi * f * 3 * tt)
            pan = 0.65 if i % 2 == 0 else 0.35
            sig_l += saw * env * (0.22 / len(chord)) * pan
            sig_r += saw * env * (0.22 / len(chord)) * (1 - pan)
        left[start:end] += sig_l
        right[start:end] += sig_r
    return np.stack([left, right], axis=1)

def generate_crime_piano(duration_sec=60):
    t = np.linspace(0, duration_sec, int(SR * duration_sec), endpoint=False)
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    # Melancholy notes spaced out
    notes = [146.83, 174.61, 220.0, 261.63, 196.0, 164.81, 146.83, 130.81]
    step_sec = 7.5
    for idx, f in enumerate(notes):
        st = int(idx * step_sec * SR)
        if st >= len(t): break
        dur = int(6.0 * SR)
        ed = min(len(t), st + dur)
        tt = np.linspace(0, (ed - st) / SR, ed - st)
        env = np.exp(-tt * 0.9)
        note = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2 * tt)) * env * 0.28
        left[st:ed] += note * 0.6
        right[st:ed] += note * 0.4
    # Warm pad background
    pad = np.sin(2 * np.pi * 73.42 * t) * 0.08 + np.sin(2 * np.pi * 110.0 * t) * 0.06
    left += pad
    right += pad
    return np.stack([left, right], axis=1)

def generate_jumpscare_hit():
    dur_sec = 3.5
    t = np.linspace(0, dur_sec, int(dur_sec * SR), endpoint=False)
    # Reverse swell then huge slam
    hit_time = 0.6
    swell_samples = int(hit_time * SR)
    tt_swell = np.linspace(0, hit_time, swell_samples)
    swell = (np.random.normal(0, 1, swell_samples) * 0.15) * (tt_swell / hit_time) ** 3

    # Impact
    impact_samples = len(t) - swell_samples
    tt_imp = np.linspace(0, (len(t) - swell_samples) / SR, impact_samples)
    env = np.exp(-tt_imp * 3.5)
    sub = np.sin(2 * np.pi * (80 * np.exp(-tt_imp * 8) + 38) * tt_imp) * 0.75 * env
    noise = np.random.normal(0, 1, impact_samples) * np.exp(-tt_imp * 12) * 0.4
    body = (sub + noise)

    sig = np.concatenate([swell, body])
    return np.stack([sig, sig], axis=1)

def main():
    base_dir = "data"
    tracks = [
        ("sfx/ambient/lluvia_tormenta_nocturna", generate_rain_storm(50)),
        ("sfx/ambient/viento_desolado_bosque", generate_eerie_wind(50)),
        ("sfx/ambient/latidos_de_corazon", generate_heartbeat(50)),
        ("sfx/ambient/dron_terror_subgrave", generate_deep_drone(50)),
        ("music/library/terror/chelo_pesadilla_oscura", generate_dark_cello(55)),
        ("music/library/suspenso/caja_musical_siniestra", generate_dark_cello(55)),
        ("music/library/documental/piano_investigacion_criminal", generate_crime_piano(55)),
        ("sfx/hits/jumpscare_impacto_dramatico", generate_jumpscare_hit()),
    ]

    for rel_path, data in tracks:
        full_wav = os.path.join(base_dir, f"{rel_path}.wav")
        full_mp3 = os.path.join(base_dir, f"{rel_path}.mp3")
        ensure_dir(os.path.dirname(full_wav))
        norm_data = np.clip(data, -0.98, 0.98)
        sf.write(full_wav, norm_data, SR)
        to_mp3(full_wav, full_mp3)
        print(f"Generated: {full_mp3}")

if __name__ == "__main__":
    main()
