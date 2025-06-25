/**
 * Enables a robust floating-on-scroll functionality for the ImageKit Video Player.
 * @param {any} playerInstance The instance of the ImageKit Video Player.
 */
export const enableFloatingPlayer = (playerInstance: any, floatPosition: string) => {
    if (!floatPosition || (floatPosition !== 'left' && floatPosition !== 'right')) {
        return;
    }

    const playerElement = playerInstance.el();
    const parentContainer = playerElement.parentElement;

    const wrapper = document.createElement('div');
    wrapper.className = 'ik-player-wrapper';
    parentContainer.insertBefore(wrapper, playerElement);
    wrapper.appendChild(playerElement);

    // --- STATE MANAGEMENT ---
    let hasStarted = false;
    let isFloatingDismissed = false;

    playerInstance.on('play', () => {
        hasStarted = true;
        isFloatingDismissed = false;
    });

    // --- UI & INTERACTION LOGIC ---
    const setFloating = (isFloating) => {
        const className = `ik-player-floating-${floatPosition}`;
        if (isFloating) {
            playerElement.classList.remove('shoppable-panel-visible');
            playerElement.classList.add('ik-player-floating', className);
            addCloseButton();
        } else {
            playerElement.classList.remove('ik-player-floating', className);
            playerElement.querySelector('.ik-floating-close-button')?.remove();
            isFloatingDismissed = false;
        }
    };

    // --- CLOSE BUTTON with SVG ICON ---
    const addCloseButton = () => {
        if (playerElement.querySelector('.ik-floating-close-button')) return;
        const closeButton = document.createElement('div');
        closeButton.className = 'ik-floating-close-button';
        closeButton.setAttribute('aria-label', 'Close floating video');
        closeButton.innerHTML = "&#10005;";
        closeButton.onclick = (e) => {
            // Stop click from bubbling up to the player and toggling play/pause
            e.stopPropagation();
            isFloatingDismissed = true;
            setFloating(false);
        };
        playerElement.appendChild(closeButton);
    };

    // --- OBSERVERS for ROBUSTNESS ---
    const intersectionObserver = new IntersectionObserver(([entry]) => {
        const isOutOfView = entry.intersectionRatio < 0.5;
        if (isOutOfView && hasStarted && !isFloatingDismissed) {
            setFloating(true);
        } else {
            setFloating(false);
        }
    }, { threshold: [0.5] });

    intersectionObserver.observe(wrapper);
}