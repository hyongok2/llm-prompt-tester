# 🤖 LLM Prompt Tester

Advanced LLM prompt testing tool supporting both Ollama and vLLM with modern UI and comprehensive features.

## ✨ Features

### 🔀 Multi-Provider Support
- **Ollama Integration** - Full support for Ollama API (local and cloud)
- **vLLM Integration** - Native vLLM OpenAI-compatible API support
- **Easy Provider Switching** - Toggle between providers with a single click
- **Provider-Specific Configuration** - Separate settings for each provider

### 🔧 Configuration Management
- **Configurable Server URLs** - Connect to any Ollama or vLLM instance
- **Settings Persistence** - All preferences saved to localStorage
- **Connection Testing** - Test connection before usage
- **Auto-save Settings** - Automatic configuration backup

### 📝 Prompt Management
- **Large Text Support** - Perfect for agent prompts and long texts
- **Character Counter** - Real-time character count with warning indicators
- **Example Prompts** - Right-click for quick prompt templates
- **Keyboard Shortcuts** - Ctrl+Enter to send, ESC to close modals

### ⚡ Real-time Streaming
- **Live Response Streaming** - See responses as they generate
- **Typing Animation** - Smooth cursor animation during generation
- **Stop Generation** - Cancel ongoing requests
- **Progress Indicators** - Real-time status updates

### 📊 Performance Monitoring
- **Response Time Tracking** - Precise timing in milliseconds
- **Token Generation Speed** - Tokens per second calculation
- **Token Counting** - Accurate token count display
- **Performance Stats** - Comprehensive generation metrics

### 🎨 Modern UI/UX
- **Responsive Design** - Works on desktop and mobile
- **Dark/Light Themes** - Gradient backgrounds and modern styling
- **Toast Notifications** - User-friendly feedback system
- **Modal Settings** - Clean settings interface
- **Copy/Export** - Easy response copying and sharing

## 🚀 Quick Start

### Prerequisites
- [Ollama](https://ollama.ai/) installed and running
- Modern web browser
- Node.js (for development)

### Installation

```bash
# Clone or download the project
cd lmm-prompt-tester

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Serve production build
npm run serve
```

## 🛠️ Usage

### 1. Configure Ollama Server
- Default: `http://localhost:11434`
- Click the settings (⚙️) button to configure
- Test connection with the 🔗 button

### 2. Select Model
- Models are automatically loaded from your Ollama instance
- Choose from available models in the dropdown
- File sizes are displayed for reference

### 3. Write Prompts
- Large textarea supports multi-line prompts
- Character counter shows prompt length
- Right-click for example prompts

### 4. Generate Responses
- Click "전송 📤" or use Ctrl+Enter
- Watch real-time streaming responses
- Monitor performance metrics

### 5. Manage Responses
- Copy responses with one click
- Clear responses when needed
- Export or save for later use

## ⚙️ Configuration Options

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| Server URL | Ollama server endpoint | `http://localhost:11434` | Any valid URL |
| Bearer Token | API authentication token | `` (empty) | Any valid token |
| Temperature | Response creativity | `0.7` | 0-2.0 |
| Max Tokens | Maximum response length | `32,768` | 100-131,072 |
| Auto-save | Automatic settings persistence | `true` | true/false |

### 🌐 Ollama Cloud Usage

To use Ollama Cloud instead of local installation:

1. **Get API Key**: Create an API key at [ollama.com](https://ollama.com/settings/keys)
2. **Run Development Server**: `npm run dev` (required to avoid CORS issues)
3. **Configure in App**:
   - Provider: Select **Ollama**
   - Server URL: `https://ollama.com/api`
   - Bearer Token: Paste your API key
4. **Test Connection**: Click the 🔗 button to verify

**Important Notes:**
- ⚠️ **Development mode required**: Use `npm run dev` to enable the proxy server
- The proxy automatically routes requests through `localhost:3000` to avoid CORS errors
- Direct file opening (`file://`) won't work due to browser CORS restrictions

**Example Configuration:**
- Provider: **Ollama**
- Server URL: `https://ollama.com/api`
- Bearer Token: `your-api-key-here`
- Models: Access cloud models like `gpt-oss:120b`, `deepseek-v3.1:671b`, `kimi-k2:1t`

**Available Cloud Models:**
- `cogito-2.1:671b` - 671B parameter model
- `kimi-k2:1t` - 1T parameter model
- `deepseek-v3.1:671b` - DeepSeek V3.1
- `mistral-large-3:675b` - Mistral Large 3
- `gpt-oss:120b` - GPT-OSS 120B
- `qwen3-coder:480b` - Qwen 3 Coder

### 🚀 vLLM Usage

To use vLLM (local deployment):

1. **Start vLLM Server**: Launch your vLLM instance with a model
   ```bash
   # Example: Run vLLM with Llama-2-7b
   python -m vllm.entrypoints.openai.api_server \
     --model meta-llama/Llama-2-7b-hf \
     --host 0.0.0.0 \
     --port 8000
   ```

2. **Configure in App**:
   - Provider: Select **vLLM**
   - Server URL: `http://localhost:8000` (or your vLLM server address)
   - Model Name: Enter the exact model name (e.g., `meta-llama/Llama-2-7b-hf`)

3. **Test Connection**: Click the 🔗 button to verify

**Key Differences from Ollama:**
- **Single Model**: vLLM runs one model per server instance
- **No Model List**: Enter model name manually (no dropdown)
- **No Authentication**: Local vLLM doesn't require bearer tokens
- **OpenAI API**: Uses OpenAI-compatible `/v1/completions` endpoint

**Example Configuration:**
- Provider: **vLLM**
- Server URL: `http://localhost:8000`
- Model Name: `meta-llama/Llama-2-7b-hf`
- Temperature: `0.7`
- Max Tokens: `2048-32768`

**Supported Models:**
Any model supported by vLLM, including:
- Meta Llama series (`meta-llama/Llama-2-*`, `meta-llama/Llama-3-*`)
- Mistral models (`mistralai/Mistral-7B-*`)
- Yi models (`01-ai/Yi-*`)
- DeepSeek models (`deepseek-ai/deepseek-*`)
- And many more from HuggingFace

### 🧠 Large Context Model Support

Perfect for high-context models like:
- **gpt-oss:20b** - 20B parameter model with large context
- **deepseek-coder:33b** - Code-focused large model
- **yi:34b** - Large multilingual model
- **mixtral:8x22b** - Mixture of experts model

**Recommended Token Limits by Model:**
- Small models (7B-13B): 4K-8K tokens
- Medium models (20B-34B): 16K-32K tokens
- Large models (70B+): 32K-128K tokens

## 📱 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Send prompt |
| `ESC` | Close modal |
| `Right-click` | Show example prompts |

## 🔗 API Integration

The tool integrates with Ollama's REST API:

- **GET** `/api/tags` - List available models
- **POST** `/api/generate` - Generate streaming responses

### Request Format
```json
{
  "model": "llama3.2",
  "prompt": "Your prompt here",
  "temperature": 0.7,
  "stream": true,
  "options": {
    "num_predict": 2048
  }
}
```

## 🏗️ Architecture

### Technologies Used
- **Vite** - Modern build tool
- **Vanilla JavaScript** - No framework dependencies
- **CSS Grid/Flexbox** - Responsive layouts
- **Local Storage** - Settings persistence
- **Fetch API** - HTTP requests
- **Streaming** - Real-time response handling

### Project Structure
```
lmm-prompt-tester/
├── index.html          # Main HTML structure
├── main.js             # Core application logic
├── styles.css          # Complete styling
├── package.json        # Dependencies and scripts
├── vite.config.js      # Build configuration
└── README.md           # This file
```

### Key Classes
- `ConfigManager` - Settings and persistence
- `AdvancedOllamaPromptTester` - Main application
- Context menu system for examples
- Toast notification system

## 🔧 Development

### Adding New Features
1. Extend the `AdvancedOllamaPromptTester` class
2. Add new UI elements to `index.html`
3. Style with CSS in `styles.css`
4. Update configuration in `ConfigManager`

### Custom Prompts
Add new examples to the `examplePrompts` object:
```javascript
const examplePrompts = {
  "Custom Prompt": "Your prompt text here...",
  // Add more...
};
```

## 🚀 Deployment

### Static Hosting
```bash
npm run build
# Deploy dist/ folder to any static host
```

### Docker (Optional)
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Troubleshooting

### Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check firewall settings
- Verify server URL in settings

### Model Loading Problems
- Install models: `ollama pull llama3.2`
- Check available models: `ollama list`
- Restart Ollama service

### Performance Issues
- Reduce max tokens
- Lower temperature
- Use smaller models

## 📞 Support

For issues and questions:
1. Check troubleshooting section
2. Review Ollama documentation
3. Open GitHub issue

---

**Made with ❤️ for the AI community**