@echo off
chcp 65001 > nul
cd /d %~dp0
python tolerance_allocator_gui.py
pause
