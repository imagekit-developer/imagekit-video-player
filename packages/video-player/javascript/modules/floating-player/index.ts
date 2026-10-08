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
            const closeButton = playerElement.querySelector('.ik-floating-close-button');
            // Removing a focused button would drop keyboard focus; keep it in the player.
            const hadFocus = !!closeButton && closeButton === document.activeElement;
            closeButton?.remove();
            if (hadFocus) playerElement.focus();
            isFloatingDismissed = false;
        }
    };

    // --- CLOSE BUTTON with SVG ICON ---
    const addCloseButton = () => {
        if (playerElement.querySelector('.ik-floating-close-button')) return;
        const closeButton = document.createElement('div');
        closeButton.className = 'ik-floating-close-button';
        // A named button that also works from the keyboard (WCAG 2.1.1, 4.1.2).
        closeButton.setAttribute('role', 'button');
        closeButton.setAttribute('tabindex', '0');
        closeButton.setAttribute('aria-label', playerInstance.localize('Close floating video'));
        closeButton.innerHTML = '<span aria-hidden="true">&#10005;</span>';
        const dismiss = () => {
            isFloatingDismissed = true;
            setFloating(false);
        };
        cleanup.registerEventListener(closeButton, 'click', (e: Event) => {
            // Stop click from bubbling up to the player and toggling play/pause
            e.stopPropagation();
            dismiss();
        });
        cleanup.registerEventListener(closeButton, 'keydown', (e: Event) => {
            const key = (e as KeyboardEvent).key;
            if (key !== 'Enter' && key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            dismiss();
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