@echo off
echo ====================================
echo Setup Upload Folders
echo ====================================
echo.

cd /d "%~dp0\.."

echo Creating uploads directory structure...
if not exist "uploads" mkdir "uploads"
if not exist "uploads\tenant-logos" mkdir "uploads\tenant-logos"
if not exist "uploads\site-images" mkdir "uploads\site-images"
if not exist "uploads\device-images" mkdir "uploads\device-images"

echo.
echo ✓ Upload folders created successfully!
echo.
echo Folder structure:
echo   - uploads\
echo     - tenant-logos\
echo     - site-images\
echo     - device-images\
echo.
echo Done!
pause
