@echo off
chcp 65001 > nul
cd /d %~dp0

echo [1/3] Checking Python...
py -3 --version
if errorlevel 1 (
    echo Python not found. Please install Python 3.10 or above and add it to PATH.
    pause
    exit /b 1
)

echo [2/3] Installing PyInstaller if needed...
py -3 -m pip install --upgrade pip
py -3 -m pip install pyinstaller
if errorlevel 1 (
    echo Failed to install PyInstaller.
    pause
    exit /b 1
)

echo [3/3] Building EXE...
py -3 -m PyInstaller --clean --noconfirm tolerance_allocator.spec
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo.
echo Build completed.
echo EXE location: dist\公差分配助手.exe
pause
