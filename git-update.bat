@echo off
echo Chatlify Projesini Güncelleme
echo ============================
echo.

echo Git durumunu kontrol ediliyor...
git status

echo.
echo Tüm değişiklikleri ekleniyor...
git add .

echo.
set /p commit_message=Commit mesajı giriniz: 

echo.
echo Değişiklikleri commit ediliyor...
git commit -m "%commit_message%"

echo.
echo Origin main'e değişiklikleri gönderiliyor...
git push origin main

echo.
echo Güncelleme tamamlandı!
echo.
pause 