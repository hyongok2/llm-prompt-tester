// API Provider Classes
class VLLMProvider {
    constructor(config) {
        this.baseUrl = config.vllmServerUrl || 'http://localhost:8000';
        this.modelName = config.vllmModelName || '';
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            console.error('vLLM connection test failed:', error);
            return false;
        }
    }

    async generateStream(prompt, params, onChunk, onComplete, onError) {
        try {
            // vLLM은 --max-num-batched-tokens 설정에 따라 제한됨
            // 서버 설정에 맞춰 max_tokens 조정
            // 서버 설정: --max-num-batched-tokens 4096 (권장)
            const maxTokens = Math.min(params.max_tokens || 4096, 4096);

            const requestBody = {
                model: this.modelName,
                prompt: prompt,
                temperature: params.temperature || 0.7,
                max_tokens: maxTokens,
                stream: true
            };

            console.log('vLLM Request:', requestBody);

            const response = await fetch(`${this.baseUrl}/v1/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: params.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('vLLM Error Response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            await this.handleSSEStream(response, onChunk, onComplete);
        } catch (error) {
            if (onError) onError(error);
            throw error;
        }
    }

    async handleSSEStream(response, onChunk, onComplete) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();

                        if (data === '[DONE]') {
                            if (onComplete) onComplete();
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].text) {
                                const text = parsed.choices[0].text;

                                // Display all tokens without filtering
                                // (Reasoning token filtering disabled for debugging)
                                if (text && onChunk) onChunk(text);
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse SSE data:', parseError);
                        }
                    }
                }
            }

            if (onComplete) onComplete();
        } finally {
            reader.releaseLock();
        }
    }
}

// Template and History Manager
class TemplateHistoryManager {
    constructor() {
        this.templates = this.loadTemplates();
        this.history = this.loadHistory();
    }

    // 템플릿 관리
    loadTemplates() {
        try {
            const saved = localStorage.getItem('llm-prompt-templates');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('Failed to load templates:', error);
            return [];
        }
    }

    saveTemplates() {
        try {
            localStorage.setItem('llm-prompt-templates', JSON.stringify(this.templates));
        } catch (error) {
            console.error('Failed to save templates:', error);
        }
    }

    saveTemplate(templateData) {
        const template = {
            id: Date.now().toString(),
            name: templateData.name,
            description: templateData.description || '',
            prompt: templateData.prompt,
            tags: templateData.tags ? templateData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            favorite: templateData.favorite || false,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            usageCount: 0
        };

        this.templates.unshift(template);
        this.saveTemplates();
        return template;
    }

    updateTemplate(id, updates) {
        const index = this.templates.findIndex(t => t.id === id);
        if (index !== -1) {
            this.templates[index] = { ...this.templates[index], ...updates };
            this.saveTemplates();
        }
    }

    deleteTemplate(id) {
        this.templates = this.templates.filter(t => t.id !== id);
        this.saveTemplates();
    }

    getTemplates(filter = 'all', searchTerm = '') {
        let filtered = this.templates;

        // 필터 적용
        if (filter === 'favorites') {
            filtered = filtered.filter(t => t.favorite);
        } else if (filter === 'recent') {
            filtered = filtered.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)).slice(0, 10);
        }

        // 검색 적용
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(term) ||
                t.description.toLowerCase().includes(term) ||
                t.tags.some(tag => tag.toLowerCase().includes(term)) ||
                t.prompt.toLowerCase().includes(term)
            );
        }

        return filtered;
    }

    useTemplate(id) {
        const template = this.templates.find(t => t.id === id);
        if (template) {
            template.lastUsed = new Date().toISOString();
            template.usageCount = (template.usageCount || 0) + 1;
            this.saveTemplates();
            return template;
        }
        return null;
    }

    // 히스토리 관리
    loadHistory() {
        try {
            const saved = localStorage.getItem('llm-prompt-history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('Failed to load history:', error);
            return [];
        }
    }

    saveHistory() {
        try {
            // 최대 100개만 저장 (용량 관리)
            const historyToSave = this.history.slice(0, 100);
            localStorage.setItem('llm-prompt-history', JSON.stringify(historyToSave));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    addHistory(historyData) {
        const historyItem = {
            id: Date.now().toString(),
            prompt: historyData.prompt,
            response: historyData.response,
            model: historyData.model,
            settings: historyData.settings,
            timestamp: new Date().toISOString(),
            responseTime: historyData.responseTime,
            tokenCount: historyData.tokenCount,
            tokensPerSecond: historyData.tokensPerSecond
        };

        this.history.unshift(historyItem);
        this.saveHistory();
        return historyItem;
    }

    getHistory(searchTerm = '') {
        let filtered = this.history;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(h =>
                h.prompt.toLowerCase().includes(term) ||
                h.model.toLowerCase().includes(term) ||
                (h.response && h.response.toLowerCase().includes(term))
            );
        }

        return filtered;
    }

    deleteHistory(id) {
        this.history = this.history.filter(h => h.id !== id);
        this.saveHistory();
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
    }
}

// Configuration and Storage Manager
class ConfigManager {
    constructor() {
        this.defaultConfig = {
            provider: 'ollama', // 'ollama' | 'vllm'
            serverUrl: 'http://localhost:11434',
            vllmServerUrl: 'http://localhost:8000',
            vllmModelName: '',
            temperature: 0.7,
            maxTokens: 32768,
            autoSave: true,
            filePrefix: 'PromptLab',
            theme: 'dark',
            bearerToken: ''
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
        this.templateHistory = new TemplateHistoryManager();
        this.currentController = null;
        this.startTime = null;
        this.firstTokenTime = null;
        this.tokenCount = 0;
        this.currentSession = {
            prompt: '',
            response: '',
            model: '',
            settings: {},
            metrics: {},
            timestamp: null
        };

        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.loadModels();
    }

    initializeElements() {
        // Provider selection
        this.providerSelect = document.getElementById('providerSelect');
        this.serverUrlLabel = document.getElementById('serverUrlLabel');
        this.ollamaModelSelector = document.getElementById('ollamaModelSelector');
        this.vllmModelInput = document.getElementById('vllmModelInput');
        this.vllmModelNameInput = document.getElementById('vllmModelName');

        // Server configuration
        this.serverUrlInput = document.getElementById('serverUrl');
        this.testConnectionBtn = document.getElementById('testConnection');
        this.settingsBtn = document.getElementById('settingsBtn');

        // Settings modal
        this.settingsModal = document.getElementById('settingsModal');
        this.modalServerUrl = document.getElementById('modalServerUrl');
        this.bearerTokenInput = document.getElementById('bearerToken');
        this.toggleTokenBtn = document.getElementById('toggleToken');
        this.maxTokensInput = document.getElementById('maxTokens');
        this.autoSaveCheckbox = document.getElementById('autoSave');
        this.filePrefixInput = document.getElementById('filePrefix');
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
        this.saveSessionBtn = document.getElementById('saveSession');
        this.clearResponseBtn = document.getElementById('clearResponse');

        // Theme toggle
        this.themeToggle = document.getElementById('themeToggle');
        this.themeIcon = document.querySelector('.theme-icon');

        // Template and History elements
        this.saveTemplateBtn = document.getElementById('saveTemplate');
        this.loadTemplateBtn = document.getElementById('loadTemplate');
        this.historyBtn = document.getElementById('historyBtn');

        // Template modal elements
        this.templateModal = document.getElementById('templateModal');
        this.templateNameInput = document.getElementById('templateName');
        this.templateDescriptionInput = document.getElementById('templateDescription');
        this.templateTagsInput = document.getElementById('templateTags');
        this.templateFavoriteCheckbox = document.getElementById('templateFavorite');
        this.saveTemplateConfirmBtn = document.getElementById('saveTemplateConfirm');
        this.closeTemplateModalBtn = document.getElementById('closeTemplateModal');
        this.cancelTemplateBtn = document.getElementById('cancelTemplate');

        // Load template modal elements
        this.loadTemplateModal = document.getElementById('loadTemplateModal');
        this.templateSearch = document.getElementById('templateSearch');
        this.templateList = document.getElementById('templateList');
        this.closeLoadTemplateModalBtn = document.getElementById('closeLoadTemplateModal');
        this.cancelLoadTemplateBtn = document.getElementById('cancelLoadTemplate');

        // History modal elements
        this.historyModal = document.getElementById('historyModal');
        this.historySearch = document.getElementById('historySearch');
        this.historyList = document.getElementById('historyList');
        this.historyCount = document.getElementById('historyCount');
        this.clearHistoryBtn = document.getElementById('clearHistory');
        this.closeHistoryModalBtn = document.getElementById('closeHistoryModal');
        this.cancelHistoryBtn = document.getElementById('cancelHistory');

        // Stats elements
        this.firstTokenTimeSpan = document.getElementById('firstTokenTime');
        this.responseTimeSpan = document.getElementById('responseTime');
        this.tokensPerSecondSpan = document.getElementById('tokensPerSecond');
        this.tokenCountSpan = document.getElementById('tokenCount');
        this.generationTimeSpan = document.getElementById('generationTime');
        this.statusSpan = document.getElementById('status');
    }

    bindEvents() {
        // Provider selection
        this.providerSelect.addEventListener('change', (e) => {
            this.switchProvider(e.target.value);
        });

        // vLLM model name input
        this.vllmModelNameInput.addEventListener('input', (e) => {
            this.config.set('vllmModelName', e.target.value);
        });

        // Server configuration
        this.serverUrlInput.addEventListener('input', (e) => {
            const provider = this.config.get('provider');
            if (provider === 'ollama') {
                this.config.set('serverUrl', e.target.value);
            } else {
                this.config.set('vllmServerUrl', e.target.value);
            }
        });

        this.testConnectionBtn.addEventListener('click', () => this.testConnection());
        this.settingsBtn.addEventListener('click', () => this.openSettings());

        // Settings modal
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());

        // Token visibility toggle
        this.toggleTokenBtn.addEventListener('click', () => this.toggleTokenVisibility());

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
        this.saveSessionBtn.addEventListener('click', () => this.saveSession());
        this.clearResponseBtn.addEventListener('click', () => this.clearResponse());

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Template and History events
        this.saveTemplateBtn.addEventListener('click', () => this.openSaveTemplate());
        this.loadTemplateBtn.addEventListener('click', () => this.openLoadTemplate());
        this.historyBtn.addEventListener('click', () => this.openHistory());

        // Template modal events
        this.saveTemplateConfirmBtn.addEventListener('click', () => this.saveTemplate());
        this.closeTemplateModalBtn.addEventListener('click', () => closeModal('templateModal'));
        this.cancelTemplateBtn.addEventListener('click', () => closeModal('templateModal'));

        // Load template modal events
        this.templateSearch.addEventListener('input', () => this.filterTemplates());
        this.closeLoadTemplateModalBtn.addEventListener('click', () => closeModal('loadTemplateModal'));
        this.cancelLoadTemplateBtn.addEventListener('click', () => closeModal('loadTemplateModal'));
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.filterTemplates();
            });
        });

        // History modal events
        this.historySearch.addEventListener('input', () => this.filterHistory());
        this.clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());
        this.closeHistoryModalBtn.addEventListener('click', () => closeModal('historyModal'));
        this.cancelHistoryBtn.addEventListener('click', () => closeModal('historyModal'));

        // Modal backdrop and ESC key events
        this.templateModal.addEventListener('click', (e) => {
            if (e.target === this.templateModal) closeModal('templateModal');
        });

        this.loadTemplateModal.addEventListener('click', (e) => {
            if (e.target === this.loadTemplateModal) closeModal('loadTemplateModal');
        });

        this.historyModal.addEventListener('click', (e) => {
            if (e.target === this.historyModal) closeModal('historyModal');
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.templateModal.style.display === 'flex') closeModal('templateModal');
                if (this.loadTemplateModal.style.display === 'flex') closeModal('loadTemplateModal');
                if (this.historyModal.style.display === 'flex') closeModal('historyModal');
                if (this.settingsModal.style.display === 'flex') this.closeSettings();
            }
        });

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
        // Load provider setting
        const provider = this.config.get('provider');
        this.providerSelect.value = provider;

        // Load provider-specific settings
        if (provider === 'vllm') {
            this.serverUrlInput.value = this.config.get('vllmServerUrl');
            this.vllmModelNameInput.value = this.config.get('vllmModelName');
        } else {
            this.serverUrlInput.value = this.config.get('serverUrl');
        }

        this.temperatureSlider.value = this.config.get('temperature');
        this.tempValue.textContent = this.config.get('temperature');

        // Apply saved theme
        this.applyTheme(this.config.get('theme'));

        // Switch UI to match provider
        this.switchProvider(provider, false);

        this.updateStatus('ready', '준비');
        this.updateCharCount();
    }

    switchProvider(provider, loadModels = true) {
        this.config.set('provider', provider);

        if (provider === 'vllm') {
            // Switch to vLLM mode
            this.ollamaModelSelector.style.display = 'none';
            this.vllmModelInput.style.display = 'flex';
            this.serverUrlLabel.textContent = 'vLLM 서버:';
            this.serverUrlInput.value = this.config.get('vllmServerUrl');
            this.serverUrlInput.placeholder = 'http://localhost:8000';
        } else {
            // Switch to Ollama mode
            this.ollamaModelSelector.style.display = 'flex';
            this.vllmModelInput.style.display = 'none';
            this.serverUrlLabel.textContent = 'Ollama 서버:';
            this.serverUrlInput.value = this.config.get('serverUrl');
            this.serverUrlInput.placeholder = 'http://localhost:11434';

            if (loadModels) {
                this.loadModels();
            }
        }
    }

    // Helper method to get proxy-aware URL
    getProxiedUrl(endpoint) {
        const serverUrl = this.config.get('serverUrl');

        // Check if using Ollama Cloud
        if (serverUrl.includes('ollama.com')) {
            // In development (localhost), use proxy to avoid CORS
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return `/ollama-cloud${endpoint}`;
            }
        }

        // For local Ollama or production, use direct URL
        return `${serverUrl}${endpoint}`;
    }

    async testConnection() {
        const originalText = this.testConnectionBtn.textContent;
        const originalStatus = this.statusSpan.textContent;
        const provider = this.config.get('provider');

        this.testConnectionBtn.textContent = '테스트중...';
        this.testConnectionBtn.disabled = true;
        this.updateStatus('generating', '연결 테스트중...');

        try {
            if (provider === 'vllm') {
                // Test vLLM connection
                const vllmProvider = new VLLMProvider(this.config.config);
                const success = await vllmProvider.testConnection();

                if (success) {
                    this.updateStatus('complete', '연결 성공');
                    this.showToast('vLLM 서버 연결 성공!', 'success');
                } else {
                    throw new Error('vLLM 서버에 연결할 수 없습니다');
                }
            } else {
                // Test Ollama connection
                const headers = {};
                const bearerToken = this.config.get('bearerToken');
                if (bearerToken) {
                    headers['Authorization'] = `Bearer ${bearerToken}`;
                }

                const response = await fetch(this.getProxiedUrl('/api/tags'), {
                    method: 'GET',
                    headers: headers,
                    timeout: 5000
                });

                if (response.ok) {
                    this.updateStatus('complete', '연결 성공');
                    this.showToast('Ollama 서버 연결 성공!', 'success');
                    this.loadModels(); // Refresh models on successful connection
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
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
        this.bearerTokenInput.value = this.config.get('bearerToken') || '';
        this.maxTokensInput.value = this.config.get('maxTokens');
        this.autoSaveCheckbox.checked = this.config.get('autoSave');
        this.filePrefixInput.value = this.config.get('filePrefix');
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

    toggleTokenVisibility() {
        const input = this.bearerTokenInput;
        const btn = this.toggleTokenBtn;

        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
            btn.title = '토큰 숨김';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
            btn.title = '토큰 표시';
        }
    }

    saveSettings() {
        const newConfig = {
            serverUrl: this.modalServerUrl.value.trim(),
            bearerToken: this.bearerTokenInput.value.trim(),
            maxTokens: parseInt(this.maxTokensInput.value),
            autoSave: this.autoSaveCheckbox.checked,
            filePrefix: this.filePrefixInput.value.trim() || 'PromptLab'
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
            const headers = {};
            const bearerToken = this.config.get('bearerToken');
            if (bearerToken) {
                headers['Authorization'] = `Bearer ${bearerToken}`;
            }

            const response = await fetch(this.getProxiedUrl('/api/tags'), {
                headers: headers
            });
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
        const provider = this.config.get('provider');

        if (!prompt) {
            this.showToast('프롬프트를 입력해주세요', 'warning');
            return;
        }

        // Validate model selection based on provider
        if (provider === 'vllm') {
            const modelName = this.config.get('vllmModelName');
            if (!modelName) {
                this.showToast('vLLM 모델 이름을 입력해주세요', 'warning');
                return;
            }
        } else {
            const model = this.modelSelect.value;
            if (!model) {
                this.showToast('모델을 선택해주세요', 'warning');
                return;
            }
        }

        this.startGeneration();

        try {
            const controller = new AbortController();
            this.currentController = controller;

            if (provider === 'vllm') {
                // Use vLLM provider
                await this.sendVLLMPrompt(prompt, controller);
            } else {
                // Use Ollama provider
                await this.sendOllamaPrompt(prompt, controller);
            }

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

    async sendOllamaPrompt(prompt, controller) {
        const model = this.modelSelect.value;
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

        const headers = {
            'Content-Type': 'application/json',
        };

        // Add Bearer token if configured
        const bearerToken = this.config.get('bearerToken');
        if (bearerToken) {
            headers['Authorization'] = `Bearer ${bearerToken}`;
        }

        const response = await fetch(this.getProxiedUrl('/api/generate'), {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        await this.handleStreamResponse(response);
    }

    async sendVLLMPrompt(prompt, controller) {
        const vllmProvider = new VLLMProvider(this.config.config);
        let accumulatedResponse = '';

        await vllmProvider.generateStream(
            prompt,
            {
                temperature: this.config.get('temperature'),
                max_tokens: this.config.get('maxTokens'),
                signal: controller.signal
            },
            (text) => {
                // onChunk callback
                if (!this.firstTokenTime) {
                    this.firstTokenTime = Date.now();
                }
                accumulatedResponse += text;
                this.tokenCount++;
                this.updateStreamingDisplay(accumulatedResponse);
                this.updateStats();
            },
            () => {
                // onComplete callback
                // Stream completed successfully
            },
            (error) => {
                // onError callback
                throw error;
            }
        );
    }

    startGeneration() {
        this.startTime = Date.now();
        this.firstTokenTime = null;
        this.tokenCount = 0;
        this.sendBtn.disabled = true;
        this.stopBtn.style.display = 'inline-flex';
        this.sendBtn.style.display = 'none';

        const provider = this.config.get('provider');
        const model = provider === 'vllm'
            ? this.config.get('vllmModelName')
            : this.modelSelect.value;

        const serverUrl = provider === 'vllm'
            ? this.config.get('vllmServerUrl')
            : this.config.get('serverUrl');

        // Initialize current session
        this.currentSession = {
            prompt: this.promptInput.value.trim(),
            response: '',
            model: model,
            provider: provider,
            settings: {
                serverUrl: serverUrl,
                temperature: this.config.get('temperature'),
                maxTokens: this.config.get('maxTokens')
            },
            metrics: {},
            timestamp: new Date().toISOString()
        };

        this.clearResponse(false);
        this.responseContainer.innerHTML = '<span class="streaming-cursor"></span>';
        this.responseActions.style.display = 'none';

        this.updateStatus('generating', '생성중...');
        this.firstTokenTimeSpan.textContent = '';
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
        const firstTokenElapsed = this.firstTokenTime ? this.firstTokenTime - this.startTime : 0;

        if (firstTokenElapsed > 0) {
            this.firstTokenTimeSpan.textContent = `첫토큰: ${firstTokenElapsed}ms`;
        }
        this.responseTimeSpan.textContent = `총시간: ${elapsed}ms`;
        this.generationTimeSpan.textContent = `${elapsed}ms`;

        let tokensPerSecond = 0;
        if (this.tokenCount > 0 && elapsed > 0) {
            tokensPerSecond = Math.round((this.tokenCount / elapsed) * 1000 * 100) / 100;
            this.tokensPerSecondSpan.textContent = `${tokensPerSecond} tokens/s`;
        }

        // Update session metrics
        this.currentSession.response = this.responseContainer.textContent || '';
        this.currentSession.metrics = {
            firstTokenTime: firstTokenElapsed,
            responseTime: elapsed,
            tokenCount: this.tokenCount,
            tokensPerSecond: tokensPerSecond,
            characterCount: this.currentSession.prompt.length,
            responseLength: this.currentSession.response.length
        };

        // 성공적으로 완료된 경우에만 히스토리에 저장
        if (this.currentSession.response && this.currentSession.response.trim()) {
            this.templateHistory.addHistory({
                prompt: this.currentSession.prompt,
                response: this.currentSession.response,
                model: this.currentSession.model,
                settings: this.currentSession.settings,
                responseTime: elapsed,
                tokenCount: this.tokenCount,
                tokensPerSecond: tokensPerSecond
            });
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
                            // 첫 토큰 시간 기록
                            if (!this.firstTokenTime) {
                                this.firstTokenTime = Date.now();
                            }

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
            this.firstTokenTimeSpan.textContent = '';
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

    saveSession() {
        if (!this.currentSession.response || this.currentSession.response === '프롬프트를 입력하고 전송 버튼을 눌러주세요.') {
            this.showToast('저장할 응답이 없습니다', 'warning');
            return;
        }

        try {
            const sessionData = this.generateSessionData();
            const fileName = this.generateFileName();
            this.downloadFile(sessionData, fileName);
            this.showToast('세션이 저장되었습니다', 'success');
        } catch (error) {
            console.error('세션 저장 실패:', error);
            this.showToast('세션 저장에 실패했습니다', 'error');
        }
    }

    generateFileName() {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
        const modelName = this.currentSession.model.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
        const promptPreview = this.currentSession.prompt
            .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
            .substring(0, 30)
            .replace(/\s+/g, '_');

        const prefix = this.config.get('filePrefix') || 'PromptLab';
        return `${prefix}_${timestamp}_${modelName}_${promptPreview}.md`;
    }

    generateSessionData() {
        const session = this.currentSession;
        const date = new Date(session.timestamp);

        return `# PromptLab Session Report

## 📋 Session Information
- **Date**: ${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR')}
- **Model**: ${session.model}
- **Server**: ${session.settings.serverUrl}

## ⚙️ Settings
- **Temperature**: ${session.settings.temperature}
- **Max Tokens**: ${session.settings.maxTokens.toLocaleString()}

## 📝 Prompt
\`\`\`
${session.prompt}
\`\`\`

## 🤖 Response
\`\`\`
${session.response}
\`\`\`

## 📊 Performance Metrics
- **First Token Time**: ${session.metrics.firstTokenTime}ms
- **Total Response Time**: ${session.metrics.responseTime}ms
- **Token Count**: ${session.metrics.tokenCount.toLocaleString()}
- **Tokens/Second**: ${session.metrics.tokensPerSecond}
- **Prompt Length**: ${session.metrics.characterCount.toLocaleString()} characters
- **Response Length**: ${session.metrics.responseLength.toLocaleString()} characters

---
*Generated by PromptLab - AI Testing Studio*
*Timestamp: ${session.timestamp}*
`;
    }

    downloadFile(content, fileName) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    toggleTheme() {
        const currentTheme = this.config.get('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        this.config.set('theme', newTheme);
        this.applyTheme(newTheme);

        this.showToast(`${newTheme === 'dark' ? '다크' : '라이트'} 테마로 변경되었습니다`, 'success');
    }

    applyTheme(theme) {
        const body = document.body;
        const isDark = theme === 'dark';

        if (isDark) {
            body.setAttribute('data-theme', 'dark');
            this.themeIcon.textContent = '☀️';
        } else {
            body.removeAttribute('data-theme');
            this.themeIcon.textContent = '🌙';
        }

        // Add smooth transition
        body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            body.style.transition = '';
        }, 300);
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

    // 템플릿 관리 메서드들
    openSaveTemplate() {
        const currentPrompt = this.promptInput.value.trim();
        if (!currentPrompt) {
            this.showToast('저장할 프롬프트를 먼저 입력해주세요.', 'warning');
            return;
        }

        // 입력 필드 초기화
        this.templateNameInput.value = '';
        this.templateDescriptionInput.value = '';
        this.templateTagsInput.value = '';
        this.templateFavoriteCheckbox.checked = false;

        this.templateModal.style.display = 'flex';
        setTimeout(() => this.templateNameInput.focus(), 100);
    }

    saveTemplate() {
        const name = this.templateNameInput.value.trim();
        const description = this.templateDescriptionInput.value.trim();
        const tags = this.templateTagsInput.value.trim();
        const favorite = this.templateFavoriteCheckbox.checked;
        const prompt = this.promptInput.value.trim();

        if (!name) {
            this.showToast('템플릿 이름을 입력해주세요.', 'warning');
            this.templateNameInput.focus();
            return;
        }

        if (!prompt) {
            this.showToast('저장할 프롬프트가 없습니다.', 'warning');
            return;
        }

        // 중복 이름 검사
        const existingTemplate = this.templateHistory.templates.find(t => t.name === name);
        if (existingTemplate) {
            if (!confirm('같은 이름의 템플릿이 존재합니다. 덮어쓰시겠습니까?')) {
                return;
            }
            this.templateHistory.deleteTemplate(existingTemplate.id);
        }

        const template = this.templateHistory.saveTemplate({
            name,
            description,
            tags,
            favorite,
            prompt
        });

        this.showToast(`템플릿 "${name}"이 저장되었습니다.`, 'success');
        closeModal('templateModal');
    }

    openLoadTemplate() {
        this.loadTemplateModal.style.display = 'flex';
        this.filterTemplates();
        setTimeout(() => this.templateSearch.focus(), 100);
    }

    filterTemplates() {
        const searchTerm = this.templateSearch.value.trim();
        const activeFilter = document.querySelector('.filter-tab.active').dataset.filter;
        const templates = this.templateHistory.getTemplates(activeFilter, searchTerm);
        this.renderTemplateList(templates);
    }

    renderTemplateList(templates) {
        if (templates.length === 0) {
            this.templateList.innerHTML = '<div class="no-templates">조건에 맞는 템플릿이 없습니다</div>';
            return;
        }

        const html = templates.map(template => `
            <div class="template-item" data-id="${template.id}">
                <div class="template-header">
                    <div class="template-name">${this.escapeHtml(template.name)}${template.favorite ? ' <span class="favorite-star">★</span>' : ''}</div>
                </div>
                ${template.description ? `<div class="template-description">${this.escapeHtml(template.description)}</div>` : ''}
                <div class="template-meta">
                    <span>생성: ${this.formatDate(template.createdAt)}</span>
                    <span>사용횟수: ${template.usageCount || 0}</span>
                </div>
                ${template.tags.length > 0 ? `<div class="template-tags">${template.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                <div class="prompt-preview">${this.escapeHtml(template.prompt.substring(0, 200))}${template.prompt.length > 200 ? '...' : ''}</div>
                <div class="template-actions">
                    <button class="action-btn favorite-btn" data-template-id="${template.id}">
                        ${template.favorite ? '★' : '☆'}
                    </button>
                    <button class="action-btn danger delete-btn" data-template-id="${template.id}">🗑️</button>
                </div>
            </div>
        `).join('');

        this.templateList.innerHTML = html;

        // 템플릿 아이템 클릭 이벤트
        this.templateList.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('action-btn')) {
                    const templateId = item.dataset.id;
                    this.loadTemplateById(templateId);
                }
            });
        });

        // 템플릿 액션 버튼 이벤트
        this.templateList.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const templateId = btn.dataset.templateId;
                this.toggleTemplateFavorite(templateId);
            });
        });

        this.templateList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const templateId = btn.dataset.templateId;
                this.deleteTemplate(templateId);
            });
        });
    }

    loadTemplateById(templateId) {
        const template = this.templateHistory.useTemplate(templateId);
        if (template) {
            this.promptInput.value = template.prompt;
            this.promptInput.dispatchEvent(new Event('input'));
            this.showToast(`템플릿 "${template.name}"을 불러왔습니다.`, 'success');
            closeModal('loadTemplateModal');
        }
    }

    toggleTemplateFavorite(templateId) {
        const template = this.templateHistory.templates.find(t => t.id === templateId);
        if (template) {
            template.favorite = !template.favorite;
            this.templateHistory.saveTemplates();
            this.filterTemplates();
        }
    }

    deleteTemplate(templateId) {
        const template = this.templateHistory.templates.find(t => t.id === templateId);
        if (template && confirm(`템플릿 "${template.name}"을 삭제하시겠습니까?`)) {
            this.templateHistory.deleteTemplate(templateId);
            this.filterTemplates();
            this.showToast('템플릿이 삭제되었습니다.', 'success');
        }
    }

    // 히스토리 관리 메서드들
    openHistory() {
        this.historyModal.style.display = 'flex';
        this.updateHistoryCount();
        this.filterHistory();
        setTimeout(() => this.historySearch.focus(), 100);
    }

    filterHistory() {
        const searchTerm = this.historySearch.value.trim();
        const history = this.templateHistory.getHistory(searchTerm);
        this.renderHistoryList(history);
    }

    renderHistoryList(history) {
        if (history.length === 0) {
            this.historyList.innerHTML = '<div class="no-history">조건에 맞는 히스토리가 없습니다</div>';
            return;
        }

        const html = history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-header">
                    <div class="history-prompt">${this.escapeHtml(this.truncateText(item.prompt, 80))}</div>
                </div>
                <div class="history-meta">
                    <span>${this.formatDate(item.timestamp)}</span>
                </div>
                <div class="history-details">
                    <span class="history-model">${this.escapeHtml(item.model)}</span>
                    <span class="history-timing">${item.responseTime}ms</span>
                    <span class="tag">${item.tokenCount} tokens</span>
                    ${item.tokensPerSecond ? `<span class="tag">${item.tokensPerSecond} t/s</span>` : ''}
                </div>
                <div class="prompt-preview">${this.escapeHtml(this.truncateText(item.prompt, 200))}</div>
                <div class="history-actions">
                    <button class="action-btn load-btn" data-history-id="${item.id}">📝</button>
                    <button class="action-btn export-btn" data-history-id="${item.id}">💾</button>
                    <button class="action-btn danger delete-history-btn" data-history-id="${item.id}">🗑️</button>
                </div>
            </div>
        `).join('');

        this.historyList.innerHTML = html;

        // 히스토리 액션 버튼 이벤트
        this.historyList.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const historyId = btn.dataset.historyId;
                this.loadHistoryItem(historyId);
            });
        });

        this.historyList.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const historyId = btn.dataset.historyId;
                this.exportHistoryItem(historyId);
            });
        });

        this.historyList.querySelectorAll('.delete-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const historyId = btn.dataset.historyId;
                this.deleteHistoryItem(historyId);
            });
        });
    }

    loadHistoryItem(historyId) {
        const item = this.templateHistory.history.find(h => h.id === historyId);
        if (item) {
            this.promptInput.value = item.prompt;
            this.promptInput.dispatchEvent(new Event('input'));

            // 설정도 복원
            if (item.settings && item.settings.temperature !== undefined) {
                this.temperatureSlider.value = item.settings.temperature;
                this.tempValue.textContent = item.settings.temperature;
            }

            this.showToast('히스토리에서 프롬프트를 불러왔습니다.', 'success');
            closeModal('historyModal');
        }
    }

    exportHistoryItem(historyId) {
        const item = this.templateHistory.history.find(h => h.id === historyId);
        if (item) {
            const content = this.generateMarkdownContent(item);
            this.downloadFile(content, `History_${this.formatDateForFilename(item.timestamp)}.md`);
        }
    }

    deleteHistoryItem(historyId) {
        if (confirm('이 히스토리 항목을 삭제하시겠습니까?')) {
            this.templateHistory.deleteHistory(historyId);
            this.filterHistory();
            this.updateHistoryCount();
            this.showToast('히스토리 항목이 삭제되었습니다.', 'success');
        }
    }

    clearAllHistory() {
        if (confirm('모든 히스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            this.templateHistory.clearHistory();
            this.filterHistory();
            this.updateHistoryCount();
            this.showToast('모든 히스토리가 삭제되었습니다.', 'success');
        }
    }

    updateHistoryCount() {
        const count = this.templateHistory.history.length;
        this.historyCount.textContent = `총 ${count}개의 테스트`;
    }

    // 유틸리티 메서드들
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateForFilename(dateString) {
        const date = new Date(dateString);
        return date.toISOString().slice(0, 19).replace(/[T:]/g, '_').replace(/[-]/g, '');
    }

    generateMarkdownContent(item) {
        return `# PromptLab 테스트 히스토리

## 기본 정보
- **날짜**: ${this.formatDate(item.timestamp)}
- **모델**: ${item.model}
- **응답 시간**: ${item.responseTime}ms
- **토큰 수**: ${item.tokenCount}
- **속도**: ${item.tokensPerSecond || 'N/A'} tokens/s

## 설정
- **Temperature**: ${item.settings?.temperature || 'N/A'}
- **서버**: ${item.settings?.serverUrl || 'N/A'}

## 프롬프트
\`\`\`
${item.prompt}
\`\`\`

## 응답
\`\`\`
${item.response}
\`\`\`

---
*Generated by PromptLab - AI Testing Studio*`;
    }

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Global utility functions - 페이지 로드 전에 정의
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Global app instance for template/history button callbacks
let app;

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
    app = new AdvancedOllamaPromptTester();
    initializeContextMenu();
});