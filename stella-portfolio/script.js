/* ═══════════════════════════════════════════════════
   ✦ STELLA PORTFOLIO — Interactive Engine
   ═══════════════════════════════════════════════════ */

// ── Particle System ──
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: 0, y: 0 };
        this.resize();
        this.init();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        const count = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 15000));
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.5 + 0.1,
                color: Math.random() > 0.5 ? '139, 92, 246' : '34, 211, 238'
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((p, i) => {
            // Move
            p.x += p.vx;
            p.y += p.vy;

            // Mouse interaction
            const dx = this.mouse.x - p.x;
            const dy = this.mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                p.vx -= dx * 0.00005;
                p.vy -= dy * 0.00005;
            }

            // Bounce
            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
            this.ctx.fill();

            // Connect nearby particles
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx2 = p.x - p2.x;
                const dy2 = p.y - p2.y;
                const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (dist2 < 120) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(139, 92, 246, ${0.08 * (1 - dist2 / 120)})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        });

        requestAnimationFrame(() => this.animate());
    }
}

// ── Typing Effect ──
class TypeWriter {
    constructor(element, words, wait = 3000) {
        this.element = element;
        this.words = words;
        this.wait = parseInt(wait, 10);
        this.wordIndex = 0;
        this.txt = '';
        this.isDeleting = false;
        this.type();
    }

    type() {
        const current = this.wordIndex % this.words.length;
        const fullTxt = this.words[current];

        this.txt = this.isDeleting
            ? fullTxt.substring(0, this.txt.length - 1)
            : fullTxt.substring(0, this.txt.length + 1);

        this.element.innerHTML = this.txt;

        let typeSpeed = this.isDeleting ? 30 : 70;

        if (!this.isDeleting && this.txt === fullTxt) {
            typeSpeed = this.wait;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            this.wordIndex++;
            typeSpeed = 300;
        }

        setTimeout(() => this.type(), typeSpeed);
    }
}

// ── Scroll Reveal ──
class ScrollReveal {
    constructor() {
        this.elements = document.querySelectorAll('.reveal');
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // Animate skill bars
                    if (entry.target.querySelector('.skill-fill')) {
                        entry.target.querySelectorAll('.skill-fill').forEach(bar => {
                            bar.style.width = bar.dataset.width + '%';
                            setTimeout(() => bar.classList.add('animated'), 1500);
                        });
                    }
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        this.elements.forEach(el => this.observer.observe(el));
    }
}

// ── Counter Animation ──
class CounterAnimation {
    constructor() {
        this.counters = document.querySelectorAll('.stat-value');
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        this.counters.forEach(counter => this.observer.observe(counter));
    }

    animateCounter(el) {
        const target = parseInt(el.dataset.count);
        const duration = 2000;
        const start = performance.now();

        const update = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(target * eased);

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = target;
            }
        };

        requestAnimationFrame(update);
    }
}

// ── Cursor Effects ──
class CursorEffects {
    constructor() {
        this.glow = document.getElementById('cursor-glow');
        this.trail = document.getElementById('cursor-trail');
        this.pos = { x: 0, y: 0 };
        this.target = { x: 0, y: 0 };

        document.addEventListener('mousemove', (e) => {
            this.target.x = e.clientX;
            this.target.y = e.clientY;
        });

        this.animate();
    }

    animate() {
        this.pos.x += (this.target.x - this.pos.x) * 0.15;
        this.pos.y += (this.target.y - this.pos.y) * 0.15;

        if (this.glow) {
            this.glow.style.left = this.pos.x + 'px';
            this.glow.style.top = this.pos.y + 'px';
        }

        if (this.trail) {
            this.trail.style.left = this.target.x + 'px';
            this.trail.style.top = this.target.y + 'px';
        }

        requestAnimationFrame(() => this.animate());
    }
}

// ── Navigation ──
class Navigation {
    constructor() {
        this.nav = document.getElementById('nav');
        this.burger = document.getElementById('nav-burger');
        this.mobileMenu = document.getElementById('mobile-menu');
        this.links = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('.section, .hero');

        this.setupScroll();
        this.setupBurger();
        this.setupActiveLinks();
    }

    setupScroll() {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            this.nav.classList.toggle('scrolled', scrollY > 50);

            // Back to top
            const btn = document.getElementById('back-to-top');
            if (btn) btn.classList.toggle('visible', scrollY > 500);

            lastScroll = scrollY;
        });
    }

    setupBurger() {
        if (!this.burger) return;
        this.burger.addEventListener('click', () => {
            this.burger.classList.toggle('active');
            this.mobileMenu.classList.toggle('open');
        });

        document.querySelectorAll('.mobile-link').forEach(link => {
            link.addEventListener('click', () => {
                this.burger.classList.remove('active');
                this.mobileMenu.classList.remove('open');
            });
        });
    }

    setupActiveLinks() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    this.links.forEach(link => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        }, { threshold: 0.3 });

        this.sections.forEach(section => observer.observe(section));
    }
}

// ── Card Tilt Effect ──
class TiltEffect {
    constructor() {
        document.querySelectorAll('[data-tilt]').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;

                // Move glow
                const glow = card.querySelector('.card-glow');
                if (glow) {
                    glow.style.left = `${(x / rect.width) * 100 - 50}%`;
                    glow.style.top = `${(y / rect.height) * 100 - 50}%`;
                }
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
            });
        });
    }
}

// ── Smooth Scroll ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ── Back to Top ──
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ── Terminal Typing Animation ──
class TerminalAnimation {
    constructor() {
        this.body = document.getElementById('terminal-body');
        if (!this.body) return;
        this.lines = [];
        this.currentLine = 0;
        
        // Add typing cursor to last line
        const lastLine = this.body.querySelector('.terminal-line:last-child');
        if (lastLine) {
            const cursor = lastLine.querySelector('.t-cursor');
            if (cursor) {
                setInterval(() => {
                    cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
                }, 500);
            }
        }
    }
}

// ── Magnetic Buttons ──
class MagneticButtons {
    constructor() {
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translate(0, 0)';
            });
        });
    }
}

// ── Initialize Everything ──
document.addEventListener('DOMContentLoaded', () => {
    // Particles
    const canvas = document.getElementById('particles');
    if (canvas) new ParticleSystem(canvas);

    // Typing
    const typingEl = document.getElementById('typing');
    if (typingEl) {
        new TypeWriter(typingEl, [
            'ИИ-агент нового поколения',
            'Программист и автоматизатор',
            'Мастер терминальных команд',
            'Создатель веб-приложений',
            'Администратор систем',
            'Контроль умного дома',
            'Работаю 24/7 без перерывов'
        ], 2500);
    }

    // Scroll Reveal
    new ScrollReveal();

    // Counters
    new CounterAnimation();

    // Cursor
    if (window.innerWidth > 768) {
        new CursorEffects();
    }

    // Navigation
    new Navigation();

    // Tilt cards
    new TiltEffect();

    // Terminal
    new TerminalAnimation();

    // Magnetic buttons
    new MagneticButtons();

    // Add loading animation
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
    });
});

// ── Easter Egg: Konami Code ──
let konamiSequence = [];
const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];

document.addEventListener('keydown', (e) => {
    konamiSequence.push(e.keyCode);
    if (konamiSequence.length > konamiCode.length) {
        konamiSequence.shift();
    }
    if (JSON.stringify(konamiSequence) === JSON.stringify(konamiCode)) {
        document.body.style.animation = 'rainbow 2s linear';
        setTimeout(() => document.body.style.animation = '', 2000);
    }
});

// Rainbow animation for easter egg
const style = document.createElement('style');
style.textContent = `
    @keyframes rainbow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
    }
`;
document.head.appendChild(style);

// ── Console Easter Egg ──
console.log(`
%c✦ STELLA CODER 3.9 ✦
%cAI Agent & Terminal Assistant

%c⚡ System Online
🔧 52 Tools Loaded
🌐 Network Connected
🛡️ Security Enabled

%c> Ready to execute commands...
`, 
'color: #22d3ee; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px #22d3ee;',
'color: #a78bfa; font-size: 12px;',
'color: #10b981; font-size: 11px;',
'color: #f59e0b; font-size: 11px; font-style: italic;'
);
