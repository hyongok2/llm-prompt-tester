class OllamaPromptTester {
    constructor() {
        this.baseURL = 'http://localhost:11434';
        this.currentController = null;
        this.startTime = null;
        this.tokenCount = 0;

        this.initializeElements();
        this.bindEvents();
        this.loadModels();
        this.initializeSettings();
    }

    initializeElements() {
        // UI 요소들
        this.modelSelect = document.getElementById('modelSelect');
        this.refreshModelsBtn = document.getElementById('refreshModels');
        this.temperatureSlider = document.getElementById('temperature');
        this.tempValue = document.getElementById('tempValue');
        this.promptInput = document.getElementById('promptInput');
        this.sendBtn = document.getElementById('sendPrompt');
        this.clearPromptBtn = document.getElementById('clearPrompt');
        this.stopBtn = document.getElementById('stopGeneration');
        this.responseContainer = document.getElementById('responseContainer');
        this.responseActions = document.querySelector('.response-actions');
        this.copyBtn = document.getElementById('copyResponse');
        this.clearResponseBtn = document.getElementById('clearResponse');

        // 상태 및 통계 요소들
        this.responseTimeSpan = document.getElementById('responseTime');
        this.tokensPerSecondSpan = document.getElementById('tokensPerSecond');
        this.tokenCountSpan = document.getElementById('tokenCount');
        this.generationTimeSpan = document.getElementById('generationTime');
        this.statusSpan = document.getElementById('status');
    }

    bindEvents() {
        this.refreshModelsBtn.addEventListener('click', () => this.loadModels());
        this.temperatureSlider.addEventListener('input', (e) => {
            this.tempValue.textContent = e.target.value;
        });
        this.sendBtn.addEventListener('click', () => this.sendPrompt());
        this.clearPromptBtn.addEventListener('click', () => this.clearPrompt());
        this.stopBtn.addEventListener('click', () => this.stopGeneration());
        this.copyBtn.addEventListener('click', () => this.copyResponse());
        this.clearResponseBtn.addEventListener('click', () => this.clearResponse());

        // Enter 키 단축키 (Ctrl+Enter로 전송)
        this.promptInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.sendPrompt();
            }
        });
    }

    initializeSettings() {
        this.updateStatus('ready', '준비');
    }

    async loadModels() {
        this.updateStatus('generating', '모델 로딩중...');
        this.modelSelect.innerHTML = '<option value="">로딩중...</option>';

        try {
            const response = await fetch(`${this.baseURL}/api/tags`);
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
            this.showError('Ollama 서버에 연결할 수 없습니다. Ollama가 실행중인지 확인해주세요.');
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
            alert('프롬프트를 입력해주세요.');
            return;
        }

        if (!model) {
            alert('모델을 선택해주세요.');
            return;
        }

        this.startGeneration();

        try {
            const controller = new AbortController();
            this.currentController = controller;

            const response = await fetch(`${this.baseURL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    temperature: parseFloat(this.temperatureSlider.value),
                    stream: true
                }),
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

        // 커서 제거
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
        // 기존 텍스트 업데이트 + 깜빡이는 커서 유지
        const cursor = this.responseContainer.querySelector('.streaming-cursor');
        this.responseContainer.textContent = text;
        if (cursor) {
            this.responseContainer.appendChild(cursor);
        } else {
            this.responseContainer.innerHTML += '<span class="streaming-cursor"></span>';
        }

        // 자동 스크롤
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

    copyResponse() {
        const text = this.responseContainer.textContent;
        if (text && text !== '프롬프트를 입력하고 전송 버튼을 눌러주세요.') {
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.copyBtn.textContent;
                this.copyBtn.textContent = '복사됨! ✓';
                setTimeout(() => {
                    this.copyBtn.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('복사 실패:', err);
                alert('복사에 실패했습니다.');
            });
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
}

// DOM이 로드되면 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new OllamaPromptTester();
});

// 예시 프롬프트 데이터
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

질문: React에서 상태 관리를 위한 최적의 방법은 무엇인가요? 프로젝트 규모별로 추천해주세요.`
};

// 예시 프롬프트 추가 기능
document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');

    // 우클릭 컨텍스트 메뉴로 예시 프롬프트 추가
    promptInput.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showExampleMenu(e.pageX, e.pageY);
    });
});

function showExampleMenu(x, y) {
    // 기존 메뉴 제거
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 200px;
    `;

    Object.entries(examplePrompts).forEach(([name, prompt]) => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
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
            menu.remove();
        });

        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // 클릭 시 메뉴 닫기
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