@echo off
rem littleCMS 2.19 (Pillow's version) as WebAssembly, for option (b) of the colour-profile
rem test: build\out\lcms.mjs. Needs vendor\lcms2 (tag lcms2.19) and vendor\emsdk.
setlocal
set ROOT=%~dp0..
set PATH=%ROOT%\vendor\emsdk\upstream\emscripten;%PATH%
set SRC=
for %%f in ("%ROOT%\vendor\lcms2\src\*.c") do call set SRC=%%SRC%% "%%f"
call emcc -O2 -I"%ROOT%\vendor\lcms2\include" %SRC% "%ROOT%\build\lcms.c" -o "%ROOT%\build\out\lcms.mjs" -sMODULARIZE -sEXPORT_ES6 -sSINGLE_FILE -sALLOW_MEMORY_GROWTH -sEXPORTED_FUNCTIONS=_to_srgb,_malloc,_free -sEXPORTED_RUNTIME_METHODS=HEAPU8
