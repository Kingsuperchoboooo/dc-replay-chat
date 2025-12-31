@echo off
echo Starting DC Replay Chat...
echo.
:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist node.exe (
        echo Found portable node.exe...
    ) else (
        echo [ERROR] Node.js not found!
        echo Please install Node.js OR put 'node.exe' in this folder.
        echo.
        pause
        exit /b
    )
)

echo Server running at http://localhost:3000
echo Close this window to stop.

if exist node.exe (
    node.exe server.js
) else (
    node server.js
)
pause
