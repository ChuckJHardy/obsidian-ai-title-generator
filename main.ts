import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  requestUrl
} from 'obsidian';

enum ProviderType {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

interface AITitlePluginSettings {
  provider: ProviderType;
  anthropicApiKey: string;
  openaiApiKey: string;
  geminiApiKey: string;
  maxTitleLength: number;
  anthropicModel: string;
  openaiModel: string;
  geminiModel: string;
}

const DEFAULT_SETTINGS: AITitlePluginSettings = {
  provider: ProviderType.ANTHROPIC,
  anthropicApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  maxTitleLength: 110,
  anthropicModel: 'claude-3-7-sonnet-latest',
  openaiModel: 'gpt-4o',
  geminiModel: 'gemini-1.5-pro'
}

export default class AITitlePlugin extends Plugin {
  settings: AITitlePluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new AITitleSettingTab(this.app, this));

    this.addCommand({
      id: 'generate-ai-title',
      name: 'Generate',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          if (!checking) {
            this.generateTitle(markdownView);
          }
          return true;
        }
      }
    });
  }

  onunload() { }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async generateTitle(view: MarkdownView) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      new Notice(`Please set your ${this.getProviderName()} API key in the settings`);
      return;
    }

    const editor = view.editor;
    const text = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No file is currently open');
      return;
    }

    new Notice('Generating title...');

    try {
      let title;
      switch (this.settings.provider) {
        case ProviderType.ANTHROPIC:
          title = await this.callAnthropicAPI(text);
          break;
        case ProviderType.OPENAI:
          title = await this.callOpenAIAPI(text);
          break;
        case ProviderType.GEMINI:
          title = await this.callGeminiAPI(text);
          break;
        default:
          throw new Error('Invalid provider selected');
      }
      
      if (title) {
        const newPath = file.path.replace(/[^/]+$/, `${title}.md`);
        await this.app.fileManager.renameFile(file, newPath);
        new Notice('Title updated successfully');
      }
    } catch (error) {
      console.error('Error generating title:', error);
      new Notice('Failed to generate title. Check console for details.');
    }
  }

  getApiKey(): string {
    switch (this.settings.provider) {
      case ProviderType.ANTHROPIC:
        return this.settings.anthropicApiKey;
      case ProviderType.OPENAI:
        return this.settings.openaiApiKey;
      case ProviderType.GEMINI:
        return this.settings.geminiApiKey;
      default:
        return '';
    }
  }

  getProviderName(): string {
    switch (this.settings.provider) {
      case ProviderType.ANTHROPIC:
        return 'Anthropic';
      case ProviderType.OPENAI:
        return 'OpenAI';
      case ProviderType.GEMINI:
        return 'Google Gemini';
      default:
        return 'AI Provider';
    }
  }

  async callAnthropicAPI(text: string): Promise<string> {
    try {
      const response = await requestUrl({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.settings.anthropicModel,
          max_tokens: 100,
          temperature: 0.7,
          messages: [
            {
              role: "user",
              content: `You create concise summaries of performance feedback. Your summaries must:
- Be exactly one sentence
- Never exceed ${this.settings.maxTitleLength} characters
- Avoid names, emojis, links, and colons
- Focus on behaviors and impact
- Return only the summary text, nothing else`
            },
            {
              role: "user",
              content: `${text}`
            }
          ]
        })
      });

      if (response.status !== 200) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = response.json;
      return data.content[0].text.trim();
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw error;
    }
  }

  async callOpenAIAPI(text: string): Promise<string> {
    try {
      const response = await requestUrl({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiApiKey}`
        },
        body: JSON.stringify({
          model: this.settings.openaiModel,
          max_tokens: 100,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: `You create concise summaries of performance feedback. Your summaries must:
- Be exactly one sentence
- Never exceed ${this.settings.maxTitleLength} characters
- Avoid names, emojis, links, and colons
- Focus on behaviors and impact
- Return only the summary text, nothing else`
            },
            {
              role: "user",
              content: text
            }
          ]
        })
      });

      if (response.status !== 200) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = response.json;
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  async callGeminiAPI(text: string): Promise<string> {
    try {
      const response = await requestUrl({
        url: 'https://generativelanguage.googleapis.com/v1/models/' + 
             this.settings.geminiModel + ':generateContent?key=' + 
             this.settings.geminiApiKey,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You create concise summaries of performance feedback. Your summaries must:
- Be exactly one sentence
- Never exceed ${this.settings.maxTitleLength} characters
- Avoid names, emojis, links, and colons
- Focus on behaviors and impact
- Return only the summary text, nothing else

Here is the content to summarize:
${text}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100
          }
        })
      });

      if (response.status !== 200) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = response.json;
      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }
}

class AITitleSettingTab extends PluginSettingTab {
  plugin: AITitlePlugin;

  constructor(app: App, plugin: AITitlePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'AI Title Generator Settings' });

    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select which AI provider to use')
      .addDropdown(dropdown => dropdown
        .addOption(ProviderType.ANTHROPIC, 'Anthropic Claude')
        .addOption(ProviderType.OPENAI, 'OpenAI ChatGPT')
        .addOption(ProviderType.GEMINI, 'Google Gemini')
        .setValue(this.plugin.settings.provider)
        .onChange(async (value: ProviderType) => {
          this.plugin.settings.provider = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide relevant settings
        }));

    // Anthropic Settings
    if (this.plugin.settings.provider === ProviderType.ANTHROPIC) {
      containerEl.createEl('h3', { text: 'Anthropic Settings' });
      
      new Setting(containerEl)
        .setName('Anthropic API Key')
        .setDesc('Your Anthropic API key')
        .addText(text => text
          .setPlaceholder('Enter your API key')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Model')
        .setDesc('The Anthropic model to use')
        .addDropdown(dropdown => dropdown
          .addOption('claude-3-7-sonnet-latest', 'Claude 3.7 Sonnet')
          .addOption('claude-3-5-haiku-latest', 'Claude 3.5 Haiku')
          .addOption('claude-3-opus-latest', 'Claude 3 Opus')
          .setValue(this.plugin.settings.anthropicModel)
          .onChange(async (value) => {
            this.plugin.settings.anthropicModel = value;
            await this.plugin.saveSettings();
          }));
    }

    // OpenAI Settings
    if (this.plugin.settings.provider === ProviderType.OPENAI) {
      containerEl.createEl('h3', { text: 'OpenAI Settings' });
      
      new Setting(containerEl)
        .setName('OpenAI API Key')
        .setDesc('Your OpenAI API key')
        .addText(text => text
          .setPlaceholder('Enter your API key')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Model')
        .setDesc('The OpenAI model to use')
        .addDropdown(dropdown => dropdown
          .addOption('gpt-4o', 'GPT-4o')
          .addOption('gpt-4-turbo', 'GPT-4 Turbo')
          .addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo')
          .setValue(this.plugin.settings.openaiModel)
          .onChange(async (value) => {
            this.plugin.settings.openaiModel = value;
            await this.plugin.saveSettings();
          }));
    }

    // Gemini Settings
    if (this.plugin.settings.provider === ProviderType.GEMINI) {
      containerEl.createEl('h3', { text: 'Google Gemini Settings' });
      
      new Setting(containerEl)
        .setName('Gemini API Key')
        .setDesc('Your Google Gemini API key')
        .addText(text => text
          .setPlaceholder('Enter your API key')
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Model')
        .setDesc('The Gemini model to use')
        .addDropdown(dropdown => dropdown
          .addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
          .addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
          .setValue(this.plugin.settings.geminiModel)
          .onChange(async (value) => {
            this.plugin.settings.geminiModel = value;
            await this.plugin.saveSettings();
          }));
    }

    new Setting(containerEl)
      .setName('Max Title Length')
      .setDesc('Maximum number of characters for the generated title')
      .addText(text => text
        .setPlaceholder('110')
        .setValue(this.plugin.settings.maxTitleLength.toString())
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue)) {
            this.plugin.settings.maxTitleLength = numValue;
            await this.plugin.saveSettings();
          }
        }));
  }
}
