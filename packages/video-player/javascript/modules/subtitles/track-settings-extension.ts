import type Player from 'video.js/dist/types/player';

function getStoredHighlightColor(player: Player): string | null {
  try {
    const key = `vjs-highlight-color-${player.id()}`;
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storeHighlightColor(player: Player, color: string): void {
  try {
    const key = `vjs-highlight-color-${player.id()}`;
    localStorage.setItem(key, color);
  } catch (e) {
    // localStorage might not be available
  }
}

function setHighlightColor(player: Player, color: string): void {
  const playerEl = player.el();
  if (!playerEl) return;
  
  (playerEl as HTMLElement).style.setProperty('--subtitle-highlight-color', color);
  
  const highlightElements = playerEl.querySelectorAll('.vjs-word-highlight');
  highlightElements.forEach((el) => {
    (el as HTMLElement).style.color = color;
  });
}

export function extendTrackSettings(player: Player): void {
  const storedColor = getStoredHighlightColor(player);
  if (!storedColor) {
    setHighlightColor(player, '#FFD54F');
    storeHighlightColor(player, '#FFD54F');
  } else {
    setHighlightColor(player, storedColor);
  }

  if (!player.readyState || player.readyState() < 1) {
    player.ready(() => {
      setupTrackSettingsExtension(player);
    });
  } else {
    setupTrackSettingsExtension(player);
  }
}

function setupTrackSettingsExtension(player: Player): void {
  const textTrackSettings = player.getChild('TextTrackSettings') as any;
  
  if (!textTrackSettings) {
    player.log.warn('[TrackSettingsExtension] TextTrackSettings component not found');
    return;
  }

  const originalUpdateDisplay = textTrackSettings.updateDisplay;
  
  textTrackSettings.updateDisplay = function() {
    if (originalUpdateDisplay) {
      originalUpdateDisplay.call(this);
    }
    
    addHighlightColorFieldset(this, player);
  };

  const modal = textTrackSettings.el();
  if (modal) {
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('vjs-hidden')) {
        setTimeout(() => addHighlightColorFieldset(textTrackSettings, player), 100);
      }
    });
    
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  player.one('texttracksettingsshow', () => {
    setTimeout(() => addHighlightColorFieldset(textTrackSettings, player), 100);
  });
}

function addHighlightColorFieldset(settingsComponent: any, player: Player): void {
  const modal = settingsComponent.el();
  if (!modal) return;

  const existingFieldset = modal.querySelector('.vjs-highlight-color-setting');
  if (existingFieldset) return;

  const colorsSection = modal.querySelector('.vjs-track-settings-colors');
  if (!colorsSection) {
    player.log.warn('[TrackSettingsExtension] Colors section not found');
    return;
  }

  const highlightFieldset = document.createElement('fieldset');
  highlightFieldset.className = 'vjs-track-setting vjs-highlight-color-setting';
  
  const legend = document.createElement('legend');
  legend.id = `captions-highlight-legend-${player.id()}`;
  legend.textContent = 'Word Highlight';
  highlightFieldset.appendChild(legend);

  const colorSpan = document.createElement('span');
  colorSpan.className = 'vjs-highlight-color';
  
  const label = document.createElement('label');
  label.id = `captions-highlight-color-${player.id()}`;
  label.className = 'vjs-label';
  label.setAttribute('for', `vjs_select_highlight_${player.id()}`);
  label.textContent = 'Color';
  
  const select = document.createElement('select');
  select.id = `vjs_select_highlight_${player.id()}`;
  select.setAttribute('aria-labelledby', `captions-highlight-legend-${player.id()} captions-highlight-color-${player.id()}`);
  
  const colors = [
    { value: '#FFD54F', label: 'Amber Yellow (Default)' },
    { value: '#FFF', label: 'White' },
    { value: '#000', label: 'Black' },
    { value: '#F00', label: 'Red' },
    { value: '#0F0', label: 'Green' },
    { value: '#00F', label: 'Blue' },
    { value: '#FF0', label: 'Pure Yellow' },
    { value: '#F0F', label: 'Magenta' },
    { value: '#0FF', label: 'Cyan' },
    { value: '#FF6B6B', label: 'Coral' },
    { value: '#4ECDC4', label: 'Turquoise' },
    { value: '#45B7D1', label: 'Sky Blue' },
    { value: '#FFA07A', label: 'Light Salmon' },
    { value: '#98D8C8', label: 'Mint' },
  ];

  const currentColor = getStoredHighlightColor(player) || '#FFD54F';
  
  colors.forEach((color, index) => {
    const option = document.createElement('option');
    option.id = `captions-highlight-color-${player.id()}-${color.label.replace(/\s+/g, '')}`;
    option.value = color.value;
    option.textContent = color.label;
    option.setAttribute('aria-labelledby', `captions-highlight-legend-${player.id()} captions-highlight-color-${player.id()} captions-highlight-color-${player.id()}-${color.label.replace(/\s+/g, '')}`);
    
    if (color.value === currentColor) {
      option.selected = true;
    }
    
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    const color = target.value;
    setHighlightColor(player, color);
    storeHighlightColor(player, color);
  });

  colorSpan.appendChild(label);
  colorSpan.appendChild(select);
  highlightFieldset.appendChild(colorSpan);
  
  const windowFieldset = colorsSection.querySelector('.vjs-window');
  if (windowFieldset && windowFieldset.parentNode) {
    windowFieldset.parentNode.insertBefore(highlightFieldset, windowFieldset.nextSibling);
  } else {
    colorsSection.appendChild(highlightFieldset);
  }

  setHighlightColor(player, currentColor);
}
