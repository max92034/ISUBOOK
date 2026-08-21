# -*- coding: utf-8 -*-
"""Generate USI 庫存管理工具 使用說明書 PDF"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem, Flowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus.flowables import HRFlowable

# Register Chinese font (Microsoft YaHei supports Traditional Chinese)
pdfmetrics.registerFont(TTFont('MSYH', r'C:\Windows\Fonts\msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('MSYH-Bold', r'C:\Windows\Fonts\msyhbd.ttc', subfontIndex=0))

# Colors
BLUE = HexColor('#1a73e8')
DARK_BLUE = HexColor('#1557b0')
RED = HexColor('#ea4335')
GREEN = HexColor('#34a853')
YELLOW = HexColor('#fbbc04')
ORANGE = HexColor('#ff9800')
GRAY = HexColor('#5f6368')
LIGHT_GRAY = HexColor('#f1f3f4')
LIGHT_BLUE = HexColor('#e8f0fe')
LIGHT_RED = HexColor('#fce8e6')
LIGHT_GREEN = HexColor('#e6f4ea')
LIGHT_YELLOW = HexColor('#fef7e0')
LIGHT_ORANGE = HexColor('#fff3e0')
BG_DARK = HexColor('#202124')
WHITE_CARD = HexColor('#ffffff')

# Styles
styles = getSampleStyleSheet()

style_title = ParagraphStyle('CoverTitle', fontName='MSYH-Bold', fontSize=28,
    textColor=white, alignment=TA_CENTER, leading=36, spaceAfter=10)
style_subtitle = ParagraphStyle('CoverSub', fontName='MSYH', fontSize=14,
    textColor=HexColor('#bdc3c7'), alignment=TA_CENTER, leading=20)
style_h1 = ParagraphStyle('H1', fontName='MSYH-Bold', fontSize=18,
    textColor=BLUE, alignment=TA_LEFT, spaceAfter=8, spaceBefore=6, leading=24)
style_h2 = ParagraphStyle('H2', fontName='MSYH-Bold', fontSize=14,
    textColor=DARK_BLUE, alignment=TA_LEFT, spaceAfter=6, spaceBefore=10, leading=20)
style_h3 = ParagraphStyle('H3', fontName='MSYH-Bold', fontSize=12,
    textColor=BG_DARK, alignment=TA_LEFT, spaceAfter=4, spaceBefore=8, leading=18)
style_body = ParagraphStyle('Body', fontName='MSYH', fontSize=10.5,
    textColor=BG_DARK, alignment=TA_LEFT, leading=17, spaceAfter=4)
style_body_just = ParagraphStyle('BodyJ', fontName='MSYH', fontSize=10.5,
    textColor=BG_DARK, alignment=TA_JUSTIFY, leading=17, spaceAfter=4)
style_step = ParagraphStyle('Step', fontName='MSYH', fontSize=10.5,
    textColor=BG_DARK, alignment=TA_LEFT, leading=17, spaceAfter=3,
    leftIndent=20, firstLineIndent=-15)
style_note = ParagraphStyle('Note', fontName='MSYH', fontSize=9.5,
    textColor=GRAY, alignment=TA_LEFT, leading=15, spaceAfter=3)
style_tip = ParagraphStyle('Tip', fontName='MSYH', fontSize=10,
    textColor=DARK_BLUE, alignment=TA_LEFT, leading=16, spaceAfter=3,
    leftIndent=10)
style_table_header = ParagraphStyle('TH', fontName='MSYH-Bold', fontSize=9.5,
    textColor=white, alignment=TA_CENTER, leading=14)
style_table_cell = ParagraphStyle('TC', fontName='MSYH', fontSize=9.5,
    textColor=BG_DARK, alignment=TA_LEFT, leading=14)
style_table_cell_center = ParagraphStyle('TCC', fontName='MSYH', fontSize=9.5,
    textColor=BG_DARK, alignment=TA_CENTER, leading=14)
style_kpi_label = ParagraphStyle('KPI', fontName='MSYH-Bold', fontSize=9,
    textColor=white, alignment=TA_CENTER, leading=13)
style_kpi_desc = ParagraphStyle('KPID', fontName='MSYH', fontSize=8,
    textColor=HexColor('#e0e0e0'), alignment=TA_CENTER, leading=12)


class CoverBackground(Flowable):
    """Full-page colored cover background."""
    def __init__(self, width, height):
        Flowable.__init__(self)
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(BG_DARK)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        # Decorative top bar
        self.canv.setFillColor(BLUE)
        self.canv.rect(0, self.height - 8*mm, self.width, 8*mm, fill=1, stroke=0)
        # Decorative bottom bar
        self.canv.setFillColor(HexColor('#333333'))
        self.canv.rect(0, 0, self.width, 5*mm, fill=1, stroke=0)


def kpi_card_table(items):
    """Create a row of KPI card-like table cells."""
    data = []
    labels = []
    descs = []
    colors = []
    for label, desc, color in items:
        labels.append(Paragraph(label, style_kpi_label))
        descs.append(Paragraph(desc, style_kpi_desc))
        colors.append(color)

    data = [labels, descs]
    col_widths = [165/mm / len(items)] * len(items)
    t = Table(data, colWidths=col_widths, rowHeights=[10*mm, 8*mm])
    style_cmds = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]
    for i, c in enumerate(colors):
        style_cmds.append(('BACKGROUND', (i, 0), (i, -1), c))
    t.setStyle(TableStyle(style_cmds))
    return t


def info_box(text, bg_color=LIGHT_BLUE, border_color=BLUE):
    """Create a colored info box."""
    p = Paragraph(text, ParagraphStyle('IB', fontName='MSYH', fontSize=10,
        textColor=BG_DARK, alignment=TA_LEFT, leading=16))
    t = Table([[p]], colWidths=[165*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('BOX', (0, 0), (-1, -1), 1, border_color),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    return t


def step_box(num, title, desc, color=BLUE):
    """Create a numbered step box."""
    num_style = ParagraphStyle('Num', fontName='MSYH-Bold', fontSize=16,
        textColor=white, alignment=TA_CENTER, leading=20)
    title_style = ParagraphStyle('ST', fontName='MSYH-Bold', fontSize=11,
        textColor=BG_DARK, alignment=TA_LEFT, leading=16, spaceAfter=2)
    desc_style = ParagraphStyle('SD', fontName='MSYH', fontSize=10,
        textColor=GRAY, alignment=TA_LEFT, leading=15)

    num_cell = Paragraph(str(num), num_style)
    content = [Paragraph(title, title_style), Paragraph(desc, desc_style)]

    t = Table([[num_cell, content]], colWidths=[12*mm, 153*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), color),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
        ('TOPPADDING', (1, 0), (1, 0), 4),
        ('BOTTOMPADDING', (1, 0), (1, 0), 4),
        ('LEFTPADDING', (1, 0), (1, 0), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor('#e0e0e0')),
    ]))
    return t


def make_table(header, rows, col_widths=None):
    """Create a styled data table."""
    header_row = [Paragraph(h, style_table_header) for h in header]
    data_rows = []
    for row in rows:
        data_rows.append([Paragraph(str(c), style_table_cell) for c in row])

    data = [header_row] + data_rows
    if col_widths is None:
        col_widths = [165*mm / len(header)] * len(header)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'MSYH-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('FONTSIZE', (0, 1), (-1, -1), 9.5),
        ('FONTNAME', (0, 1), (-1, -1), 'MSYH'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cccccc')),
    ]))
    return t


def header_footer(canvas, doc):
    """Page header and footer."""
    canvas.saveState()
    # Header bar
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1] - 4*mm, A4[0], 4*mm, fill=1, stroke=0)
    # Footer
    canvas.setFillColor(GRAY)
    canvas.setFont('MSYH', 8)
    canvas.drawString(15*mm, 10*mm, 'USI 庫存管理工具 - 使用說明書')
    canvas.drawRightString(A4[0] - 15*mm, 10*mm, f'第 {doc.page} 頁')
    canvas.restoreState()


def cover_page(canvas, doc):
    """Cover page background."""
    canvas.saveState()
    # Dark background
    canvas.setFillColor(BG_DARK)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    # Top blue bar
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1] - 12*mm, A4[0], 12*mm, fill=1, stroke=0)
    # Bottom accent
    canvas.setFillColor(HexColor('#333333'))
    canvas.rect(0, 0, A4[0], 8*mm, fill=1, stroke=0)
    # Decorative lines
    canvas.setStrokeColor(BLUE)
    canvas.setLineWidth(0.5)
    for i in range(5):
        y = 60*mm + i * 3*mm
        canvas.line(20*mm, y, A4[0] - 20*mm, y)
    canvas.restoreState()


def build_manual():
    """Build the full PDF document."""
    output_path = r'c:\Users\max92034\Documents\USIBOOK\使用說明書.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=18*mm,
        bottomMargin=18*mm,
    )

    story = []

    # ===== COVER PAGE =====
    story.append(Spacer(1, 50*mm))
    story.append(Paragraph('USI 庫存管理工具', style_title))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph('使用說明書', ParagraphStyle('CT2', fontName='MSYH-Bold',
        fontSize=22, textColor=BLUE, alignment=TA_CENTER, leading=28)))
    story.append(Spacer(1, 15*mm))
    story.append(Paragraph('從資料匯入到訂單分析的完整指南', style_subtitle))
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph('適用對象：初次使用者', ParagraphStyle('CT3', fontName='MSYH',
        fontSize=12, textColor=HexColor('#9aa0a6'), alignment=TA_CENTER, leading=18)))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('版本：BETA 1.0', ParagraphStyle('CT4', fontName='MSYH',
        fontSize=12, textColor=HexColor('#9aa0a6'), alignment=TA_CENTER, leading=18)))
    story.append(PageBreak())

    # ===== TABLE OF CONTENTS =====
    story.append(Paragraph('目 錄', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=10))

    toc_items = [
        ('一、系統簡介', '3'),
        ('二、首次使用：上傳總檔', '3'),
        ('三、每週資料匯入', '5'),
        ('四、儀表板概覽', '7'),
        ('　　4.1 KPI 卡片說明', '7'),
        ('　　4.2 篩選與搜尋', '9'),
        ('　　4.3 產品列表', '10'),
        ('五、訂單分析', '11'),
        ('　　5.1 匯入客戶訂單', '11'),
        ('　　5.2 批量上傳多張訂單', '13'),
        ('　　5.3 欄位對應', '14'),
        ('　　5.4 分析結果說明', '15'),
        ('　　5.5 表格排序', '17'),
        ('六、資料管理', '18'),
        ('七、常見問題', '19'),
    ]

    toc_data = [[Paragraph(title, style_body), Paragraph(page, style_body)] for title, page in toc_items]
    toc_table = Table(toc_data, colWidths=[140*mm, 25*mm])
    toc_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, HexColor('#e0e0e0')),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ===== 1. SYSTEM INTRO =====
    story.append(Paragraph('一、系統簡介', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    story.append(Paragraph(
        'USI 庫存管理工具是一套純前端網頁應用，無需安裝任何軟體。'
        '只要打開瀏覽器即可使用，所有資料儲存在您瀏覽器的 localStorage 中，'
        '不會上傳到任何伺服器，確保資料安全與隱私。', style_body_just))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('主要功能', style_h2))

    features = [
        ['功能', '說明'],
        ['總檔初始化', '上傳 USI 總檔 Excel，自動解析所有產品資料'],
        ['每週資料匯入', '匯入美國辦公室每週提供的庫存、訂單、海上貨物數據'],
        ['儀表板', 'KPI 卡片、在途貨櫃、銷售分析、產品列表與篩選'],
        ['訂單分析', '匯入客戶訂單，自動比對庫存，分析需生產、需出貨項目'],
        ['資料管理', '備份匯出、還原、重新初始化、清除資料'],
    ]
    story.append(make_table(features[0], features[1:], col_widths=[40*mm, 125*mm]))

    story.append(Spacer(1, 4*mm))
    story.append(info_box(
        '<b>系統需求：</b>任何現代瀏覽器（Chrome、Edge、Firefox、Safari）。'
        '建議使用 Chrome 或 Edge 以獲得最佳體驗。<br/>'
        '<b>網址：</b>https://max92034.github.io/ISUBOOK/',
        LIGHT_GREEN, GREEN))

    story.append(PageBreak())

    # ===== 2. FIRST-TIME SETUP =====
    story.append(Paragraph('二、首次使用：上傳總檔', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    story.append(Paragraph(
        '第一次打開系統時，畫面會顯示歡迎畫面。您需要上傳 USI 總檔 Excel 來初始化所有產品資料。'
        '這個步驟只需做一次，之後系統會記住您的資料。', style_body_just))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('操作步驟', style_h2))

    story.append(step_box(1, '打開系統網址',
        '在瀏覽器中前往 https://max92034.github.io/ISUBOOK/', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(2, '看到歡迎畫面',
        '系統會顯示「歡迎使用！首次使用請上傳 USI 總檔 Excel 來初始化產品資料」的提示。'
        '畫面中央有一個拖曳區域。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(3, '上傳 Excel 檔案',
        '方式一：將 Excel 檔案直接拖曳到虛線框內。\n'
        '方式二：點擊「點擊選擇」文字，從檔案總管中選擇檔案。\n'
        '檔案格式：.xls 或 .xlsx，需包含「USI庫存情況」工作表。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(4, '等待系統解析',
        '系統會自動讀取 Excel 中的所有產品資料，包括：\n'
        '• 產品編號 (Item Code)、中英文品名\n'
        '• 庫存 G、接單 H、海上 I、結餘 J\n'
        '• 總庫存 Q、惠陽 R、印尼 S、緬甸 T\n'
        '• 2025 銷售量 W、總出貨量 X\n'
        '• 不再銷售型號清單', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(5, '進入儀表板',
        '解析完成後，系統會自動進入主儀表板儀表板畫面，顯示所有庫存資訊。', GREEN))

    story.append(Spacer(1, 5*mm))
    story.append(info_box(
        '<b>注意事項：</b><br/>'
        '• 檔案必須包含名為「USI庫存情況」的工作表（Sheet）<br/>'
        '• 如果總檔中有「不再销售的型号」工作表，系統會自動記錄，並在訂單分析時標記<br/>'
        '• 資料儲存在瀏覽器中，不同瀏覽器或不同電腦的資料不共用<br/>'
        '• 如需在其他電腦使用，請使用「資料管理」中的備份功能',
        LIGHT_YELLOW, ORANGE))

    story.append(PageBreak())

    # ===== 3. WEEKLY IMPORT =====
    story.append(Paragraph('三、每週資料匯入', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    story.append(Paragraph(
        '系統提供兩個匯入按鈕，分別對應不同的檔案來源。'
        '兩者都會更新庫存的 G/H/I 數值，並自動計算結餘和週變化。', style_body_just))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('兩種匯入方式', style_h2))

    fmt_items = [
        ['按鈕', '檔案格式', '說明'],
        ['📥 匯入週資料', 'USI 總檔\n(多分頁 Excel)',
         '上傳 USI 總檔來更新庫存。\n讀取第一個工作表的 G/H/I 欄位。'],
        ['🇺🇸 美國週報', 'QuickBooks 匯出\n(xlsx/csv)',
         '上傳美國辦公室每週傳來的原始檔案。\n欄位：Item / Quantity On Purchase Order /\nQuantity On Sales Order / Quantity On Hand'],
    ]
    story.append(make_table(fmt_items[0], fmt_items[1:], col_widths=[35*mm, 35*mm, 95*mm]))

    story.append(Spacer(1, 3*mm))
    story.append(info_box(
        '<b>美國週報欄位對應：</b><br/>'
        '• Quantity On Hand (手上庫存) → G 庫存<br/>'
        '• Quantity On Sales Order (銷售訂單) → H 接單<br/>'
        '• Quantity On Purchase Order (採購訂單) → I 海上<br/>'
        '系統會自動跳過空的 Sheet（如 QuickBooks 說明頁），找到正確的資料表。',
        LIGHT_GREEN, GREEN))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('操作步驟（兩種方式相同）', style_h2))

    story.append(step_box(1, '點擊對應的匯入按鈕',
        '依檔案類型點擊「📥 匯入週資料」或「🇺🇸 美國週報」按鈕。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(2, '上傳檔案',
        '在彈出的視窗中，將檔案拖曳到虛線框內，或點擊選擇檔案。\n'
        '支援格式：.xlsx、.xls、.csv', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(3, '確認匯入',
        '系統會顯示檔案名稱和大小，點擊「確認匯入」按鈕。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(4, '系統自動處理',
        '系統會自動執行以下操作：\n'
        '• 將目前的 G/H/I 數值移至 L/M/N（保存為上週快照）\n'
        '• 填入新的 G/H/I 數值\n'
        '• 自動計算結餘 J = G - H + I\n'
        '• 自動計算週變化 P = J - O（與上週結餘的差異）\n'
        '• 儲存歷史快照', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(5, '查看匯入結果',
        '匯入完成後，系統會顯示：匯入日期、檔案名稱、總項目數、更新項目數、新增項目數。\n'
        '頁面會自動刷新，儀表板數據更新為最新狀態。', GREEN))

    story.append(Spacer(1, 5*mm))
    story.append(info_box(
        '<b>防呆機制：</b><br/>'
        '• 美國週報匯入時，系統會自動跳過空的 Sheet（如 QuickBooks 說明頁）<br/>'
        '• 如果系統偵測到檔案中的項目與現有產品編號吻合率低於 10%，會阻止匯入並提示<br/>'
        '• 如果誤將客戶訂單上傳到此功能，系統會提示您改用「訂單分析」功能',
        LIGHT_RED, RED))

    story.append(PageBreak())

    # ===== 4. DASHBOARD =====
    story.append(Paragraph('四、儀表板概覽', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    story.append(Paragraph(
        '匯入資料後，儀表板會顯示完整的庫存概況。畫面由上到下分為幾個區域：'
        'KPI 卡片、在途貨櫃、結餘下降排行、產品列表、銷售分析圖表。', style_body_just))

    # 4.1 KPI Cards
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('4.1 KPI 卡片說明', style_h2))

    story.append(Paragraph(
        '畫面最上方有七張 KPI 卡片，每張代表一種庫存狀態的分類：', style_body))
    story.append(Spacer(1, 2*mm))

    # KPI cards as table
    kpi_items = [
        ['卡片', '顏色', '說明'],
        ['緊急下單', '紅色', '結餘 ≤ 0，需立即補貨的產品數量'],
        ['需關注', '黃色', '預估 4 週內用完的產品數量'],
        ['庫存健康', '綠色', '庫存充足的產品數量'],
        ['在途貨櫃', '藍色', '目前在途中的貨櫃數量'],
        ['需判斷是否生產', '橘色', '結餘為負數且絕對值小於總庫存 Q'],
        ['有貨可出', '青色', '4 個月內會賣光，但總庫存 ≥ 20'],
        ['需要生產', '紫色', '4 個月內會賣光，且總庫存 < 20'],
    ]
    story.append(make_table(kpi_items[0], kpi_items[1:], col_widths=[35*mm, 20*mm, 110*mm]))

    story.append(Spacer(1, 3*mm))
    story.append(info_box(
        '<b>點擊 KPI 卡片：</b>點擊任何一張 KPI 卡片下方的篩選按鈕，'
        '可以快速篩選產品列表中對應狀態的產品。',
        LIGHT_BLUE, BLUE))

    story.append(PageBreak())

    # 4.2 Filter & Search
    story.append(Paragraph('4.2 篩選與搜尋', style_h2))

    story.append(Paragraph(
        '在產品列表上方有一排篩選標籤和搜尋框，幫助您快速找到需要的產品：', style_body))
    story.append(Spacer(1, 2*mm))

    filter_items = [
        ['篩選標籤', '功能'],
        ['全部', '顯示所有產品'],
        ['🔴 緊急', '只顯示結餘 ≤ 0 的產品'],
        ['🟡 注意', '只顯示預估 4 週內用完的產品'],
        ['🟢 健康', '只顯示庫存充足的產品'],
        ['🔍 需判斷生產', '結餘 < 0 且絕對值 < 總庫存 Q'],
        ['📦 有貨可出', '4 個月內月內賣光，總庫存 ≥ 20'],
        ['🏭 需要生產', '4 個月內賣光，總庫存 < 20'],
    ]
    story.append(make_table(filter_items[0], filter_items[1:], col_widths=[45*mm, 120*mm]))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('搜尋功能', style_h3))
    story.append(Paragraph(
        '在搜尋框中輸入產品編號 (Item Code) 或產品名稱的關鍵字，'
        '列表會即時過濾顯示符合條件的產品。搜尋不區分大小寫。', style_body))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('4.3 產品列表', style_h2))

    story.append(Paragraph(
        '產品列表顯示所有產品的詳細資訊。表格支援以下功能：', style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('• <b>排序：</b>點擊表頭中帶有 ⇅ 圖示的欄位（如 Item、庫存 G、結餘 J 等），'
        '可按該欄位升序或降序排列。再次點擊可切換排列方向。', style_body))
    story.append(Paragraph('• <b>展開詳情：</b>點擊產品列最右側的展開按鈕，可查看該產品的完整資訊，'
        '包括各廠庫存、上週數據、預估可用週數等。', style_body))
    story.append(Paragraph('• <b>分頁：</b>列表底部有分頁控制，每頁顯示 50 項產品。', style_body))

    story.append(Spacer(1, 3*mm))
    story.append(info_box(
        '<b>欄位說明：</b><br/>'
        '• G (庫存)：目前倉庫庫存數量<br/>'
        '• H (接單)：目前未出貨的訂單數量<br/>'
        '• I (海上)：在途中的貨物數量<br/>'
        '• J (結餘) = G - H + I：可用庫存結餘<br/>'
        '• Q (總庫存)：所有工廠的生產庫存總和<br/>'
        '• R (惠陽)、S (印尼)、T (緬甸)：各廠庫存',
        LIGHT_GRAY, GRAY))

    story.append(PageBreak())

    # ===== 5. ORDER ANALYSIS =====
    story.append(Paragraph('五、訂單分析', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    story.append(Paragraph(
        '訂單分析功能可以匯入客戶訂單，系統會自動比對庫存數據，'
        '分析每個訂單項目的狀態，並將結果分類為「需要生產」、「需要出貨」和「需注意」三類。', style_body_just))

    # 5.1 Import
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('5.1 匯入客戶訂單', style_h2))

    story.append(step_box(1, '點擊「訂單分析」按鈕',
        '在畫面右上方找到「📋 訂單分析」按鈕並點擊。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(2, '上傳訂單檔案',
        '在彈出的視窗中，將客戶訂單檔案拖曳到虛線框內，或點擊選擇檔案。\n'
        '支援格式：.xlsx、.xls、.csv\n'
        '可同時上傳多張訂單（見 5.2 批量上傳）。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(3, '確認欄位對應',
        '系統會自動偵測檔案中的 SKU 欄位和數量欄位。\n'
        '如果自動偵測不正確，您可以手動從下拉選單中選擇正確的欄位（見 5.3）。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(4, '點擊「確認匯入」',
        '確認欄位對應無誤後，點擊藍色的「確認匯入」按鈕。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(5, '查看分析結果',
        '系統會自動分析所有訂單項目，並顯示分類結果和詳細列表（見 5.4）。', GREEN))

    story.append(Spacer(1, 4*mm))
    story.append(info_box(
        '<b>訂單檔案格式要求：</b><br/>'
        '• 不需要固定模板，只要有 SKU 和數量兩個欄位即可<br/>'
        '• <b>SKU 欄位</b>支援的欄位名稱（大小寫不拘）：SKU、Item、Item Code、型號、產品編號、品號<br/>'
        '• <b>數量欄位</b>支援的欄位名稱：Quantity、Qty、數量、訂購數量、Amount<br/>'
        '• 如果找不到對應名稱，系統會智能偵測（分析欄位值的特徵）<br/>'
        '• 仍找不到時，預設取第一欄為 SKU、第二欄為數量',
        LIGHT_GREEN, GREEN))

    story.append(PageBreak())

    # 5.2 Batch Upload
    story.append(Paragraph('5.2 批量上傳多張訂單', style_h2))

    story.append(Paragraph(
        '如果您有多張客戶訂單需要同時分析，可以一次上傳所有檔案。'
        '每張訂單的格式可以不同，系統會分別處理每個檔案的欄位對應。', style_body_just))

    story.append(Spacer(1, 3*mm))
    story.append(step_box(1, '選擇多個檔案',
        '在訂單匯入視窗中，點擊選擇檔案時按住 Ctrl（或 Shift）鍵即可多選。'
        '也可以多次拖曳檔案到上傳區域。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(2, '逐一確認欄位',
        '系統會為每個檔案顯示獨立的欄位對應區域。請確認每個檔案的 SKU 和數量欄位是否正確。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(3, '系統自動合併',
        '點擊「確認匯入」後，系統會將所有檔案的訂單項目合併。'
        '相同 SKU 的訂單量會自動加總。', BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(step_box(4, '移除不需要的檔案',
        '如果某個檔案上傳錯誤，可以點擊該檔案右上方的「✕」按鈕將其移除。', ORANGE))

    story.append(Spacer(1, 5*mm))

    # 5.3 Column Mapping
    story.append(Paragraph('5.3 欄位對應', style_h2))

    story.append(Paragraph(
        '上傳訂單後，系統會顯示每個檔案的欄位對應區域，包含以下內容：', style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('• <b>檔案名稱：</b>顯示上傳的檔案名稱，右側有移除按鈕 (✕)', style_body))
    story.append(Paragraph('• <b>SKU 欄位下拉選單：</b>列出檔案中所有欄位，系統已自動選擇最可能的 SKU 欄位。'
        '每個選項會顯示欄位名稱和範例值（例如「Item Code (例: WU78157AA)」）。', style_body))
    story.append(Paragraph('• <b>數量欄位下拉選單：</b>同樣列出所有欄位，系統已自動選擇最可能的數量欄位。', style_body))
    story.append(Paragraph('• <b>預覽表格：</b>顯示檔案前 3 行資料，被選為 SKU 的欄位會以藍色標記，'
        '被選為數量的欄位會以綠色標記。', style_body))

    story.append(Spacer(1, 3*mm))
    story.append(info_box(
        '<b>如何確認欄位正確：</b><br/>'
        '查看預覽表格中標記為藍色（SKU）的欄位，值應該是類似 WU78157AA 的短編號。<br/>'
        '標記為綠色（數量）的欄位，值應該是數字。<br/>'
        '如果不正確，從下拉選單中選擇正確的欄位即可。',
        LIGHT_BLUE, BLUE))

    story.append(PageBreak())

    # 5.4 Analysis Results
    story.append(Paragraph('5.4 分析結果說明', style_h2))

    story.append(Paragraph(
        '匯入訂單後，系統會顯示完整的分析結果頁面。頁面由上到下分為以下幾個部分：', style_body))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('一、摘要統計列', style_h3))
    story.append(Paragraph(
        '顯示訂單的整體分析結果，包括各類別的數量：', style_body))
    story.append(Spacer(1, 1*mm))

    summary_items = [
        ['類別', '顏色', '說明'],
        ['安全', '綠色', '訂單後結餘 ≥ 0，庫存充足'],
        ['需出貨', '藍色', '訂單後結餘 < 0，但總庫存 Q 足夠補充，需從工廠出貨'],
        ['需生產', '紅色', '訂單後結餘 < 0，且總庫存 Q 不足以補充，需要安排生產'],
        ['需注意', '黃色', '訂單後結餘 ≥ 0，但該產品本身有生產狀態標記'],
        ['不再銷售', '橘色', '訂單中的 SKU 在系統的「不再銷售」清單中'],
        ['找不到', '灰色', '訂單中的 SKU 在系統中找不到對應的產品'],
    ]
    story.append(make_table(summary_items[0], summary_items[1:], col_widths=[30*mm, 20*mm, 115*mm]))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('二、分類卡片', style_h3))
    story.append(Paragraph(
        '在摘要列下方有三張卡片，分別列出需要關注的訂單項目：', style_body))
    story.append(Spacer(1, 1*mm))

    card_items = [
        ['卡片', '內容'],
        ['🏭 需要生產', '列出需要安排生產的項目，顯示缺口數量（不足的數量）'],
        ['📦 需要出貨', '列出需要從工廠出貨的項目，顯示可出貨數量'],
        ['⚠️ 需注意', '列出雖然庫存足夠，但有生產狀態標記的項目，顯示預估用完週數'],
    ]
    story.append(make_table(card_items[0], card_items[1:], col_widths=[35*mm, 130*mm]))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        '每個項目卡片中顯示以下資訊：', style_body))
    story.append(Paragraph('• <b>SKU 編號</b>和產品名稱', style_body))
    story.append(Paragraph('• <b>訂單數量</b>和結餘變化（原結餘 → 訂單後結餘）', style_body))
    story.append(Paragraph('• <b>廠庫數量</b>（總庫存 Q）', style_body))
    story.append(Paragraph('• <b>行動建議</b>（需生產數量 / 可出貨數量 / 預估用完週數）', style_body))
    story.append(Paragraph('• <b>各廠庫存</b>（惠陽 / 印尼 / 緬甸）', style_body))
    story.append(Paragraph('• <b>不再銷售標記</b>（如有）', style_body))
    story.append(Paragraph('• <b>生產狀態標籤</b>（需判斷 / 有貨可出 / 需要生產）', style_body))

    story.append(Spacer(1, 3*mm))
    story.append(info_box(
        '<b>點擊卡片中的項目：</b>點擊任何一個訂單項目，會彈出該產品的完整詳情視窗，'
        '顯示所有庫存、銷售、生產資訊。',
        LIGHT_BLUE, BLUE))

    story.append(PageBreak())

    story.append(Paragraph('三、找不到的 SKU', style_h3))
    story.append(Paragraph(
        '如果訂單中有系統找不到的 SKU，會在卡片下方顯示「找不到的 SKU」區塊。'
        '每個找不到的 SKU 會顯示編號、訂單數量，如果該 SKU 在「不再銷售」清單中，'
        '會額外標記「不再銷售」標籤。', style_body))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('四、詳細清單表格', style_h3))
    story.append(Paragraph(
        '頁面最下方是完整的訂單分析表格，列出所有訂單項目的詳細數據：', style_body))
    story.append(Spacer(1, 1*mm))

    table_cols = [
        ['欄位', '說明'],
        ['狀態', '✓ 安全 / 出 需出貨 / 產 需生產'],
        ['SKU', '產品編號'],
        ['產品名稱', '產品中文名稱'],
        ['訂單量', '客戶訂單中的數量'],
        ['當前結餘 J', '目前的庫存結餘 (G - H + I)'],
        ['訂單後結餘', '扣除訂單後的結餘 (J - 訂單量)'],
        ['總庫存 Q', '所有工廠的生產庫存總和'],
        ['生產狀態', '需判斷 / 有貨可出 / 需要生產'],
        ['預估用完', '依照銷售率預估的可用週數'],
        ['缺口', '需生產的數量（不足部分）'],
    ]
    story.append(make_table(table_cols[0], table_cols[1:], col_widths=[30*mm, 135*mm]))

    story.append(Spacer(1, 4*mm))

    # 5.5 Sorting
    story.append(Paragraph('5.5 表格排序', style_h2))

    story.append(Paragraph(
        '詳細清單表格支援多欄位排序，方便您從不同角度查看分析結果：', style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('• 點擊表頭中帶有 <b>⇅</b> 圖示的欄位名稱即可排序', style_body))
    story.append(Paragraph('• 第一次點擊：降序排列（由大到小）', style_body))
    story.append(Paragraph('• 再次點擊同一欄位：升序排列（由小到大）', style_body))
    story.append(Paragraph('• 目前排序的欄位會以藍色高亮顯示，並顯示 ▲（升序）或 ▼（降序）圖示', style_body))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('可排序的欄位：', style_h3))

    sort_items = [
        ['欄位', '排序方式'],
        ['訂單量', '按客戶訂購數量大小排列'],
        ['當前結餘 J', '按目前庫存結餘排列，可快速找出庫存最低的產品'],
        ['訂單後結餘', '按扣除訂單後的結餘排列，找出訂單影響最大的產品'],
        ['總庫存 Q', '按總生產庫存排列'],
        ['生產狀態', '按狀態嚴重性排列：需要生產 → 需出貨 → 需判斷 → 有貨可出 → 無'],
        ['預估用完', '按預估可用週數排列，可找出即將缺貨的產品'],
        ['缺口', '按需生產的缺口數量排列'],
    ]
    story.append(make_table(sort_items[0], sort_items[1:], col_widths=[35*mm, 130*mm]))

    story.append(PageBreak())

    # ===== 6. DATA MANAGEMENT =====
    story.append(Paragraph('六、資料管理', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    story.append(Paragraph(
        '點擊畫面右上方的「💾 資料管理」按鈕，可以開啟資料管理視窗。'
        '此功能提供以下操作：', style_body_just))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('匯出備份', style_h3))
    story.append(Paragraph(
        '點擊「下載備份 JSON」按鈕，系統會將所有資料（產品、庫存、貨櫃、快照）'
        '匯出為一個 JSON 檔案。可用於備份或轉移到其他電腦。', style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('匯入備份', style_h3))
    story.append(Paragraph(
        '點擊「選擇 JSON 檔案」，選擇之前匯出的備份檔案，系統會還原所有資料。'
        '<b>注意：此操作會覆蓋目前的所有資料。</b>', style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('重新初始化', style_h3))
    story.append(Paragraph(
        '上傳新的 USI 總檔 Excel 來更新產品資料。系統會保留每週匯入的庫存數據，'
        '只更新產品基本資料（品名、各廠庫存等）。', style_body))

    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('清除所有資料', style_h3))
    story.append(Paragraph(
        '清除瀏覽器中的所有庫存資料。<b>此操作無法復原，請謹慎使用。</b>'
        '清除後需要重新上傳總檔初始化。', style_body))

    story.append(Spacer(1, 4*mm))
    story.append(info_box(
        '<b>建議：</b>每週匯入資料後，使用「下載備份 JSON」保存一份備份。'
        '如果資料出現問題，可以使用備份快速還原。',
        LIGHT_YELLOW, ORANGE))

    story.append(PageBreak())

    # ===== 7. FAQ =====
    story.append(Paragraph('七、常見問題', style_h1))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=8))

    faqs = [
        ('Q1：打開網頁後顯示歡迎畫面，之前的資料不見了？',
         '這表示瀏覽器的 localStorage 被清除了（可能是清理快取、或使用了隱私模式）。'
         '請重新上傳 USI 總檔 Excel 初始化。如果有備份 JSON 檔案，'
         '可以使用「資料管理」中的「匯入備份」功能還原。'),

        ('Q2：每週資料要從哪裡取得？',
         '系統提供兩個匯入按鈕：\n'
         '• 「📥 匯入週資料」：用於上傳 USI 總檔（多分頁 Excel）\n'
         '• 「🇺🇸 美國週報」：用於上傳美國辦公室每週傳來的 QuickBooks 檔案\n'
         '（欄位為 Item / Quantity On Purchase Order / Quantity On Sales Order / Quantity On Hand）\n'
         '兩種方式都會更新 G/H/I 數值，選擇對應的按鈕上傳即可。'),

        ('Q3：匯入週資料時出現「此檔案可能不是 USI 週報」怎麼辦？',
         '系統偵測到檔案中的項目與現有產品編號吻合率過低。'
         '請確認您上傳的是正確的週報檔案。如果您要匯入的是客戶訂單，'
         '請改用「訂單分析」功能。'),

        ('Q4：訂單分析時系統沒有自動抓到正確的 SKU 和數量欄位？',
         '如果系統自動偵測的欄位不正確，您可以在「欄位對應」區域手動選擇。'
         '從下拉選單中選擇正確的 SKU 欄位和數量欄位即可。'
         '查看預覽表格中標記為藍色的欄位確認是否為 SKU。'),

        ('Q5：同事想在另一台電腦上使用，要怎麼做？',
         '方法一：在同事的電腦上打開網址，重新上傳 USI 總檔 Excel 初始化。\n'
         '方法二：使用「資料管理」中的「下載備份 JSON」匯出您的資料，'
         '將 JSON 檔案傳給同事，同事在「資料管理」中「匯入備份」即可。\n'
         '<b>注意：不同電腦的資料不會自動同步。</b>'),

        ('Q6：訂單中有系統找不到的 SKU 怎麼辦？',
         '系統會在分析結果下方顯示「找不到的 SKU」清單。請檢查 SKU 編號是否正確，'
         '或確認該產品是否已存在於 USI 總檔中。'
         '如果該 SKU 在「不再銷售」清單中，系統會自動標記。'),

        ('Q7：可以同時使用多個篩選條件嗎？',
         '可以。「庫存狀態」和「生產判斷」兩組篩選可以同時使用。'
         '例如同時選擇「🔴 緊急」和「🔍 需判斷生產」，會顯示同時符合兩個條件的產品。'),

        ('Q8：資料會被上傳到伺服器嗎？',
         '不會。所有資料都儲存在您瀏覽器的 localStorage 中，不會上傳到任何伺服器。'
         '只有您自己能看到您的資料。'),
    ]

    for q, a in faqs:
        q_style = ParagraphStyle('FAQ_Q', fontName='MSYH-Bold', fontSize=11,
            textColor=DARK_BLUE, alignment=TA_LEFT, leading=16, spaceAfter=3)
        a_style = ParagraphStyle('FAQ_A', fontName='MSYH', fontSize=10.5,
            textColor=BG_DARK, alignment=TA_LEFT, leading=16, spaceAfter=8,
            leftIndent=8)
        story.append(Paragraph(q, q_style))
        story.append(Paragraph(a, a_style))

    # Build PDF
    doc.build(story, onFirstPage=cover_page, onLaterPages=header_footer)
    print(f'PDF generated: {output_path}')


if __name__ == '__main__':
    build_manual()
