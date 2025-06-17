// imports/ui/components/TerminalSettings.jsx
import React, { useState } from 'react';

const THEMES = {
  dark: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selection: '#4d4d4d',
    black: '#000000',
    red: '#e74c3c',
    green: '#2ecc71',
    yellow: '#f1c40f',
    blue: '#3498db',
    magenta: '#9b59b6',
    cyan: '#1abc9c',
    white: '#ecf0f1'
  },
  light: {
    background: '#ffffff',
    foreground: '#2c3e50',
    cursor: '#2c3e50',
    selection: '#d5dbdb',
    black: '#2c3e50',
    red: '#e74c3c',
    green: '#27ae60',
    yellow: '#f39c12',
    blue: '#2980b9',
    magenta: '#8e44ad',
    cyan: '#16a085',
    white: '#ecf0f1'
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    selection: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2'
  },
  solarized: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    selection: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5'
  }
};

const TerminalSettings = ({ 
  settings, 
  onUpdate, 
  onReset, 
  onExport, 
  onImport, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleFileChange = (event) => {
    onImport(event);
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleReset = () => {
    if (resetConfirm) {
      onReset();
      setResetConfirm(false);
    } else {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
    }
  };

  const getThemeColor = (themeName, colorKey) => {
    return THEMES[themeName]?.[colorKey] || THEMES.dark[colorKey];
  };

  const formatBytes = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const tabs = [
    { id: 'appearance', label: '🎨 Appearance', icon: '🎨' },
    { id: 'behavior', label: '⚙️ Behavior', icon: '⚙️' },
    { id: 'keyboard', label: '⌨️ Keyboard', icon: '⌨️' },
    { id: 'advanced', label: '🔧 Advanced', icon: '🔧' }
  ];

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="settings-title">
          <h3>⚙️ Terminal Settings</h3>
          <p>Customize your terminal experience</p>
        </div>
        <button onClick={onClose} className="settings-close-btn" title="Close Settings">
          ✕
        </button>
      </div>
      
      {/* Settings Navigation Tabs */}
      <div className="settings-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </div>
      
      <div className="settings-content">
        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <h4>🎨 Visual Appearance</h4>
              
              <div className="setting-group">
                <div className="setting-item">
                  <label htmlFor="theme-select">Color Theme</label>
                  <select
                    id="theme-select"
                    value={settings.theme}
                    onChange={(e) => onUpdate('theme', e.target.value)}
                    className="setting-select"
                  >
                    <option value="dark">🌙 Dark Theme</option>
                    <option value="light">☀️ Light Theme</option>
                    <option value="monokai">🌈 Monokai</option>
                    <option value="solarized">🌊 Solarized Dark</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label htmlFor="font-size">Font Size</label>
                  <div className="range-input-group">
                    <input
                      id="font-size"
                      type="range"
                      min="8"
                      max="32"
                      value={settings.fontSize}
                      onChange={(e) => onUpdate('fontSize', parseInt(e.target.value))}
                      className="setting-range"
                    />
                    <span className="setting-value">{settings.fontSize}px</span>
                  </div>
                </div>

                <div className="setting-item">
                  <label htmlFor="font-family">Font Family</label>
                  <select
                    id="font-family"
                    value={settings.fontFamily}
                    onChange={(e) => onUpdate('fontFamily', e.target.value)}
                    className="setting-select"
                  >
                    <option value="Monaco, Menlo, 'DejaVu Sans Mono', 'Lucida Console', monospace">Monaco</option>
                    <option value="'Fira Code', 'Courier New', monospace">Fira Code</option>
                    <option value="'Source Code Pro', monospace">Source Code Pro</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    <option value="'Cascadia Code', monospace">Cascadia Code</option>
                    <option value="'Ubuntu Mono', monospace">Ubuntu Mono</option>
                    <option value="'Consolas', monospace">Consolas</option>
                    <option value="'SF Mono', monospace">SF Mono</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label htmlFor="line-height">Line Height</label>
                  <div className="range-input-group">
                    <input
                      id="line-height"
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.1"
                      value={settings.lineHeight}
                      onChange={(e) => onUpdate('lineHeight', parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <span className="setting-value">{settings.lineHeight}</span>
                  </div>
                </div>

                <div className="setting-item">
                  <label htmlFor="font-weight">Font Weight</label>
                  <select
                    id="font-weight"
                    value={settings.fontWeight}
                    onChange={(e) => onUpdate('fontWeight', e.target.value)}
                    className="setting-select"
                  >
                    <option value="100">Thin (100)</option>
                    <option value="300">Light (300)</option>
                    <option value="normal">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi-bold (600)</option>
                    <option value="bold">Bold (700)</option>
                    <option value="900">Heavy (900)</option>
                  </select>
                </div>
              </div>

              <div className="setting-group">
                <h5>🎯 Cursor Settings</h5>
                
                <div className="setting-item">
                  <label htmlFor="cursor-style">Cursor Style</label>
                  <select
                    id="cursor-style"
                    value={settings.cursorStyle}
                    onChange={(e) => onUpdate('cursorStyle', e.target.value)}
                    className="setting-select"
                  >
                    <option value="block">█ Block</option>
                    <option value="underline">_ Underline</option>
                    <option value="bar">| Bar</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label htmlFor="cursor-blink">Cursor Blink</label>
                  <div className="toggle-switch-container">
                    <input
                      id="cursor-blink"
                      type="checkbox"
                      checked={settings.cursorBlink}
                      onChange={(e) => onUpdate('cursorBlink', e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="cursor-blink" className="toggle-switch">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Preview */}
            <div className="settings-section">
              <h4>👁️ Preview</h4>
              <div className="theme-preview">
                <div 
                  className="preview-terminal"
                  style={{
                    fontFamily: settings.fontFamily,
                    fontSize: `${settings.fontSize}px`,
                    lineHeight: settings.lineHeight,
                    fontWeight: settings.fontWeight,
                    backgroundColor: getThemeColor(settings.theme, 'background'),
                    color: getThemeColor(settings.theme, 'foreground'),
                    padding: '16px',
                    borderRadius: '8px',
                    border: `2px solid ${getThemeColor(settings.theme, 'selection')}`,
                    minHeight: '120px'
                  }}
                >
                  <div>
                    <span style={{ color: getThemeColor(settings.theme, 'green') }}>user@hostname</span>
                    <span style={{ color: getThemeColor(settings.theme, 'foreground') }}>:</span>
                    <span style={{ color: getThemeColor(settings.theme, 'blue') }}>~/projects</span>
                    <span style={{ color: getThemeColor(settings.theme, 'foreground') }}>$ </span>
                    <span style={{ color: getThemeColor(settings.theme, 'yellow') }}>ls -la</span>
                  </div>
                  <div style={{ color: getThemeColor(settings.theme, 'cyan') }}>
                    drwxr-xr-x  5 user user  4096 Oct 25 10:30 .
                  </div>
                  <div style={{ color: getThemeColor(settings.theme, 'cyan') }}>
                    drwxr-xr-x  3 user user  4096 Oct 25 10:29 ..
                  </div>
                  <div style={{ color: getThemeColor(settings.theme, 'white') }}>
                    -rw-r--r--  1 user user   220 Oct 25 10:29 .bashrc
                  </div>
                  <div style={{ color: getThemeColor(settings.theme, 'green') }}>
                    -rwxr-xr-x  1 user user  8760 Oct 25 10:30 script.sh
                  </div>
                  <div>
                    <span style={{ color: getThemeColor(settings.theme, 'green') }}>user@hostname</span>
                    <span style={{ color: getThemeColor(settings.theme, 'foreground') }}>:</span>
                    <span style={{ color: getThemeColor(settings.theme, 'blue') }}>~/projects</span>
                    <span style={{ color: getThemeColor(settings.theme, 'foreground') }}>$ </span>
                    <span 
                      className={`cursor-${settings.cursorStyle} ${settings.cursorBlink ? 'cursor-blink' : ''}`}
                      style={{ 
                        backgroundColor: settings.cursorStyle === 'block' ? getThemeColor(settings.theme, 'cursor') : 'transparent',
                        borderBottom: settings.cursorStyle === 'underline' ? `2px solid ${getThemeColor(settings.theme, 'cursor')}` : 'none',
                        borderLeft: settings.cursorStyle === 'bar' ? `2px solid ${getThemeColor(settings.theme, 'cursor')}` : 'none',
                        color: settings.cursorStyle === 'block' ? getThemeColor(settings.theme, 'background') : 'transparent'
                      }}
                    >
                      {settings.cursorStyle === 'block' ? '█' : ' '}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Behavior Tab */}
        {activeTab === 'behavior' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <h4>⚙️ Terminal Behavior</h4>
              
              <div className="setting-group">
                <div className="setting-item">
                  <label htmlFor="scrollback">Scrollback Lines</label>
                  <div className="range-input-group">
                    <input
                      id="scrollback"
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={settings.scrollback}
                      onChange={(e) => onUpdate('scrollback', parseInt(e.target.value))}
                      className="setting-range"
                    />
                    <span className="setting-value">{settings.scrollback.toLocaleString()}</span>
                  </div>
                  <small className="setting-hint">
                    Memory usage: ~{formatBytes(settings.scrollback * 80)}
                  </small>
                </div>

                <div className="setting-item">
                  <label htmlFor="bell-sound">Bell Sound</label>
                  <div className="toggle-switch-container">
                    <input
                      id="bell-sound"
                      type="checkbox"
                      checked={settings.bellSound}
                      onChange={(e) => onUpdate('bellSound', e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="bell-sound" className="toggle-switch">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Play sound on terminal bell</small>
                </div>

                <div className="setting-item">
                  <label htmlFor="allow-transparency">Allow Transparency</label>
                  <div className="toggle-switch-container">
                    <input
                      id="allow-transparency"
                      type="checkbox"
                      checked={settings.allowTransparency}
                      onChange={(e) => onUpdate('allowTransparency', e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="allow-transparency" className="toggle-switch">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Enable terminal background transparency</small>
                </div>

                <div className="setting-item">
                  <label htmlFor="word-separator">Word Separator Characters</label>
                  <input
                    id="word-separator"
                    type="text"
                    value={settings.wordSeparator || ' ()[]{},.:;"\''}
                    onChange={(e) => onUpdate('wordSeparator', e.target.value)}
                    className="setting-input"
                    placeholder="Characters that separate words"
                  />
                  <small className="setting-hint">Characters used for word selection</small>
                </div>

                <div className="setting-item">
                  <label htmlFor="scroll-sensitivity">Scroll Sensitivity</label>
                  <div className="range-input-group">
                    <input
                      id="scroll-sensitivity"
                      type="range"
                      min="1"
                      max="10"
                      value={settings.scrollSensitivity || 5}
                      onChange={(e) => onUpdate('scrollSensitivity', parseInt(e.target.value))}
                      className="setting-range"
                    />
                    <span className="setting-value">{settings.scrollSensitivity || 5}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Tab */}
        {activeTab === 'keyboard' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <h4>⌨️ Keyboard Shortcuts</h4>
              
              <div className="keyboard-shortcuts-list">
                <div className="shortcut-category">
                  <h5>📋 Clipboard Operations</h5>
                  <div className="shortcut-grid">
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>
                      </div>
                      <span className="shortcut-action">Copy selected text</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>
                      </div>
                      <span className="shortcut-action">Paste from clipboard</span>
                    </div>
                  </div>
                </div>

                <div className="shortcut-category">
                  <h5>🔍 Search & Navigation</h5>
                  <div className="shortcut-grid">
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>
                      </div>
                      <span className="shortcut-action">Open search</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>L</kbd>
                      </div>
                      <span className="shortcut-action">Clear screen</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Page Up</kbd> / <kbd>Page Down</kbd>
                      </div>
                      <span className="shortcut-action">Scroll terminal</span>
                    </div>
                  </div>
                </div>

                <div className="shortcut-category">
                  <h5>🎛️ Terminal Control</h5>
                  <div className="shortcut-grid">
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>C</kbd>
                      </div>
                      <span className="shortcut-action">Interrupt process</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                      </div>
                      <span className="shortcut-action">Suspend process</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>D</kbd>
                      </div>
                      <span className="shortcut-action">End of file / Exit</span>
                    </div>
                  </div>
                </div>

                <div className="shortcut-category">
                  <h5>📝 Text Editing</h5>
                  <div className="shortcut-grid">
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>A</kbd>
                      </div>
                      <span className="shortcut-action">Beginning of line</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>E</kbd>
                      </div>
                      <span className="shortcut-action">End of line</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>U</kbd>
                      </div>
                      <span className="shortcut-action">Delete line</span>
                    </div>
                    <div className="shortcut-item">
                      <div className="shortcut-keys">
                        <kbd>Ctrl</kbd> + <kbd>W</kbd>
                      </div>
                      <span className="shortcut-action">Delete word</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <h4>🔧 Advanced Settings</h4>
              
              <div className="setting-group">
                <div className="setting-item">
                  <label htmlFor="renderer-type">Renderer Type</label>
                  <select
                    id="renderer-type"
                    value={settings.rendererType || 'canvas'}
                    onChange={(e) => onUpdate('rendererType', e.target.value)}
                    className="setting-select"
                  >
                    <option value="canvas">Canvas (Recommended)</option>
                    <option value="dom">DOM (Compatibility)</option>
                  </select>
                  <small className="setting-hint">Canvas provides better performance</small>
                </div>

                <div className="setting-item">
                  <label htmlFor="tab-stop-width">Tab Stop Width</label>
                  <div className="range-input-group">
                    <input
                      id="tab-stop-width"
                      type="range"
                      min="2"
                      max="8"
                      value={settings.tabStopWidth || 4}
                      onChange={(e) => onUpdate('tabStopWidth', parseInt(e.target.value))}
                      className="setting-range"
                    />
                    <span className="setting-value">{settings.tabStopWidth || 4}</span>
                  </div>
                </div>

                <div className="setting-item">
                  <label htmlFor="convert-eol">Convert EOL</label>
                  <div className="toggle-switch-container">
                    <input
                      id="convert-eol"
                      type="checkbox"
                      checked={settings.convertEol || false}
                      onChange={(e) => onUpdate('convertEol', e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="convert-eol" className="toggle-switch">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Convert Windows line endings</small>
                </div>

                <div className="setting-item">
                  <label htmlFor="disable-stdin">Disable Standard Input</label>
                  <div className="toggle-switch-container">
                    <input
                      id="disable-stdin"
                      type="checkbox"
                      checked={settings.disableStdin || false}
                      onChange={(e) => onUpdate('disableStdin', e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="disable-stdin" className="toggle-switch">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Make terminal read-only</small>
                </div>

                <div className="setting-item">
                  <label htmlFor="alt-click-moves-cursor">Alt+Click Moves Cursor</label>
                  <div className="toggle-switch-container">
                    <input
                      id="alt-click-moves-cursor"
                      type="checkbox"
                      checked={settings.altClickMovesCursor || true}
                      onChange={(e) => onUpdate('altClickMovesCursor', e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="alt-click-moves-cursor" className="toggle-switch">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Alt+Click to position cursor</small>
                </div>
              </div>

              <div className="setting-group">
                <h5>💾 Data Management</h5>
                
                <div className="data-info">
                  <div className="data-item">
                    <span className="data-label">Settings Size:</span>
                    <span className="data-value">{formatBytes(JSON.stringify(settings).length)}</span>
                  </div>
                  <div className="data-item">
                    <span className="data-label">Last Modified:</span>
                    <span className="data-value">{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="settings-actions">
          <div className="action-group">
            <button 
              onClick={handleReset} 
              className={`action-btn reset-btn ${resetConfirm ? 'confirm' : ''}`}
            >
              {resetConfirm ? '⚠️ Confirm Reset' : '🔄 Reset to Defaults'}
            </button>
            
            <button onClick={onExport} className="action-btn export-btn">
              📥 Export Settings
            </button>
            
            <label className="action-btn import-btn">
              📤 Import Settings
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          
          <div className="action-group secondary">
            <button onClick={onClose} className="action-btn close-btn">
              ✅ Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalSettings;