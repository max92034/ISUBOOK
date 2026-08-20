@echo off
cd /d "c:\Users\max92034\Documents\USIBOOK"
echo ========================================
echo   USI 庫存管理工具 啟動中...
echo ========================================
echo.
echo 啟動後請在瀏覽器開啟: http://127.0.0.1:5000
echo 按 Ctrl+C 可關閉工具
echo.
start http://127.0.0.1:5000
"C:\Users\max92034\AppData\Local\Programs\Python\Python312\python.exe" app.py
pause
