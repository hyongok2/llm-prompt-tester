# 🤖 LLM Prompt Tester

Advanced Ollama-based prompt testing tool with modern UI and comprehensive features.

## ✨ Features

### 🔧 Configuration Management
- **Configurable Ollama Server URL** - Connect to any Ollama instance
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
| Temperature | Response creativity | `0.7` | 0-2.0 |
| Max Tokens | Maximum response length | `32,768` | 100-131,072 |
| Auto-save | Automatic settings persistence | `true` | true/false |

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