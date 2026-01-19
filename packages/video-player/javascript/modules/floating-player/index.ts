import { CleanupRegistry } from '../../utils';

/**
 * Enables a robust floating-on-scroll functionality for the ImageKit Video Player.
 * @param {any} playerInstance The instance of the ImageKit Video Player.
 * @returns A cleanup function that should be called when the player is disposed.
 */
export const enableFloatingPlayer = (playerInstance: any, floatPosition: string): (() => void) => {
    if (!floatPosition || (floatPosition !== 'left' && floatPosition !== 'right')) {
        return;
    }

    const cleanup = new CleanupRegistry();
    const playerElement = playerInstance.el();
    const parentContainer = playerElement.parentElement;

    const wrapper = document.createElement('div');
    wrapper.className = 'ik-player-wrapper';
    parentContainer.insertBefore(wrapper, playerElement);
    wrapper.appendChild(playerElement);
    cleanup.registerElement(wrapper);

    // --- STATE MANAGEMENT ---
    let hasStarted = false;
    let isFloatingDismissed = false;

    cleanup.registerVideoJsListener(playerInstance, 'play', () => {
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
        cleanup.registerEventListener(closeButton, 'click', (e: MouseEvent) => {
            // Stop click from bubbling up to the player and toggling play/pause
            e.stopPropagation();
            isFloatingDismissed = true;
            setFloating(false);
        });
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

    cleanup.registerObserver(intersectionObserver);
    intersectionObserver.observe(wrapper);
    
    // Return cleanup function
    return () => cleanup.dispose();
}