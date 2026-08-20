USIBOOK BETA 1.0
==================

庫存管理與下單提醒工具。

安裝
----
1. Python 3.10+
   pip install -r requirements.txt

2. 首次匯入資料：
   python scripts/export_initial_data.py
   （需要原始 Excel 檔案放在專案根目錄）

3. 啟動：
   雙擊 啟動工具.bat
   或 python app.py

4. 開啟瀏覽器：http://127.0.0.1:5000

功能
----
- 每週匯入美國辦公室庫存資料（G/H/I）
- 自動計算結餘 J = G - H + I
- 自動追蹤週變化 P = J - O
- 下單提醒燈號（紅/黃/綠）
- 生產判斷篩選（需判斷/有貨可出/需要生產）
- Q/R/S/T 庫存分析（總庫存/惠陽/印尼/緬甸）
- 產品銷售分析
- 貨櫃管理
- 資料匯出 CSV

資料安全
--------
- data/ 資料夾已被 .gitignore 排除
- 原始 Excel 檔案 (*.xls/*.xlsx) 已被排除
- 公司資料不會被推上 GitHub

技術
----
- Backend: Flask (Python)
- Frontend: HTML + CSS + JavaScript
- Data: CSV files
- Charts: Chart.js
