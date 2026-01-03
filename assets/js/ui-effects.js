export function createMagicParticles(container) {
    if (!container) return;
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'magic-particle';

        const angle = (i / particleCount) * 360;
        const radius = 40 + Math.random() * 20;
        const x = Math.cos(angle * Math.PI / 180) * radius;
        const y = Math.sin(angle * Math.PI / 180) * radius;

        particle.style.setProperty('--x', `${x}px`);
        particle.style.setProperty('--y', `${y}px`);

        const colors = ['#ffd700', '#ffec80', '#ffab40'];
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        container.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 800);
    }
}

export function handleLogoTap(state, DOM) {
    state.logoTapCount++;

    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    if (DOM.appLogo) {
        DOM.appLogo.classList.add('is-shaking');
        setTimeout(() => {
            DOM.appLogo.classList.remove('is-shaking');
        }, 500);
    }

    createMagicParticles(DOM.logoContainer);

    if (state.logoTapCount >= 7) {
        state.logoTapCount = 0;

        const returnToApp = () => {
            if (DOM.splashScreen) {
                DOM.splashScreen.style.zIndex = '-10';
                DOM.splashScreen.style.display = 'none';
            }
        };

        if (DOM.splashText) {
            DOM.splashText.style.display = 'block';
            DOM.splashText.classList.remove('animating-out');
        }
        if (DOM.tapToBegin) {
            DOM.tapToBegin.style.display = 'block';
            DOM.tapToBegin.classList.remove('hiding');
        }
        if (DOM.splashLoading) {
            DOM.splashLoading.style.display = 'none';
        }

        if (DOM.splashScreen) {
            DOM.splashScreen.style.display = 'flex';
            DOM.splashScreen.style.zIndex = '100';
            DOM.splashScreen.style.cursor = 'pointer';
            DOM.splashScreen.addEventListener('click', returnToApp, { once: true });
        }
    }
}
