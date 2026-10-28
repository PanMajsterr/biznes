@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ===================================================
echo   Wypychanie projektu ShopPanel na GitHub...
echo   Repo: https://github.com/PanMajsterr/biznes
echo ===================================================
echo.

:: 1. Sprawdz czy git jest juz w PATH
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :GitFound

:: 2. Sprawdz typowe lokalizacje instalacji Gita na Windowsie
if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;!PATH!"
    goto :GitFound
)
if exist "%ProgramFiles%\Git\cmd\git.exe" (
    set "PATH=%ProgramFiles%\Git\cmd;!PATH!"
    goto :GitFound
)
if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" (
    set "PATH=%ProgramFiles(x86)%\Git\cmd;!PATH!"
    goto :GitFound
)
if exist "%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;!PATH!"
    goto :GitFound
)
if exist "C:\Users\acer\AppData\Local\Programs\MinGit\cmd\git.exe" (
    set "PATH=C:\Users\acer\AppData\Local\Programs\MinGit\cmd;!PATH!"
    goto :GitFound
)

echo [BLAD] Nie znaleziono programu Git w systemie!
echo Zainstaluj Git ze strony: https://git-scm.com/download/win
echo.
pause
exit /b 1

:GitFound
echo [1/3] Sprawdzanie zmian w projekcie...
git status -s
echo.

set /p COMMIT_MSG="Podaj opis zmian (lub wcisnij ENTER dla domyslnego): "
if "!COMMIT_MSG!"=="" set COMMIT_MSG=Aktualizacja projektu ShopPanel (%DATE% %TIME:~0,5%)

echo.
echo [2/3] Dodawanie plikow i tworzenie commita...
git add -A
git diff-index --quiet HEAD --
if %ERRORLEVEL% NEQ 0 (
    git commit -m "!COMMIT_MSG!"
) else (
    echo Brak nowych zmian do zatwierdzenia.
)

echo.
echo [3/3] Wypychanie na galezie origin main...
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ===================================================
    echo   [SUKCES] Projekt zostal pomyslnie wyslany!
    echo ===================================================
) else (
    echo ===================================================
    echo   [BLAD] Wystapil blad podczas wysylania.
    echo   Upewnij sie, ze jestes zalogowany lub uzyj
    echo   Personal Access Token z GitHuba jako hasla.
    echo ===================================================
)
echo.
pause
