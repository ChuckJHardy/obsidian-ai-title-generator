# Obsidian AI Title Generator

A plugin for [Obsidian](https://obsidian.md) that automatically generates concise, descriptive titles for your notes using AI.

## Features

- Generate descriptive titles with a single command
- Support for multiple AI providers:
  - Anthropic Claude
  - OpenAI ChatGPT
  - Google Gemini
- Customize your title generation prompt
- Set maximum title length
- Choose from various AI models for each provider

## Installation

1. Open Obsidian
2. Go to Settings > Community plugins
3. Turn off Restricted mode
4. Click "Browse" and search for "AI Title Generator"
5. Install the plugin and enable it

## Setup

1. Open Settings > AI Title Generator
2. Select your preferred AI provider
3. Enter your API key for the selected provider
4. Choose your preferred model
5. Adjust other settings as needed

## Usage

1. Open a note you want to rename
2. Use the command palette (Ctrl/Cmd+P) and search for "AI Title Generator: Generate"
3. The plugin will analyze your note's content and rename it with an AI-generated title

## API Keys

You'll need an API key from your chosen provider:

- **Anthropic**: Get a key from [Anthropic's Console](https://console.anthropic.com/)
- **OpenAI**: Get a key from [OpenAI's Platform](https://platform.openai.com/api-keys)
- **Google Gemini**: Get a key from [Google AI Studio](https://aistudio.google.com/)

## Customization

You can customize the prompt used to generate titles in the settings. Use the `{maxTitleLength}` placeholder to dynamically insert your maximum title length.

## Privacy

This plugin sends your note content to external AI APIs. Please review each provider's privacy policy:
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)
- [Google AI Privacy Policy](https://policies.google.com/privacy)

## Support

If you encounter issues or have questions, please file them on [GitHub](https://github.com/chuckjhardy/obsidian-ai-title).

## Contributing and Development

If you want to customize the plugin or contribute to its development:

1. Clone the repository
```bash
git clone https://github.com/chuckjhardy/obsidian-ai-title
cd obsidian-ai-title
```

2. Install dependencies
```bash
pnpm i
```

3. Start the development server
```bash
pnpm dev
```

4. Create a symbolic link from your clone to your Obsidian plugins folder to test changes:
```bash
# Example for macOS/Linux
mkdir -p /path/to/your/vault/.obsidian/plugins/ai-title-generator
ln -s /path/to/cloned/repo/main.js /path/to/your/vault/.obsidian/plugins/ai-title-generator/
ln -s /path/to/cloned/repo/manifest.json /path/to/your/vault/.obsidian/plugins/ai-title-generator/
ln -s /path/to/cloned/repo/styles.css /path/to/your/vault/.obsidian/plugins/ai-title-generator/
```

5. Enable the plugin in Obsidian

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)