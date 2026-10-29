"""Run OpenCV's own platforms/js/build_js.py on Windows (no WSL, no make): strip the
shell quotes it puts around -D values, and build with Ninja instead of make.
emcmake's own -G Ninja is dropped: build_js.py does not accept it.

    build\\build.bat
"""

import re
import runpy
import subprocess
import sys

SCRIPT = sys.argv[1]
_call = subprocess.call


def call(cmd, **kw):
    if isinstance(cmd, list):
        cmd = [re.sub(r"^(-D[^=]+=)'(.*)'$", r"\1\2", c) for c in cmd]
        if cmd[0] == "make":  # make -j N target
            cmd = ["ninja", cmd[3]]
    return _call(cmd, **kw)


subprocess.call = call
args = sys.argv[1:]
for i in range(len(args) - 1, 0, -1):  # emcmake appends -G Ninja; CMAKE_GENERATOR does that
    if args[i - 1] == "-G":
        del args[i - 1 : i + 1]
sys.argv = args
runpy.run_path(SCRIPT, run_name="__main__")
