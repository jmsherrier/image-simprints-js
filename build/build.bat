@echo off
rem OpenCV.js 5.0.0 with SIFT and estimateAffinePartial2D, into build\out\bin\opencv.js
rem (build\build.bat --simd: WebAssembly SIMD, into build\out-simd\bin\opencv.js).
rem Needs vendor\opencv (tag 5.0.0), vendor\emsdk (emsdk install/activate latest) and
rem vendor\tools (a venv with pip cmake and ninja).
setlocal
set ROOT=%~dp0..
set EMSDK=%ROOT%\vendor\emsdk
set PATH=%EMSDK%\upstream\emscripten;%ROOT%\vendor\tools\Scripts;%PATH%
set CMAKE_GENERATOR=Ninja
set OUT=%ROOT%\build\out
if "%1"=="--simd" set OUT=%ROOT%\build\out-simd
call emcmake python "%ROOT%\build\build_js_win.py" "%ROOT%\vendor\opencv\platforms\js\build_js.py" "%OUT%" --build_wasm --config "%ROOT%\build\opencv_js.config.py" %*
