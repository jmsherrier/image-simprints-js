@echo off
rem OpenCV.js 5.0.0 with SIFT and estimateAffinePartial2D, into build\out\bin\opencv.js.
rem Needs vendor\opencv (tag 5.0.0), vendor\emsdk (emsdk install/activate latest) and
rem vendor\tools (a venv with pip cmake and ninja).
setlocal
set ROOT=%~dp0..
set EMSDK=%ROOT%\vendor\emsdk
set PATH=%EMSDK%\upstream\emscripten;%ROOT%\vendor\tools\Scripts;%PATH%
set CMAKE_GENERATOR=Ninja
call emcmake python "%ROOT%\build\build_js_win.py" "%ROOT%\vendor\opencv\platforms\js\build_js.py" "%ROOT%\build\out" --build_wasm --config "%ROOT%\build\opencv_js.config.py" %*
