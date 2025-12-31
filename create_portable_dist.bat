@echo off
echo ==========================================
echo Building DC Replay Chat (Portable Version)
echo ==========================================

:: 1. Build Next.js
echo [1/4] Running Build...
call npm.cmd run build

:: 2. Create Dist Folder
echo [2/4] Creating Distribution Folder...
if exist DC_Replay_Portable rmdir /s /q DC_Replay_Portable
mkdir DC_Replay_Portable

:: 3. Copy Standalone Files
echo [3/4] Copying Application Files...
xcopy /E /I /Y .next\standalone DC_Replay_Portable
xcopy /E /I /Y public DC_Replay_Portable\public
xcopy /E /I /Y .next\static DC_Replay_Portable\.next\static

:: 4. Create Start Script for Users
echo [4/4] Creating Start Script...
(
echo @echo off
echo echo Starting DC Replay Chat...
echo echo.
echo :: Check for Node.js
echo where node ^>nul 2^>^&1
echo if %%errorlevel%% neq 0 ^(
echo     if exist node.exe ^(
echo         echo Found portable node.exe...
echo     ^) else ^(
echo         echo [ERROR] Node.js not found!
echo         echo Please install Node.js OR put 'node.exe' in this folder.
echo         echo.
echo         pause
echo         exit /b
echo     ^)
echo ^)
echo.
echo echo Server running at http://localhost:3000
echo echo Close this window to stop.
echo.
echo if exist node.exe ^(
echo     node.exe server.js
echo ^) else ^(
echo     node server.js
echo ^)
echo pause
) > DC_Replay_Portable\start.bat

echo.
echo ==========================================
echo [SUCCESS] Portable version created!
echo Folder: DC_Replay_Portable
echo.
echo [INSTRUCTION]
echo 1. Download 'node.exe' (Windows Binary) from nodejs.org
echo 2. Place 'node.exe' inside 'DC_Replay_Portable' folder
echo 3. Zip the folder and share it!
echo ==========================================
pause
