const ___guard___ = process.env.STELLA_FINGERPRINT || (() => {
  try {
    const crypto = require("crypto") || await import("node:crypto")
    const fs = require("fs") || await import("node:fs")
    const p = require("path") || await import("node:path")
    const expect = "fce680ab2cc467b6e072b8b5df1996b2"
    const h = crypto.createHash("sha256").update(__filename + "stella-vault").digest("hex")
    if (h.slice(0, 8) !== expect.slice(0, 8)) {
      console.error("\u26a0\ufe0f Code integrity check failed")
    }
  } catch(e) {  }
  return true
})()
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
const PRESENTATION_THEMES = {
  modern: {
    name: "Modern Dark",
    primary: "#22c55e",
    secondary: "#3b82f6",
    background: "#0a0a0f",
    surface: "#111118",
    text: "#f8fafc",
    muted: "#94a3b8",
    accent: "#22c55e",
  },
  elegant: {
    name: "Elegant Light",
    primary: "#1e293b",
    secondary: "#64748b",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#64748b",
    accent: "#3b82f6",
  },
  creative: {
    name: "Creative Purple",
    primary: "#8b5cf6",
    secondary: "#ec4899",
    background: "#0f0a1a",
    surface: "#1a1025",
    text: "#f8fafc",
    muted: "#a78bfa",
    accent: "#8b5cf6",
  },
  minimal: {
    name: "Minimal Clean",
    primary: "#000000",
    secondary: "#525252",
    background: "#ffffff",
    surface: "#fafafa",
    text: "#171717",
    muted: "#737373",
    accent: "#000000",
  },
  tech: {
    name: "Tech Blue",
    primary: "#0ea5e9",
    secondary: "#06b6d4",
    background: "#0c1222",
    surface: "#131c31",
    text: "#f1f5f9",
    muted: "#64748b",
    accent: "#0ea5e9",
  },
}
const SLIDE_TEMPLATES = {
  title: (content, theme) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title}</title>
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            color: ${theme.text};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .slide {
            width: 1280px;
            height: 720px;
            padding: 80px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }
        .slide::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, ${theme.accent}15 0%, transparent 70%);
        }
        .slide::after {
            content: '';
            position: absolute;
            bottom: -30%;
            left: -30%;
            width: 80%;
            height: 80%;
            background: radial-gradient(circle, ${theme.secondary}10 0%, transparent 70%);
        }
        .content { position: relative; z-index: 1; }
        h1 {
            font-size: 72px;
            font-weight: 800;
            line-height: 1.1;
            margin-bottom: 24px;
            background: linear-gradient(135deg, ${theme.text} 0%, ${theme.muted} 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            font-size: 28px;
            color: ${theme.muted};
            font-weight: 400;
            max-width: 600px;
        }
        .author {
            position: absolute;
            bottom: 60px;
            left: 80px;
            font-size: 18px;
            color: ${theme.muted};
        }
        .date {
            position: absolute;
            bottom: 60px;
            right: 80px;
            font-size: 16px;
            color: ${theme.muted};
        }
        .accent-line {
            width: 80px;
            height: 4px;
            background: linear-gradient(90deg, ${theme.accent}, ${theme.secondary});
            border-radius: 2px;
            margin-bottom: 32px;
        }
    </style>
</head>
<body>
    <div class="slide">
        <div class="content">
            <div class="accent-line"></div>
            <h1>${content.title}</h1>
            <p class="subtitle">${content.subtitle || ''}</p>
        </div>
        <div class="author">${content.author || ''}</div>
        <div class="date">${content.date || new Date().toLocaleDateString('ru-RU')}</div>
    </div>
</body>
</html>`,
  content: (content, theme) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            color: ${theme.text};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .slide {
            width: 1280px;
            height: 720px;
            padding: 80px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            position: relative;
        }
        .slide-number {
            position: absolute;
            top: 40px;
            right: 60px;
            font-size: 14px;
            color: ${theme.muted};
        }
        h2 {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 40px;
            color: ${theme.text};
        }
        .content-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .content-item {
            padding: 24px;
            background: ${theme.surface};
            border-radius: 16px;
            border: 1px solid ${theme.muted}20;
        }
        .content-item h3 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 12px;
            color: ${theme.accent};
        }
        .content-item p {
            font-size: 16px;
            line-height: 1.6;
            color: ${theme.muted};
        }
        .bullet-list {
            list-style: none;
            padding: 0;
        }
        .bullet-list li {
            font-size: 20px;
            line-height: 1.8;
            padding-left: 24px;
            position: relative;
            color: ${theme.text};
        }
        .bullet-list li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 8px;
            height: 8px;
            background: ${theme.accent};
            border-radius: 50%;
        }
    </style>
</head>
<body>
    <div class="slide">
        <div class="slide-number">${content.slideNumber || ''}</div>
        <h2>${content.title}</h2>
        ${content.items ? `
        <ul class="bullet-list">
            ${content.items.map(item => `<li>${item}</li>`).join('\n            ')}
        </ul>` : ''}
        ${content.grid ? `
        <div class="content-grid">
            ${content.grid.map(item => `
            <div class="content-item">
                <h3>${item.title}</h3>
                <p>${item.text}</p>
            </div>`).join('')}
        </div>` : ''}
    </div>
</body>
</html>`,
  twoColumn: (content, theme) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            color: ${theme.text};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .slide {
            width: 1280px;
            height: 720px;
            padding: 80px;
            display: flex;
            gap: 60px;
            position: relative;
        }
        .column {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .left-column {
            border-right: 1px solid ${theme.muted}30;
            padding-right: 60px;
        }
        h2 {
            font-size: 42px;
            font-weight: 700;
            margin-bottom: 24px;
            line-height: 1.2;
        }
        .description {
            font-size: 18px;
            line-height: 1.8;
            color: ${theme.muted};
        }
        .stats {
            display: flex;
            flex-direction: column;
            gap: 32px;
        }
        .stat-item {
            text-align: center;
            padding: 24px;
            background: ${theme.surface};
            border-radius: 12px;
        }
        .stat-value {
            font-size: 48px;
            font-weight: 700;
            color: ${theme.accent};
        }
        .stat-label {
            font-size: 14px;
            color: ${theme.muted};
            margin-top: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <div class="slide">
        <div class="column left-column">
            <h2>${content.title}</h2>
            <p class="description">${content.description}</p>
        </div>
        <div class="column">
            <div class="stats">
                ${content.stats ? content.stats.map(stat => `
                <div class="stat-item">
                    <div class="stat-value">${stat.value}</div>
                    <div class="stat-label">${stat.label}</div>
                </div>`).join('') : ''}
            </div>
        </div>
    </div>
</body>
</html>`,
  quote: (content, theme) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            color: ${theme.text};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .slide {
            width: 1280px;
            height: 720px;
            padding: 80px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            position: relative;
        }
        .quote-mark {
            font-size: 120px;
            color: ${theme.accent};
            opacity: 0.3;
            line-height: 1;
            margin-bottom: -40px;
        }
        .quote-text {
            font-size: 36px;
            font-weight: 500;
            line-height: 1.6;
            max-width: 900px;
            margin-bottom: 40px;
        }
        .author {
            font-size: 18px;
            color: ${theme.muted};
        }
        .accent-line {
            width: 60px;
            height: 3px;
            background: ${theme.accent};
            margin-bottom: 40px;
        }
    </style>
</head>
<body>
    <div class="slide">
        <div class="quote-mark">"</div>
        <div class="accent-line"></div>
        <p class="quote-text">${content.quote}</p>
        <p class="author">— ${content.author || 'Unknown'}</p>
    </div>
</body>
</html>`,
  conclusion: (content, theme) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            color: ${theme.text};
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .slide {
            width: 1280px;
            height: 720px;
            padding: 80px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .slide::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, ${theme.accent}20 0%, transparent 70%);
        }
        .content { position: relative; z-index: 1; }
        h2 {
            font-size: 64px;
            font-weight: 800;
            margin-bottom: 24px;
            background: linear-gradient(135deg, ${theme.text} 0%, ${theme.accent} 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            font-size: 24px;
            color: ${theme.muted};
            margin-bottom: 48px;
        }
        .cta-buttons {
            display: flex;
            gap: 24px;
        }
        .cta-button {
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
        }
        .cta-primary {
            background: ${theme.accent};
            color: ${theme.background};
        }
        .cta-secondary {
            background: transparent;
            color: ${theme.text};
            border: 2px solid ${theme.muted}40;
        }
    </style>
</head>
<body>
    <div class="slide">
        <div class="content">
            <h2>${content.title || 'Спасибо!'}</h2>
            <p class="subtitle">${content.subtitle || 'Вопросы?'}</p>
            <div class="cta-buttons">
                ${content.cta ? content.cta.map(btn => `
                <a class="cta-button ${btn.primary ? 'cta-primary' : 'cta-secondary'}">${btn.text}</a>`).join('') : ''}
            </div>
        </div>
    </div>
</body>
</html>`,
}
export function generatePresentation(config) {
  const {
    title,
    author,
    slides,
    theme = "modern",
    outputDir = "presentation",
  } = config
  const selectedTheme = PRESENTATION_THEMES[theme] || PRESENTATION_THEMES.modern
  const output = path.resolve(process.cwd(), outputDir)
  fs.mkdirSync(output, { recursive: true })
  const htmlSlides = []
  htmlSlides.push(SLIDE_TEMPLATES.title({
    title,
    author,
    subtitle: slides[0]?.subtitle || '',
    date: new Date().toLocaleDateString('ru-RU'),
  }, selectedTheme))
  slides.forEach((slide, index) => {
    const template = SLIDE_TEMPLATES[slide.type] || SLIDE_TEMPLATES.content
    htmlSlides.push(template({
      ...slide,
      slideNumber: `${index + 1} / ${slides.length}`,
    }, selectedTheme))
  })
  htmlSlides.push(SLIDE_TEMPLATES.conclusion({
    title: "Спасибо!",
    subtitle: "Вопросы?",
    cta: [
      { text: "Начать использовать", primary: true },
      { text: "Узнать больше", primary: false },
    ],
  }, selectedTheme))
  const indexHtml = createPresentationIndex(title, htmlSlides, selectedTheme)
  fs.writeFileSync(path.join(output, "index.html"), indexHtml)
  htmlSlides.forEach((html, index) => {
    fs.writeFileSync(path.join(output, `slide-${String(index + 1).padStart(2, '0')}.html`), html)
  })
  fs.writeFileSync(path.join(output, "README.md"), `# ${title}
## Презентация
Эта презентация содержит ${htmlSlides.length} слайдов.
### Просмотр
Откройте \`index.html\` в браузере для просмотра презентации.
### Навигация
- Используйте клавиши ← → для навигации
- Нажмите F11 для полноэкранного режима
### Тема
${selectedTheme.name}
### Цвета
- Primary: ${selectedTheme.primary}
- Secondary: ${selectedTheme.secondary}
- Accent: ${selectedTheme.accent}
---
Создано с помощью Stella Coder
`)
  return {
    success: true,
    outputDir: output,
    slidesCount: htmlSlides.length,
    theme: selectedTheme.name,
  }
}
function createPresentationIndex(title, slides, theme) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            overflow: hidden;
        }
        .presentation {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .slide-container {
            width: 1280px;
            height: 720px;
            transform-origin: center center;
            position: relative;
        }
        .slide {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            transform: translateX(100px);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }
        .slide.active {
            opacity: 1;
            transform: translateX(0);
            pointer-events: auto;
        }
        .slide.exit {
            opacity: 0;
            transform: translateX(-100px);
        }
        .controls {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 12px;
            z-index: 1000;
        }
        .control-btn {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            border: 1px solid ${theme.muted}30;
            background: ${theme.surface};
            color: ${theme.text};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 18px;
        }
        .control-btn:hover {
            background: ${theme.accent};
            color: ${theme.background};
            transform: scale(1.1);
        }
        .control-btn:active {
            transform: scale(0.95);
        }
        .progress {
            position: fixed;
            bottom: 0;
            left: 0;
            height: 4px;
            background: linear-gradient(90deg, ${theme.accent}, ${theme.secondary});
            transition: width 0.3s ease;
        }
        .slide-counter {
            position: fixed;
            bottom: 40px;
            right: 30px;
            font-size: 14px;
            color: ${theme.muted};
        }
        .slide-thumbnails {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .slide-thumbnails.visible {
            opacity: 1;
        }
        .thumbnail {
            width: 80px;
            height: 45px;
            border: 2px solid ${theme.muted}30;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            overflow: hidden;
        }
        .thumbnail:hover {
            border-color: ${theme.accent};
            transform: scale(1.1);
        }
        .thumbnail.active {
            border-color: ${theme.accent};
            box-shadow: 0 0 10px ${theme.accent}40;
        }
        .thumbnail iframe {
            width: 1280px;
            height: 720px;
            transform: scale(0.0625);
            transform-origin: top left;
            pointer-events: none;
        }
        .slide-number {
            position: fixed;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 14px;
            color: ${theme.muted};
            background: ${theme.surface}80;
            padding: 8px 16px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        .minimap {
            position: fixed;
            top: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .minimap-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${theme.muted}40;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .minimap-dot:hover {
            background: ${theme.accent};
            transform: scale(1.5);
        }
        .minimap-dot.active {
            background: ${theme.accent};
        }
    </style>
</head>
<body>
    <div class="presentation">
        <div class="slide-container" id="slideContainer">
            ${slides.map((slide, i) => `
            <div class="slide ${i === 0 ? 'active' : ''}" id="slide${i + 1}">
                <iframe src="slide-${String(i + 1).padStart(2, '0')}.html" width="1280" height="720" frameborder="0" style="border: none;"></iframe>
            </div>`).join('')}
        </div>
    </div>
    <div class="controls">
        <button class="control-btn" onclick="prevSlide()" title="Предыдущий слайд">←</button>
        <button class="control-btn" onclick="nextSlide()" title="Следующий слайд">→</button>
        <button class="control-btn" onclick="toggleFullscreen()" title="Полноэкранный режим">⛶</button>
        <button class="control-btn" onclick="toggleThumbnails()" title="Показать превью">📷</button>
        <button class="control-btn" onclick="toggleMinimap()" title="Мини-карта">🗺</button>
    </div>
    <div class="progress" id="progress"></div>
    <div class="slide-counter" id="slideCounter">1 / ${slides.length}</div>
    <div class="slide-number" id="slideNumber">1</div>
    <div class="slide-thumbnails" id="thumbnails">
        ${slides.map((slide, i) => `
        <div class="thumbnail ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i + 1})">
            <iframe src="slide-${String(i + 1).padStart(2, '0')}.html" width="1280" height="720" frameborder="0"></iframe>
        </div>`).join('')}
    </div>
    <div class="minimap" id="minimap">
        ${slides.map((slide, i) => `
        <div class="minimap-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i + 1})" title="Слайд ${i + 1}"></div>`).join('')}
    </div>
    <script>
        let currentSlide = 1;
        const totalSlides = ${slides.length};
        let thumbnailsVisible = false;
        let minimapVisible = false;
        function showSlide(n, direction = 'next') {
            const currentEl = document.getElementById('slide' + currentSlide);
            const nextEl = document.getElementById('slide' + n);
            if (currentEl) {
                currentEl.classList.remove('active');
                currentEl.classList.add('exit');
                setTimeout(() => currentEl.classList.remove('exit'), 500);
            }
            if (nextEl) {
                nextEl.style.transform = direction === 'next' ? 'translateX(100px)' : 'translateX(-100px)';
                setTimeout(() => {
                    nextEl.classList.add('active');
                    nextEl.style.transform = '';
                }, 50);
            }
            currentSlide = n;
            updateUI();
        }
        function updateUI() {
            document.getElementById('slideCounter').textContent = currentSlide + ' / ' + totalSlides;
            document.getElementById('slideNumber').textContent = currentSlide;
            document.getElementById('progress').style.width = ((currentSlide / totalSlides) * 100) + '%';
            document.querySelectorAll('.thumbnail').forEach((t, i) => {
                t.classList.toggle('active', i + 1 === currentSlide);
            });
            document.querySelectorAll('.minimap-dot').forEach((d, i) => {
                d.classList.toggle('active', i + 1 === currentSlide);
            });
        }
        function nextSlide() {
            if (currentSlide < totalSlides) {
                showSlide(currentSlide + 1, 'next');
            }
        }
        function prevSlide() {
            if (currentSlide > 1) {
                showSlide(currentSlide - 1, 'prev');
            }
        }
        function goToSlide(n) {
            if (n >= 1 && n <= totalSlides) {
                showSlide(n, n > currentSlide ? 'next' : 'prev');
            }
        }
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
        function toggleThumbnails() {
            thumbnailsVisible = !thumbnailsVisible;
            document.getElementById('thumbnails').classList.toggle('visible', thumbnailsVisible);
        }
        function toggleMinimap() {
            minimapVisible = !minimapVisible;
            document.getElementById('minimap').style.display = minimapVisible ? 'flex' : 'none';
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'f') toggleFullscreen();
            if (e.key === 't') toggleThumbnails();
            if (e.key === 'm') toggleMinimap();
            if (e.key === 'Home') goToSlide(1);
            if (e.key === 'End') goToSlide(totalSlides);
        });
        let touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });
        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) nextSlide();
                else prevSlide();
            }
        });
        function scalePresentation() {
            const container = document.getElementById('slideContainer');
            const scaleX = window.innerWidth / 1280;
            const scaleY = window.innerHeight / 720;
            const scale = Math.min(scaleX, scaleY) * 0.9;
            container.style.transform = 'scale(' + scale + ')';
        }
        window.addEventListener('resize', scalePresentation);
        scalePresentation();
    </script>
</body>
</html>`
}
export function createPresentationFromTopic(topic, options = {}) {
  const {
    theme = "modern",
    slidesCount = 8,
    author = "",
  } = options
  const slides = generateSlideContent(topic, slidesCount)
  return generatePresentation({
    title: topic,
    author,
    slides,
    theme,
    outputDir: `presentation-${topic.toLowerCase().replace(/\s+/g, '-')}`,
  })
}
function generateSlideContent(topic, count) {
  const slides = []
  slides.push({
    type: "content",
    title: "Введение",
    items: [
      `Что такое ${topic}`,
      `Актуальность темы`,
      `Цели и задачи работы`,
      `Методы исследования`,
    ],
  })
  const sections = [
    { title: "Основные понятия", items: ["Определения", "Классификация", "Примеры"] },
    { title: "Анализ", items: ["Сравнение", "Преимущества", "Недостатки"] },
    { title: "Применение", items: ["Области использования", "Кейсы", "Практика"] },
    { title: "Технологии", items: ["Современные подходы", "Инструменты", "Решения"] },
    { title: "Результаты", items: ["Достижения", "Выводы", "Перспективы"] },
  ]
  for (let i = 0; i < Math.min(count - 3, sections.length); i++) {
    slides.push({
      type: "content",
      title: sections[i].title,
      items: sections[i].items,
    })
  }
  slides.push({
    type: "quote",
    quote: `${topic} — это ключ к успешному развитию в современном мире.`,
    author: "Исследователь",
  })
  slides.push({
    type: "content",
    title: "Заключение",
    items: [
      "Основные выводы",
      "Практическая значимость",
      "Рекомендации",
      "Направления дальнейших исследований",
    ],
  })
  return slides
}
export const PRESENTATION_COMMANDS = {
  "/presentation": "создать презентацию из темы",
  "/presentation-theme": "выбрать тему оформления",
  "/presentation-list": "показать доступные темы",
}
export const AVAILABLE_THEMES = Object.entries(PRESENTATION_THEMES).map(([key, value]) => ({
  id: key,
  name: value.name,
  colors: { primary: value.primary, accent: value.accent },
}))
export function exportToPDF(presentationDir) {
  const indexPath = path.join(presentationDir, "index.html")
  if (!fs.existsSync(indexPath)) {
    throw new Error("Индексный файл не найден")
  }
  const printHtml = createPrintVersion(presentationDir)
  const printPath = path.join(presentationDir, "print.html")
  fs.writeFileSync(printPath, printHtml)
  return {
    success: true,
    printPath,
    message: "Версия для печати создана. Используйте Ctrl+P в браузере для экспорта в PDF.",
  }
}
function createPrintVersion(presentationDir) {
  const files = fs.readdirSync(presentationDir).filter(f => f.startsWith("slide-") && f.endsWith(".html"))
  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Версия для печати</title>
    <link href="https:
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #ffffff;
            color: #000000;
        }
        .slide {
            width: 1280px;
            height: 720px;
            margin: 20px auto;
            border: 1px solid #e5e7eb;
            page-break-after: always;
            position: relative;
            overflow: hidden;
        }
        .slide:last-child {
            page-break-after: avoid;
        }
        .slide-number {
            position: absolute;
            bottom: 20px;
            right: 20px;
            font-size: 12px;
            color: #9ca3af;
        }
        @media print {
            body {
                background: white;
            }
            .slide {
                border: none;
                margin: 0;
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    ${files.map((file, i) => `
    <div class="slide">
        <iframe src="${file}" width="1280" height="720" frameborder="0" style="border: none;"></iframe>
        <div class="slide-number">${i + 1} / ${files.length}</div>
    </div>`).join('')}
</body>
</html>`
}
export function createSpeakerNotes(presentationDir, notes) {
  const notesPath = path.join(presentationDir, "speaker-notes.md")
  let content = "# Заметки докладчика\n\n"
  notes.forEach((note, i) => {
    content += `## Слайд ${i + 1}\n\n`
    content += `${note}\n\n`
  })
  fs.writeFileSync(notesPath, content)
  return {
    success: true,
    notesPath,
  }
}