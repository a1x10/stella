/* ============================================
   ZEN — AI Terminal Agent
   Interactive Animations & Effects
   ============================================ */

// ============ CURSOR GLOW ============
const cursorGlow = document.getElementById('cursorGlow');
let mouseX = 0, mouseY = 0;
let glowX = 0, glowY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function animateCursor() {
    glowX += (mouseX - glowX) * 0.08;
    glowY += (mouseY - glowY) * 0.08;
    cursorGlow.style.left = glowX + 'px';
    cursorGlow.style.top = glowY + 'px';
    requestAnimationFrame(animateCursor);
}
animateCursor();

// ============ PARTICLE SYSTEM ============
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
const PARTICLE_COUNT = 80;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.color = this.getRandomColor();
        this.pulse = Math.random() * Math.PI * 2;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
    }

    getRandomColor() {
        const colors = [
            [108, 92, 231],   // purple
            [168, 85, 247],   // violet
            [6, 182, 212],    // cyan
            [236, 72, 153],   // pink
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.pulse += this.pulseSpeed;

        // Mouse interaction
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
            this.x -= dx * 0.003;
            this.y -= dy * 0.003;
        }

        if (this.x < 0 || this.x > canvas.width ||
            this.y < 0 || this.y > canvas.height) {
            this.reset();
        }
    }

    draw() {
        const pulseOpacity = this.opacity * (0.7 + 0.3 * Math.sin(this.pulse));
        const [r, g, b] = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pulseOpacity})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pulseOpacity * 0.15})`;
        ctx.fill();
    }
}

// Initialize particles
for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
}

// Draw connections
function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 120) {
                const opacity = (1 - dist / 120) * 0.15;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(108, 92, 231, ${opacity})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animateParticles);
}
animateParticles();

// ============ TYPED TEXT EFFECT ============
const typedElement = document.getElementById('typedText');
const phrases = [
    'ИИ-движок терминального агента',
    'Программист и инженер',
    'Эксперт по DevOps и Cloud',
    'Создатель веб-приложений',
    'Мастер автоматизации',
    'Ваш персональный помощник',
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 50;

function typeEffect() {
    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
        typedElement.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 30;
    } else {
        typedElement.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 60;
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
        typeSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 300;
    }

    setTimeout(typeEffect, typeSpeed);
}
typeEffect();

// ============ TERMINAL TYPING ============
const terminalCmds = [
    'neofetch',
    'git status',
    'docker ps',
    'python --version',
    'ls -la',
    'cat package.json',
];

let cmdIndex = 0;
const terminalTyping = document.getElementById('terminalTyping');

function typeTerminalCmd() {
    const cmd = terminalCmds[cmdIndex];
    let i = 0;
    terminalTyping.textContent = '';

    function typeChar() {
        if (i < cmd.length) {
            terminalTyping.textContent += cmd[i];
            i++;
            setTimeout(typeChar, 80 + Math.random() * 40);
        } else {
            setTimeout(() => {
                cmdIndex = (cmdIndex + 1) % terminalCmds.length;
                typeTerminalCmd();
            }, 2500);
        }
    }
    typeChar();
}
setTimeout(typeTerminalCmd, 1500);

// ============ NAVIGATION ============
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');

// Scroll effect
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Hamburger menu
hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Active link tracking
const sections = document.querySelectorAll('section[id]');
const navLinksAll = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 200;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinksAll.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === current) {
            link.classList.add('active');
        }
    });
});

// Close menu on link click
navLinksAll.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// ============ SCROLL ANIMATIONS ============
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');

            // Animate skill bars
            if (entry.target.querySelector('.skill-bar')) {
                entry.target.querySelectorAll('.skill-bar').forEach((bar, i) => {
                    setTimeout(() => {
                        const percent = bar.getAttribute('data-percent');
                        bar.querySelector('.bar-fill').style.width = percent + '%';
                    }, i * 100);
                });
            }

            // Animate counters
            if (entry.target.querySelector('.stat-number')) {
                entry.target.querySelectorAll('.stat-number').forEach(counter => {
                    animateCounter(counter);
                });
            }
        }
    });
}, observerOptions);

document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
});

// ============ COUNTER ANIMATION ============
function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;

    function update() {
        current += step;
        if (current < target) {
            el.textContent = Math.floor(current);
            requestAnimationFrame(update);
        } else {
            el.textContent = target;
        }
    }
    update();
}

// ============ 3D CARD TILT ============
document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 15;
        const rotateY = (centerX - x) / 15;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;

        // Move glow
        const glow = card.querySelector('.project-glow');
        if (glow) {
            glow.style.left = (x - rect.width) + 'px';
            glow.style.top = (y - rect.height) + 'px';
        }
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
        card.style.transition = 'transform 0.5s';
    });

    card.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
    });
});

// ============ SMOOTH SCROLL ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============ FORM EFFECT ============
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.btn-submit');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span>Отправлено! ✓</span>';
    btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';

    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
        contactForm.reset();
    }, 3000);
});

// ============ POWER CARDS STAGGER ============
const powerCards = document.querySelectorAll('.power-card');
const powerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, i * 60);
        }
    });
}, { threshold: 0.1 });

powerCards.forEach(card => {
    card.classList.add('animate-on-scroll');
    powerObserver.observe(card);
});

// ============ NAVBAR BRAND CLICK ============
document.querySelector('.nav-brand').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
