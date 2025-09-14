// Configuration and Storage Manager
class ConfigManager {
    constructor() {
        this.defaultConfig = {
            serverUrl: 'http://localhost:11434',
            temperature: 0.7,
            maxTokens: 32768,
            autoSave: true
        };
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const saved = localStorage.getItem('llm-prompt-tester-config');
            if (saved) {
                return { ...this.defaultConfig, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Failed to load config:', error);
        }
        return { ...this.defaultConfig };
    }

    saveConfig(newConfig = null) {
        try {
            const configToSave = newConfig || this.config;
            localStorage.setItem('llm-prompt-tester-config', JSON.stringify(configToSave));
            if (newConfig) {
                this.config = { ...this.config, ...newConfig };
            }
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    get(key) {
        return this.config[key];
    }

    set(key, value) {
        this.config[key] = value;
        if (this.config.autoSave) {
            this.saveConfig();
        }
    }

    reset() {
        this.config = { ...this.defaultConfig };
        localStorage.removeItem('llm-prompt-tester-config');
    }
}

// Enhanced Ollama Prompt Tester
class AdvancedOllamaPromptTester {
    constructor() {
        this.config = new ConfigManager();
        this.currentController = null;
        this.startTime = null;
        this.tokenCount = 0;

        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.loadModels();
    }

    initializeElements() {
        // Server configuration
        this.serverUrlInput = document.getElementById('serverUrl');
        this.testConnectionBtn = document.getElementById('testConnection');
        this.settingsBtn = document.getElementById('settingsBtn');

        // Settings modal
        this.settingsModal = document.getElementById('settingsModal');
        this.modalServerUrl = document.getElementById('modalServerUrl');
        this.maxTokensInput = document.getElementById('maxTokens');
        this.autoSaveCheckbox = document.getElementById('autoSave');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.resetSettingsBtn = document.getElementById('resetSettings');
        this.closeSettingsBtn = document.getElementById('closeSettings');

        // Existing elements
        this.modelSelect = document.getElementById('modelSelect');
        this.refreshModelsBtn = document.getElementById('refreshModels');
        this.temperatureSlider = document.getElementById('temperature');
        this.tempValue = document.getElementById('tempValue');
        this.promptInput = document.getElementById('promptInput');
        this.charCount = document.getElementById('charCount');
        this.sendBtn = document.getElementById('sendPrompt');
        this.clearPromptBtn = document.getElementById('clearPrompt');
        this.stopBtn = document.getElementById('stopGeneration');
        this.responseContainer = document.getElementById('responseContainer');
        this.responseActions = document.querySelector('.response-actions');
        this.copyBtn = document.getElementById('copyResponse');
        this.clearResponseBtn = document.getElementById('clearResponse');

        // Stats elements
        this.responseTimeSpan = document.getElementById('responseTime');
        this.tokensPerSecondSpan = document.getElementById('tokensPerSecond');
        this.tokenCountSpan = document.getElementById('tokenCount');
        this.generationTimeSpan = document.getElementById('generationTime');
        this.statusSpan = document.getElementById('status');
    }

    bindEvents() {
        // Server configuration
        this.serverUrlInput.addEventListener('input', (e) => {
            this.config.set('serverUrl', e.target.value);
        });

        this.testConnectionBtn.addEventListener('click', () => this.testConnection());
        this.settingsBtn.addEventListener('click', () => this.openSettings());

        // Settings modal
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());

        // Token preset buttons
        document.querySelectorAll('.token-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tokens = parseInt(e.target.dataset.tokens);
                this.maxTokensInput.value = tokens;
                this.updateTokenPresetActive(tokens);
            });
        });

        // Update preset active state when input changes
        this.maxTokensInput.addEventListener('input', (e) => {
            this.updateTokenPresetActive(parseInt(e.target.value));
        });

        // Close modal on backdrop click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });

        // Existing events
        this.refreshModelsBtn.addEventListener('click', () => this.loadModels());
        this.temperatureSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.tempValue.textContent = value;
            this.config.set('temperature', parseFloat(value));
        });

        // Character count
        this.promptInput.addEventListener('input', () => this.updateCharCount());

        this.sendBtn.addEventListener('click', () => this.sendPrompt());
        this.clearPromptBtn.addEventListener('click', () => this.clearPrompt());
        this.stopBtn.addEventListener('click', () => this.stopGeneration());
        this.copyBtn.addEventListener('click', () => this.copyResponse());
        this.clearResponseBtn.addEventListener('click', () => this.clearResponse());

        // Keyboard shortcuts
        this.promptInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendPrompt();
            }
        });

        // ESC to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        });
    }

    loadSettings() {
        this.serverUrlInput.value = this.config.get('serverUrl');
        this.temperatureSlider.value = this.config.get('temperature');
        this.tempValue.textContent = this.config.get('temperature');

        this.updateStatus('ready', '준비');
        this.updateCharCount();
    }

    async testConnection() {
        const originalText = this.testConnectionBtn.textContent;
        const originalStatus = this.statusSpan.textContent;

        this.testConnectionBtn.textContent = '테스트중...';
        this.testConnectionBtn.disabled = true;
        this.updateStatus('generating', '연결 테스트중...');

        try {
            const response = await fetch(`${this.config.get('serverUrl')}/api/tags`, {
                method: 'GET',
                timeout: 5000
            });

            if (response.ok) {
                this.updateStatus('complete', '연결 성공');
                this.showToast('Ollama 서버 연결 성공!', 'success');
                this.loadModels(); // Refresh models on successful connection
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            this.updateStatus('error', '연결 실패');
            this.showToast(`연결 실패: ${error.message}`, 'error');
        } finally {
            this.testConnectionBtn.textContent = originalText;
            this.testConnectionBtn.disabled = false;

            // Restore status after 3 seconds
            setTimeout(() => {
                this.updateStatus('ready', '준비');
            }, 3000);
        }
    }

    openSettings() {
        this.modalServerUrl.value = this.config.get('serverUrl');
        this.maxTokensInput.value = this.config.get('maxTokens');
        this.autoSaveCheckbox.checked = this.config.get('autoSave');
        this.updateTokenPresetActive(this.config.get('maxTokens'));
        this.settingsModal.style.display = 'flex';
    }

    updateTokenPresetActive(currentTokens) {
        document.querySelectorAll('.token-preset').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.tokens) === currentTokens) {
                btn.classList.add('active');
            }
        });
    }

    closeSettings() {
        this.settingsModal.style.display = 'none';
    }

    saveSettings() {
        const newConfig = {
            serverUrl: this.modalServerUrl.value.trim(),
            maxTokens: parseInt(this.maxTokensInput.value),
            autoSave: this.autoSaveCheckbox.checked
        };

        // Validate URL
        try {
            new URL(newConfig.serverUrl);
        } catch {
            this.showToast('올바른 URL을 입력해주세요', 'error');
            return;
        }

        // Validate max tokens
        if (newConfig.maxTokens < 100 || newConfig.maxTokens > 131072) {
            this.showToast('최대 토큰 수는 100-131,072 사이여야 합니다', 'error');
            return;
        }

        this.config.saveConfig(newConfig);
        this.serverUrlInput.value = newConfig.serverUrl;
        this.closeSettings();
        this.showToast('설정이 저장되었습니다', 'success');

        // Reload models if server URL changed
        this.loadModels();
    }

    resetSettings() {
        if (confirm('모든 설정을 초기화하시겠습니까?')) {
            this.config.reset();
            this.loadSettings();
            this.closeSettings();
            this.showToast('설정이 초기화되었습니다', 'success');
            this.loadModels();
        }
    }

    updateCharCount() {
        const text = this.promptInput.value;
        const length = text.length;

        this.charCount.textContent = `${length.toLocaleString()} characters`;

        // Color coding based on length
        this.charCount.className = 'char-counter';
        if (length > 10000) {
            this.charCount.classList.add('danger');
        } else if (length > 5000) {
            this.charCount.classList.add('warning');
        }
    }

    async loadModels() {
        this.updateStatus('generating', '모델 로딩중...');
        this.modelSelect.innerHTML = '<option value="">로딩중...</option>';

        try {
            const response = await fetch(`${this.config.get('serverUrl')}/api/tags`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.modelSelect.innerHTML = '';

            if (data.models && data.models.length > 0) {
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = `${model.name} (${this.formatSize(model.size)})`;
                    this.modelSelect.appendChild(option);
                });
                this.updateStatus('ready', '준비');
            } else {
                this.modelSelect.innerHTML = '<option value="">설치된 모델이 없습니다</option>';
                this.updateStatus('error', '모델 없음');
            }
        } catch (error) {
            console.error('모델 로딩 실패:', error);
            this.modelSelect.innerHTML = '<option value="">연결 실패</option>';
            this.updateStatus('error', 'Ollama 연결 실패');
            this.showError('Ollama 서버에 연결할 수 없습니다. 서버 URL을 확인하고 Ollama가 실행중인지 확인해주세요.');
        }
    }

    formatSize(bytes) {
        if (!bytes) return 'Unknown size';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async sendPrompt() {
        const prompt = this.promptInput.value.trim();
        const model = this.modelSelect.value;

        if (!prompt) {
            this.showToast('프롬프트를 입력해주세요', 'warning');
            return;
        }

        if (!model) {
            this.showToast('모델을 선택해주세요', 'warning');
            return;
        }

        this.startGeneration();

        try {
            const controller = new AbortController();
            this.currentController = controller;

            const requestBody = {
                model: model,
                prompt: prompt,
                temperature: this.config.get('temperature'),
                stream: true
            };

            // Add max_tokens if configured
            const maxTokens = this.config.get('maxTokens');
            if (maxTokens && maxTokens > 0) {
                requestBody.options = { num_predict: maxTokens };
            }

            const response = await fetch(`${this.config.get('serverUrl')}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            await this.handleStreamResponse(response);

        } catch (error) {
            if (error.name === 'AbortError') {
                this.updateStatus('ready', '중단됨');
            } else {
                console.error('생성 실패:', error);
                this.updateStatus('error', '생성 실패');
                this.showError(`생성 중 오류가 발생했습니다: ${error.message}`);
            }
        } finally {
            this.endGeneration();
        }
    }

    startGeneration() {
        this.startTime = Date.now();
        this.tokenCount = 0;
        this.sendBtn.disabled = true;
        this.stopBtn.style.display = 'inline-flex';
        this.sendBtn.style.display = 'none';

        this.clearResponse(false);
        this.responseContainer.innerHTML = '<span class="streaming-cursor"></span>';
        this.responseActions.style.display = 'none';

        this.updateStatus('generating', '생성중...');
        this.responseTimeSpan.textContent = '';
        this.tokensPerSecondSpan.textContent = '';
    }

    endGeneration() {
        this.sendBtn.disabled = false;
        this.stopBtn.style.display = 'none';
        this.sendBtn.style.display = 'inline-flex';
        this.currentController = null;

        // Remove cursor
        const cursor = this.responseContainer.querySelector('.streaming-cursor');
        if (cursor) {
            cursor.remove();
        }

        const elapsed = this.startTime ? Date.now() - this.startTime : 0;
        this.responseTimeSpan.textContent = `${elapsed}ms`;
        this.generationTimeSpan.textContent = `${elapsed}ms`;

        if (this.tokenCount > 0 && elapsed > 0) {
            const tokensPerSecond = Math.round((this.tokenCount / elapsed) * 1000 * 100) / 100;
            this.tokensPerSecondSpan.textContent = `${tokensPerSecond} tokens/s`;
        }

        this.updateStatus('complete', '완료');
        this.responseActions.style.display = 'flex';
    }

    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);

                        if (data.response) {
                            accumulatedResponse += data.response;
                            this.tokenCount++;
                            this.updateStreamingDisplay(accumulatedResponse);
                            this.updateStats();
                        }

                        if (data.done) {
                            return;
                        }

                    } catch (parseError) {
                        console.warn('JSON 파싱 오류:', parseError, 'Line:', line);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    updateStreamingDisplay(text) {
        const cursor = this.responseContainer.querySelector('.streaming-cursor');
        this.responseContainer.textContent = text;
        if (cursor) {
            this.responseContainer.appendChild(cursor);
        } else {
            this.responseContainer.innerHTML += '<span class="streaming-cursor"></span>';
        }

        this.responseContainer.scrollTop = this.responseContainer.scrollHeight;
    }

    updateStats() {
        this.tokenCountSpan.textContent = this.tokenCount;

        if (this.startTime) {
            const elapsed = Date.now() - this.startTime;
            this.generationTimeSpan.textContent = `${elapsed}ms`;

            if (elapsed > 0) {
                const tokensPerSecond = Math.round((this.tokenCount / elapsed) * 1000 * 100) / 100;
                this.tokensPerSecondSpan.textContent = `${tokensPerSecond} tokens/s`;
            }
        }
    }

    stopGeneration() {
        if (this.currentController) {
            this.currentController.abort();
        }
    }

    clearPrompt() {
        this.promptInput.value = '';
        this.updateCharCount();
        this.promptInput.focus();
    }

    clearResponse(showPlaceholder = true) {
        if (showPlaceholder) {
            this.responseContainer.innerHTML = '<div class="placeholder">프롬프트를 입력하고 전송 버튼을 눌러주세요.</div>';
            this.responseActions.style.display = 'none';
            this.tokenCount = 0;
            this.updateStats();
            this.responseTimeSpan.textContent = '';
            this.tokensPerSecondSpan.textContent = '';
            this.generationTimeSpan.textContent = '0ms';
            this.updateStatus('ready', '준비');
        } else {
            this.responseContainer.innerHTML = '';
        }
    }

    async copyResponse() {
        const text = this.responseContainer.textContent;
        if (text && text !== '프롬프트를 입력하고 전송 버튼을 눌러주세요.') {
            try {
                await navigator.clipboard.writeText(text);
                const originalText = this.copyBtn.textContent;
                this.copyBtn.textContent = '복사됨! ✓';
                setTimeout(() => {
                    this.copyBtn.textContent = originalText;
                }, 2000);
            } catch (err) {
                console.error('복사 실패:', err);
                this.showToast('복사에 실패했습니다', 'error');
            }
        }
    }

    updateStatus(type, message) {
        this.statusSpan.className = `status-${type}`;
        this.statusSpan.textContent = message;
    }

    showError(message) {
        this.responseContainer.innerHTML = `<div style="color: #dc3545; padding: 20px; text-align: center; font-weight: 600;">${message}</div>`;
        this.responseActions.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        const styles = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            fontSize: '14px',
            zIndex: '10000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        };

        const typeColors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        Object.assign(toast.style, styles);
        toast.style.background = typeColors[type] || typeColors.info;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Animate out and remove
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Example prompts for context menu
const examplePrompts = {
    "간단한 질문": "안녕하세요! 오늘 날씨는 어떤가요?",
    "코딩 도움": "Python에서 리스트를 정렬하는 방법을 알려주세요. 예제 코드도 포함해주세요.",
    "에이전트 프롬프트": `당신은 전문적인 소프트웨어 개발 어시스턴트입니다. 다음 역할과 지침을 따라주세요:

역할:
- 숙련된 풀스택 개발자로서 행동
- 최신 기술 트렌드와 베스트 프랙티스 숙지
- 코드 품질과 성능을 우선시

지침:
1. 명확하고 실용적인 솔루션 제공
2. 코드 예제는 주석과 함께 제공
3. 보안과 성능 고려사항 포함
4. 여러 접근법이 있다면 장단점 비교

질문: React에서 상태 관리를 위한 최적의 방법은 무엇인가요? 프로젝트 규모별로 추천해주세요.`,
    "창의적 작업": "창의적인 단편소설을 하나 써주세요. 주제는 '시간 여행자가 과거로 돌아가서 만난 자신'입니다.",
    "번역 요청": "다음 영어 문장을 자연스러운 한국어로 번역해주세요:\n\n\"The future belongs to those who believe in the beauty of their dreams.\""
};

// Initialize context menu for example prompts
function initializeContextMenu() {
    const promptInput = document.getElementById('promptInput');

    promptInput.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showExampleMenu(e.pageX, e.pageY);
    });
}

function showExampleMenu(x, y) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 200px;
        overflow: hidden;
        animation: contextMenuSlide 0.2s ease;
    `;

    // Add CSS animation
    if (!document.querySelector('#contextMenuAnimation')) {
        const style = document.createElement('style');
        style.id = 'contextMenuAnimation';
        style.textContent = `
            @keyframes contextMenuSlide {
                from { opacity: 0; transform: scale(0.9) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    Object.entries(examplePrompts).forEach(([name, prompt], index) => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 12px 16px;
            cursor: pointer;
            ${index < Object.keys(examplePrompts).length - 1 ? 'border-bottom: 1px solid #f0f0f0;' : ''}
            transition: background 0.2s;
            font-size: 14px;
        `;
        item.textContent = name;

        item.addEventListener('mouseenter', () => {
            item.style.background = '#f8f9fa';
        });

        item.addEventListener('mouseleave', () => {
            item.style.background = 'white';
        });

        item.addEventListener('click', () => {
            document.getElementById('promptInput').value = prompt;
            document.getElementById('promptInput').dispatchEvent(new Event('input'));
            menu.remove();
        });

        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedOllamaPromptTester();
    initializeContextMenu();
});