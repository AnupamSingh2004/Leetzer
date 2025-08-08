# LeetCode Code Analyzer Extension

A powerful Chrome extension that integrates with LeetCode to provide real-time code analysis, error detection, solution generation, and optimization suggestions using Google's Gemini AI.

## 🚀 Features

### Core Functionality
- **Real-time Code Analysis**: Automatically detects syntax errors, logic issues, and potential runtime problems
- **AI-Powered Solution Generation**: Generates clean, optimal solutions for LeetCode problems
- **Complexity Analysis**: Provides detailed time and space complexity breakdowns
- **Code Optimization**: Suggests improvements for better performance and cleaner code
- **Multi-language Support**: JavaScript, Python, C++, Java, C#, Go, Rust, TypeScript

### User Interface
- **Seamless Integration**: Non-intrusive dropdown interface that adapts to LeetCode's theme
- **Tabbed Organization**: Clean separation of analysis, solutions, complexity, and optimization features
- **Real-time Feedback**: Instant notifications and visual indicators
- **Responsive Design**: Works on desktop and mobile browsers

### Smart Features
- **Auto-detection**: Automatically identifies code editor and programming language
- **Problem Context**: Uses problem title, difficulty, and description for better analysis
- **Secure Storage**: Encrypted local storage for API keys and settings
- **Rate Limiting**: Built-in protection against API quota exhaustion

## 📦 Installation

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/leetcode-analyzer.git
   cd leetcode-analyzer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

4. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder
   - The extension will appear in your toolbar

### Chrome Web Store (Coming Soon)
The extension will be available on the Chrome Web Store once approved.

## 🔧 Setup

### Getting Your Gemini API Key

1. **Visit Google AI Studio**: Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Sign in** with your Google account
3. **Create API Key**: Click "Create API Key" and select a project
4. **Copy the key**: Save the generated API key (starts with "AIza")

### Configure the Extension

1. **First-time setup**: A setup popup will appear when you first install the extension
2. **Enter API key**: Paste your Gemini API key in the provided field
3. **Test connection**: Click "Test Connection" to verify the key works
4. **Save settings**: Click "Save & Continue" to complete setup

## 🎯 Usage

### Basic Workflow

1. **Navigate to LeetCode**: Open any problem on [leetcode.com](https://leetcode.com)
2. **Write your code**: The extension automatically detects the code editor
3. **Analyze**: Click the analyzer icon or use the floating dropdown
4. **Get insights**: View errors, solutions, complexity analysis, and optimizations

### Features Overview

#### 🔍 Code Analysis
- Detects syntax errors and logical issues
- Identifies potential runtime problems
- Suggests fixes with line-by-line guidance
- Categorizes issues by severity (low, medium, high, critical)

#### 💡 Solution Generation
- Generates optimal solutions for any LeetCode problem
- Provides multiple approaches when available
- Includes time and space complexity information
- Clean, comment-free code ready to submit

#### ⏱️ Complexity Analysis
- Detailed breakdown of time complexity (best, average, worst case)
- Space complexity analysis
- Comparison with optimal solutions
- Visual representations and explanations

#### 🚀 Code Optimization
- Performance improvement suggestions
- Algorithm optimization recommendations
- Data structure improvements
- Before/after code comparisons

## ⚙️ Configuration

### Extension Settings

Access settings through the extension popup or setup page:

- **Theme**: Auto-detect, Light, or Dark mode
- **Auto-analysis**: Enable/disable automatic code analysis
- **Notifications**: Control popup notifications
- **Analysis Delay**: Set delay before auto-analysis triggers

### Privacy & Security

- **Local Storage**: All data is stored locally on your device
- **API Security**: API keys are encrypted and stored securely
- **No Data Collection**: We don't collect or store your code or personal data
- **Secure Requests**: All API calls use HTTPS encryption

## 🛠️ Development

### Project Structure

```
leetcode-analyzer/
├── src/
│   ├── background/          # Service worker
│   ├── content/             # Content script
│   ├── popup/               # Extension popup
│   ├── setup/               # API setup page
│   ├── types/               # TypeScript definitions
│   └── utils/               # Utility functions
├── assets/                  # Icons and static files
├── dist/                    # Built files
├── manifest.json            # Extension manifest
└── package.json            # Dependencies and scripts
```

### Available Scripts

- `npm run build`: Build the extension for production
- `npm run watch`: Watch for changes and rebuild
- `npm run dev`: Clean, build, and start watching
- `npm run clean`: Remove built files
- `npm run package`: Create distribution package

### Tech Stack

- **TypeScript**: Type-safe JavaScript development
- **Chrome Extension Manifest V3**: Latest extension API
- **Google Gemini API**: AI-powered code analysis
- **Modern CSS**: Responsive design with dark/light themes
- **No External Frameworks**: Vanilla TypeScript for performance

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow our coding standards
4. **Test thoroughly**: Ensure all features work correctly
5. **Submit a pull request**: Describe your changes clearly

### Coding Standards

- Use TypeScript for all new code
- Follow existing code style and patterns
- Add proper error handling and logging
- Include JSDoc comments for public functions
- Test on multiple browsers and screen sizes

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

- **Documentation**: Check our [Wiki](https://github.com/your-username/leetcode-analyzer/wiki)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-username/leetcode-analyzer/issues)
- **Discussions**: Join our [GitHub Discussions](https://github.com/your-username/leetcode-analyzer/discussions)

### Common Issues

#### "API key not working"
- Ensure your API key is correctly formatted (starts with "AIza")
- Check that Gemini API is enabled in your Google Cloud project
- Verify you haven't exceeded your API quota

#### "Extension not loading"
- Refresh the LeetCode page
- Check that you're on a problem page (not the problem list)
- Disable other LeetCode extensions that might conflict

#### "Code not detected"
- Wait a moment for the page to fully load
- Try clicking in the code editor to ensure it's active
- Check browser console for any error messages

## 🔮 Roadmap

### Upcoming Features

- **Enhanced AI Models**: Support for more AI providers
- **Code Explanation**: Detailed code walkthroughs and tutorials
- **Performance Benchmarking**: Compare your solution against others
- **Learning Mode**: Personalized hints and guided problem-solving
- **Team Features**: Share analysis results with study groups
- **Mobile Support**: Progressive web app for mobile coding

### Version History

- **v1.0.0**: Initial release with core analysis features
- **Coming Soon**: Enhanced optimization suggestions
- **Planned**: Multi-platform support and advanced analytics

## 🙏 Acknowledgments

- **Google Gemini**: For providing the AI analysis capabilities
- **LeetCode**: For the amazing platform that makes this extension possible
- **Open Source Community**: For inspiration and best practices
- **Beta Testers**: For valuable feedback and bug reports

---

**Made with ❤️ for the coding community**

*Enhance your LeetCode practice with AI-powered insights and become a better programmer!*
