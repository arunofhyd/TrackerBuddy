// UI Effects (Particles, Animations, etc.)

/**
 * Creates a particle explosion effect at the specified coordinates.
 * @param {number} x - The x-coordinate.
 * @param {number} y - The y-coordinate.
 */
export function createMagicParticles(x, y) {
    const colors = ['#FFD700', '#FF69B4', '#00BFFF', '#32CD32', '#FFA500', '#9370DB']; // Vibrant colors
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('magic-particle');
        document.body.appendChild(particle);

        const size = Math.random() * 8 + 4; // Random size
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 4 + 2;
        const tx = Math.cos(angle) * velocity * 20; // Trajectory X
        const ty = Math.sin(angle) * velocity * 20; // Trajectory Y

        // Animate using Web Animations API
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'cubic-bezier(0, .9, .57, 1)',
            fill: 'forwards'
        }).onfinish = () => particle.remove();
    }
}

/**
 * Handles the logic for tapping the logo (e.g., triggering Easter eggs).
 * @param {HTMLElement} logoElement - The logo element.
 * @param {number} tapCount - Current consecutive tap count.
 * @param {Function} resetTapCountCb - Callback to reset tap count.
 * @returns {number} - The new tap count.
 */
export function handleLogoTap(logoElement, tapCount, resetTapCountCb) {
    tapCount++;
    
    // Add a subtle bounce animation
    logoElement.classList.add('animate-bounce-short');
    setTimeout(() => logoElement.classList.remove('animate-bounce-short'), 300);

    if (tapCount === 5) {
        const rect = logoElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        createMagicParticles(centerX, centerY);
        
        // You could dispatch a custom event here if the main app needs to know
        // window.dispatchEvent(new CustomEvent('easter-egg-triggered'));
        
        tapCount = 0;
    }

    // Reset tap count if no tap for 2 seconds
    if (window.logoTapTimer) clearTimeout(window.logoTapTimer);
    window.logoTapTimer = setTimeout(() => {
        resetTapCountCb();
    }, 2000);

    return tapCount;
}

// Add CSS for particles if not present (simulating existing behavior or adding it)
const style = document.createElement('style');
style.textContent = `
    .magic-particle {
        position: fixed;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
    }
    @keyframes bounce-short {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10%); }
    }
    .animate-bounce-short {
        animation: bounce-short 0.3s ease-in-out;
    }
`;
document.head.appendChild(style);
