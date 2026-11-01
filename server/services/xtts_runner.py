import os
import sys
import argparse

os.environ["COQUI_TOS_AGREED"] = "1"
import torch
import torchaudio
import soundfile as sf

# Parche PyTorch weights_only para compatibilidad con checkpoints de Coqui
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

# Parche torchaudio load/save con soundfile para evitar dependencia de torchcodec en Windows
_orig_ta_load = torchaudio.load
def _patched_ta_load(filepath, *args, **kwargs):
    try:
        data, sr = sf.read(filepath, dtype='float32')
        tensor = torch.from_numpy(data)
        if tensor.ndim == 1:
            tensor = tensor.unsqueeze(0)
        elif tensor.ndim == 2:
            tensor = tensor.t()
        return tensor, sr
    except Exception:
        return _orig_ta_load(filepath, *args, **kwargs)
torchaudio.load = _patched_ta_load

_orig_ta_save = torchaudio.save
def _patched_ta_save(filepath, src, sample_rate, *args, **kwargs):
    try:
        if isinstance(src, torch.Tensor):
            arr = src.detach().cpu().numpy()
            if arr.ndim == 2:
                arr = arr.t()
            sf.write(filepath, arr, sample_rate)
            return
    except Exception:
        pass
    return _orig_ta_save(filepath, src, sample_rate, *args, **kwargs)
torchaudio.save = _patched_ta_save

from TTS.api import TTS

def main():
    parser = argparse.ArgumentParser(description="XTTS-v2 Offline Synthesizer for ClipAI")
    parser.add_argument("--ref_wav", required=True, help="Ruta al archivo WAV de referencia para clonación")
    parser.add_argument("--text", default=None, help="Texto a sintetizar en español")
    parser.add_argument("--text_file", default=None, help="Archivo con el texto a sintetizar")
    parser.add_argument("--speed", type=float, default=0.85, help="Velocidad de locución")
    parser.add_argument("--out_wav", required=True, help="Ruta del archivo de salida")
    args = parser.parse_args()

    if not os.path.exists(args.ref_wav):
        print(f"ERROR: No se encontró el archivo de referencia: {args.ref_wav}", file=sys.stderr)
        sys.exit(1)

    text_to_speak = ""
    if args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, "r", encoding="utf-8") as f:
            text_to_speak = f.read().strip()
    elif args.text:
        text_to_speak = args.text.strip()

    if not text_to_speak:
        print("ERROR: No se proporcionó texto para sintetizar.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(args.out_wav)), exist_ok=True)

    # Detección y verificación de aceleración CUDA (NVIDIA RTX 5090 Blackwell)
    use_gpu = False
    if torch.cuda.is_available():
        try:
            torch.zeros(1).cuda()
            use_gpu = True
            print("XTTS: Aceleración GPU (CUDA) verificada y activa.")
        except Exception as e:
            print(f"XTTS: GPU detectada pero no compatible con CUDA ({e}). Usando CPU.", file=sys.stderr)
            use_gpu = False
    else:
        print("XTTS: CUDA no disponible. Ejecutando en CPU.", file=sys.stderr)

    # Cargar XTTS-v2
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=use_gpu)
    tts.tts_to_file(
        text=text_to_speak,
        speaker_wav=args.ref_wav,
        language="es",
        speed=args.speed,
        file_path=args.out_wav,
        split_sentences=True
    )
    print(f"SUCCESS: Audio generado en {args.out_wav}")

if __name__ == "__main__":
    main()

