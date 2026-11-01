import os
import sys
import argparse

os.environ["COQUI_TOS_AGREED"] = "1"
import torch

# Parche PyTorch 2.6 weights_only para compatibilidad con checkpoints de Coqui
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

from TTS.api import TTS

def main():
    parser = argparse.ArgumentParser(description="XTTS-v2 Offline Synthesizer for ClipAI")
    parser.add_argument("--ref_wav", required=True, help="Ruta al archivo WAV de referencia para clonación")
    parser.add_argument("--text", required=True, help="Texto a sintetizar en español")
    parser.add_argument("--speed", type=float, default=0.85, help="Velocidad de locución")
    parser.add_argument("--out_wav", required=True, help="Ruta del archivo de salida")
    args = parser.parse_args()

    if not os.path.exists(args.ref_wav):
        print(f"ERROR: No se encontró el archivo de referencia: {args.ref_wav}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(args.out_wav)), exist_ok=True)

    # Cargar XTTS-v2
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
    tts.tts_to_file(
        text=args.text,
        speaker_wav=args.ref_wav,
        language="es",
        speed=args.speed,
        file_path=args.out_wav
    )
    print(f"SUCCESS: Audio generado en {args.out_wav}")

if __name__ == "__main__":
    main()

