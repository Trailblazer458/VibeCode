@echo off
cd /d "%~dp0"
echo Pushing TripGenie to https://github.com/Trailblazer458/VibeCode ...
if not exist .git git init
git config user.name >nul 2>&1 || git config user.name "Trailblazer458"
git config user.email >nul 2>&1 || git config user.email "Trailblazer458@users.noreply.github.com"
git add -A
git commit -m "TripGenie prototype: intent-based travel personalizer"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Trailblazer458/VibeCode.git
git push -u origin main
echo.
echo Finished. Press any key to close this window.
pause >nul
