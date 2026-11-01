@echo off
title F5-TTS Studio - Archivo Clasificado (RTX 5090)
cd /d "%~dp0"
echo ============================================================
echo   Iniciando F5-TTS (Flow Matching Voice Cloning Studio)
echo   GPU: NVIDIA GeForce RTX 5090 (Blackwell CUDA 13.0)
echo ============================================================
echo.
echo Abriendo servidor local de clonacion de voz...
echo Puedes acceder desde tu navegador en: http://127.0.0.1:7860
echo.
C:\ComfyUI_windows_portable\python_embeded\python.exe -m f5_tts.infer.infer_gradio --port 7860
pause
