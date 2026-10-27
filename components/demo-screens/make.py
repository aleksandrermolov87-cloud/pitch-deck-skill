# Демо-экраны для галереи мокапов (kit/screens.js): вымышленный мобильный и веб-банк со страхованием.
# Без логотипов и брендов: шапка, карточки, кнопка акцентом, текст полосками и короткими подписями.
# Запуск: $SKILL/.venv/bin/python -I make.py  → *.png рядом со скриптом, каждый до 80 КБ.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
S = 1.5                                   # мобильный экран рисуется в точках 390 × 844 и масштабируется
BG, CARD, INK, MUTED, LINE, ACC, SOFT, OK = '#F4F4F6', '#FFFFFF', '#141414', '#8C8C92', '#E4E4E9', '#EF3124', '#FDE8E6', '#2E9E5B'
# системный шрифт с кириллицей и знаком рубля: (файл, индекс начертания в .ttc)
FONTS = [('/System/Library/Fonts/HelveticaNeue.ttc', 0), ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 0)]
FONTS_B = [('/System/Library/Fonts/HelveticaNeue.ttc', 1), ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 0)]


def font(size, bold=False, k=S):
    for f, i in (FONTS_B if bold else FONTS):
        if Path(f).exists():
            return ImageFont.truetype(f, round(size * k), index=i)
    return ImageFont.load_default(round(size * k))


class Screen:
    """Холст в логических точках: все координаты умножаются на k."""
    def __init__(self, w, h, k=S, bg=BG):
        self.k, self.im = k, Image.new('RGBA', (round(w * k), round(h * k)), bg)
        self.d = ImageDraw.Draw(self.im)

    def box(self, x, y, w, h, fill, r=0, outline=None):
        k = self.k
        self.d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + h) * k], radius=r * k, fill=fill, outline=outline, width=max(1, round(k)) if outline else 0)

    def dot(self, cx, cy, d, fill):
        k = self.k
        self.d.ellipse([(cx - d / 2) * k, (cy - d / 2) * k, (cx + d / 2) * k, (cy + d / 2) * k], fill=fill)

    def bar(self, x, y, w, h=8, fill=LINE):
        self.box(x, y, w, h, fill, r=h / 2)

    def text(self, x, y, s, size, color=INK, bold=False, anchor='la'):
        self.d.text((x * self.k, y * self.k), s, font=font(size, bold, self.k), fill=color, anchor=anchor)

    def save(self, name, round_r=0):
        im = self.im
        if round_r:                                         # скруглённые углы экрана: прозрачные пиксели
            m = Image.new('L', im.size, 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=round_r * self.k, fill=255)
            im.putalpha(m)
        q = im                                              # без палитры: тонкая разница фона и карточек сохраняется
        p = OUT / name
        q.save(p, optimize=True)
        kb = p.stat().st_size / 1024
        print(f'{name}: {im.width}×{im.height}, {kb:.0f} КБ')
        if kb > 80:
            sys.exit(f'{name} больше 80 КБ')


# ── мобильные экраны 390 × 844 ──
def status(s, title=None, back=False):
    s.text(28, 18, '9:41', 15, INK, True)
    for i, w in enumerate((18, 16, 24)):
        s.box(300 + i * 22, 20, w, 11, INK, r=3)
    if back:
        s.d.line([(34 * s.k, 70 * s.k), (24 * s.k, 80 * s.k), (34 * s.k, 90 * s.k)], fill=INK, width=round(3 * s.k))
    if title:
        s.text(195 if back else 24, 80, title, 20 if back else 28, INK, True, 'mm' if back else 'lm')


def button(s, y, label, fill=ACC, color='#FFFFFF'):
    s.box(20, y, 350, 54, fill, r=16)
    s.text(195, y + 27, label, 17, color, True, 'mm')


def tabbar(s):
    s.box(0, 770, 390, 74, CARD)
    s.d.line([(0, 770 * s.k), (390 * s.k, 770 * s.k)], fill=LINE, width=round(s.k))
    for i in range(4):
        s.box(42 + i * 92, 786, 24, 24, ACC if i == 1 else LINE, r=7)
        s.bar(36 + i * 92, 818, 36, 6, INK if i == 1 else LINE)
    s.bar(130, 830, 130, 5, INK)


def app_home():
    s = Screen(390, 844)
    status(s, 'Главная')
    s.dot(352, 80, 40, LINE)
    s.box(20, 112, 350, 132, INK, r=20)                     # карта и баланс
    s.text(40, 136, 'Счёт в рублях', 14, '#BDBDC2')
    s.text(40, 182, '128 450 ₽', 30, '#FFFFFF', True, 'lm')
    s.bar(40, 214, 120, 8, '#4A4A50')
    s.box(300, 132, 50, 34, ACC, r=8)
    s.text(24, 280, 'Страхование', 20, INK, True, 'lm')
    s.text(366, 280, 'Все', 15, ACC, False, 'rm')
    for i, (name, note, on) in enumerate((('КАСКО', 'до 14 марта', True), ('Квартира', 'до 2 июня', True), ('Путешествия', 'не оформлено', False))):
        y = 306 + i * 92
        s.box(20, y, 350, 80, CARD, r=16)
        s.box(36, y + 16, 48, 48, SOFT if on else BG, r=12)
        s.box(50, y + 30, 20, 20, ACC if on else LINE, r=5)
        s.text(100, y + 30, name, 17, INK, True, 'lm')
        s.text(100, y + 54, note, 13, MUTED, False, 'lm')
        if on:
            s.box(286, y + 26, 66, 28, BG, r=14)
            s.text(319, y + 40, 'активен', 11, OK, True, 'mm')
        else:
            s.text(352, y + 40, '+', 26, ACC, True, 'rm')
    s.box(20, 590, 350, 92, SOFT, r=16)
    s.text(40, 618, 'Полис на поездку', 16, INK, True, 'lm')
    s.bar(40, 640, 200, 8, '#F5B8B2')
    s.bar(40, 656, 150, 8, '#F5B8B2')
    s.box(286, 618, 64, 40, ACC, r=12)
    k = s.k
    s.d.line([(306 * k, 638 * k), (330 * k, 638 * k)], fill='#FFFFFF', width=round(3 * k))
    s.d.line([(322 * k, 630 * k), (330 * k, 638 * k), (322 * k, 646 * k)], fill='#FFFFFF', width=round(3 * k))
    s.bar(24, 708, 160, 10, LINE)
    s.bar(24, 728, 240, 10, LINE)
    tabbar(s)
    s.save('app-home.png', 44)


def app_quote():
    s = Screen(390, 844)
    status(s, 'КАСКО', back=True)
    s.box(20, 116, 350, 168, CARD, r=20)
    s.text(40, 144, 'Стоимость полиса', 14, MUTED, False, 'lm')
    s.text(40, 186, '38 900 ₽ в год', 28, INK, True, 'lm')
    s.box(40, 222, 150, 30, SOFT, r=15)
    s.text(115, 237, 'скидка за стаж', 12, ACC, True, 'mm')
    s.bar(40, 266, 200, 6, LINE)
    s.text(24, 318, 'Что покрывает', 18, INK, True, 'lm')
    for i, (name, on) in enumerate((('Угон и полная гибель', True), ('Ущерб в ДТП', True), ('Стёкла и фары', True), ('Эвакуатор', False))):
        y = 344 + i * 66
        s.text(24, y + 26, name, 16, INK, False, 'lm')
        s.box(312, y + 12, 54, 30, ACC if on else LINE, r=15)
        s.dot(351 if on else 327, y + 27, 24, '#FFFFFF')
        s.d.line([(24 * s.k, (y + 58) * s.k), (366 * s.k, (y + 58) * s.k)], fill=LINE, width=round(s.k))
    s.text(24, 632, 'Франшиза', 15, MUTED, False, 'lm')
    s.box(24, 652, 342, 6, LINE, r=3)
    s.box(24, 652, 120, 6, ACC, r=3)
    s.dot(144, 655, 20, '#FFFFFF')
    s.d.ellipse([134 * s.k, 645 * s.k, 154 * s.k, 665 * s.k], outline=ACC, width=round(3 * s.k))
    button(s, 700, 'Оплатить картой')
    s.bar(130, 830, 130, 5, INK)
    s.save('app-quote.png', 44)


def app_pay():
    s = Screen(390, 844)
    status(s, 'Оплата', back=True)
    s.text(195, 150, 'К оплате', 15, MUTED, False, 'mm')
    s.text(195, 192, '38 900 ₽', 36, INK, True, 'mm')
    s.text(195, 230, 'КАСКО на год', 14, MUTED, False, 'mm')
    s.text(24, 290, 'Списать с карты', 16, INK, True, 'lm')
    for i, on in enumerate((True, False)):
        y = 312 + i * 84
        s.box(20, y, 350, 72, CARD, r=16, outline=ACC if on else None)
        s.box(36, y + 18, 52, 36, INK if on else LINE, r=7)
        s.bar(104, y + 24, 120, 9, INK if on else LINE)
        s.bar(104, y + 42, 80, 7, LINE)
        s.dot(346, y + 36, 22, ACC if on else LINE)
        s.dot(346, y + 36, 9, '#FFFFFF')
    s.box(20, 500, 350, 100, CARD, r=16)
    s.text(40, 528, 'Рассрочка', 16, INK, True, 'lm')
    s.text(40, 556, 'без переплаты', 13, MUTED, False, 'lm')
    s.box(312, 514, 54, 30, LINE, r=15)
    s.dot(327, 529, 24, '#FFFFFF')
    s.bar(40, 578, 230, 7, LINE)
    button(s, 700, 'Оплатить 38 900 ₽')
    s.bar(130, 830, 130, 5, INK)
    s.save('app-pay.png', 44)


def app_policy():
    s = Screen(390, 844)
    status(s, 'Полис', back=True)
    s.dot(195, 182, 96, '#E3F4EA')
    s.d.line([(176 * s.k, 184 * s.k), (190 * s.k, 198 * s.k), (216 * s.k, 168 * s.k)], fill=OK, width=round(6 * s.k), joint='curve')
    s.text(195, 262, 'Полис оформлен', 24, INK, True, 'mm')
    s.text(195, 294, 'пришёл в приложение и на почту', 14, MUTED, False, 'mm')
    s.box(20, 330, 350, 236, CARD, r=20)
    for i, (k_, v) in enumerate((('Продукт', 'КАСКО'), ('Действует', 'до 14.03'), ('Машина', 'седан, 2023'), ('Номер', 'АА-04213'))):
        y = 360 + i * 52
        s.text(40, y, k_, 14, MUTED, False, 'lm')
        s.text(350, y, v, 15, INK, True, 'rm')
        if i < 3:
            s.d.line([(40 * s.k, (y + 26) * s.k), (350 * s.k, (y + 26) * s.k)], fill=LINE, width=round(s.k))
    s.box(20, 590, 168, 84, CARD, r=16)
    s.box(202, 590, 168, 84, CARD, r=16)
    s.box(36, 606, 32, 32, SOFT, r=9)
    s.box(218, 606, 32, 32, SOFT, r=9)
    s.text(36, 656, 'Страховой случай', 12, INK, True, 'lm')
    s.text(218, 656, 'Документы', 12, INK, True, 'lm')
    button(s, 700, 'Готово', LINE, INK)
    s.bar(130, 830, 130, 5, INK)
    s.save('app-policy.png', 44)


def app_form_old():
    s = Screen(390, 844, bg='#FFFFFF')
    status(s, 'Заявка на КАСКО', back=True)
    s.text(24, 124, 'Шаг 2 из 6: данные машины', 13, MUTED, False, 'lm')
    s.box(24, 140, 342, 4, LINE, r=2)
    s.box(24, 140, 114, 4, MUTED, r=2)
    for i, name in enumerate(('Марка', 'Модель', 'Год выпуска', 'VIN', 'Госномер', 'Серия ПТС', 'Номер ПТС', 'Пробег', 'Стоимость')):
        y = 162 + i * 60
        s.text(24, y + 8, name, 12, MUTED, False, 'lm')
        s.box(24, y + 20, 342, 32, '#FFFFFF', r=6, outline='#CFCFD6')
        s.bar(36, y + 32, 60 + (i * 37) % 110, 8, LINE)
    s.box(20, 712, 350, 50, '#D9D9DE', r=10)
    s.text(195, 737, 'Далее', 16, '#FFFFFF', True, 'mm')
    s.bar(130, 830, 130, 5, INK)
    s.save('app-form-old.png', 44)


# ── веб-кабинет 1440 × 900 (рисуется в масштабе 0,8) ──
def web_cabinet():
    s = Screen(1440, 900, k=0.8)
    s.box(0, 0, 240, 900, CARD)
    s.dot(46, 46, 36, INK)
    s.bar(76, 40, 100, 12, INK)
    for i, name in enumerate(('Обзор', 'Полисы', 'Страховые случаи', 'Платежи', 'Документы', 'Профиль')):
        y = 116 + i * 52
        if i == 1:
            s.box(16, y - 6, 208, 44, SOFT, r=10)
        s.box(32, y + 6, 20, 20, ACC if i == 1 else LINE, r=5)
        s.text(66, y + 16, name, 16, ACC if i == 1 else INK, i == 1, 'lm')
    s.text(280, 60, 'Полисы клиента', 30, INK, True, 'lm')
    s.box(1180, 38, 220, 46, ACC, r=12)
    s.text(1290, 61, 'Оформить полис', 16, '#FFFFFF', True, 'mm')
    s.box(900, 38, 260, 46, CARD, r=12, outline=LINE)
    s.bar(920, 57, 140, 9, LINE)
    for i, (k_, v, n) in enumerate((('Активных полисов', '4', 'на 3 клиентов'), ('Премия за год', '112 тыс. ₽', '+12% к прошлому'), ('Случаев в работе', '1', 'решение за 2 дня'))):
        x = 280 + i * 380
        s.box(x, 116, 360, 136, CARD, r=16)
        s.text(x + 24, 148, k_, 15, MUTED, False, 'lm')
        s.text(x + 24, 196, v, 34, INK, True, 'lm')
        s.text(x + 24, 232, n, 14, OK if i == 1 else MUTED, False, 'lm')
    s.box(280, 280, 1120, 380, CARD, r=16)
    s.text(304, 316, 'Полисы', 20, INK, True, 'lm')
    for j, h in enumerate(('Продукт', 'Объект', 'Действует до', 'Статус', 'Взнос')):
        s.text(304 + j * 220, 362, h, 14, MUTED, False, 'lm')
    rows = (('КАСКО', 'седан 2023', '14.03', 'активен'), ('Квартира', 'Москва', '02.06', 'активен'), ('ОСАГО', 'седан 2023', '14.03', 'продлить'), ('Путешествия', 'Шенген', '—', 'черновик'))
    for i, r in enumerate(rows):
        y = 404 + i * 62
        s.d.line([(304 * s.k, (y - 22) * s.k), (1376 * s.k, (y - 22) * s.k)], fill=LINE, width=1)
        for j, v in enumerate(r):
            if j == 3:
                fill, col = (('#E3F4EA', OK) if v == 'активен' else (SOFT, ACC) if v == 'продлить' else (BG, MUTED))
                s.box(304 + j * 220, y - 14, 100, 30, fill, r=15)
                s.text(354 + j * 220, y + 1, v, 13, col, True, 'mm')
            else:
                s.text(304 + j * 220, y, v, 16, INK, j == 0, 'lm')
        s.bar(1184, y - 4, 90 + i * 14, 9, LINE)
    s.box(280, 688, 548, 180, CARD, r=16)
    s.text(304, 722, 'Взносы по месяцам', 16, INK, True, 'lm')
    for i, v in enumerate((40, 52, 48, 66, 58, 74, 70, 88)):
        s.box(310 + i * 62, 846 - v, 34, v, ACC if i == 7 else '#D5D5DB', r=4)
    s.box(852, 688, 548, 180, CARD, r=16)
    s.text(876, 722, 'Страховой случай', 16, INK, True, 'lm')
    for i in range(3):
        y = 768 + i * 32
        s.dot(888, y, 14, OK if i < 2 else LINE)
        s.bar(908, y - 4, 200 - i * 30, 8, LINE)
    s.box(1220, 800, 156, 44, INK, r=10)
    s.text(1298, 822, 'Открыть', 15, '#FFFFFF', True, 'mm')
    s.save('web-cabinet.png', 0)


if __name__ == '__main__':
    for f in (app_home, app_quote, app_pay, app_policy, app_form_old, web_cabinet):
        f()
