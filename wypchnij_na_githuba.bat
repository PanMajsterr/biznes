@echo off
chcp 65001 >nul
echo ===================================================
echo   Wypychanie projektu ShopPanel na GitHub...
echo   Repo: https://github.com/PanMajsterr/biznes
echo ===================================================
echo.

set "PATH=C:\Users\acer\AppData\Local\Programs\MinGit\cmd;%PATH%"

git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUKCES] Projekt zostal pomyslnie wyslany na GitHuba!
) else (
    echo [BLAD] Cos poszlo nie tak. Jesli poproszono o token, uzyj Personal Access Token z GitHuba.
)
echo.
pause

