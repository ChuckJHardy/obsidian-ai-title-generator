import {
  App,
  MarkdownView,
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
  customPrompt: string;
}

const DEFAULT_SETTINGS: AITitlePluginSettings = {
  provider: ProviderType.ANTHROPIC,
  anthropicApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  maxTitleLength: 110,
  anthropicModel: 'claude-3-7-sonnet-latest',
  openaiModel: 'gpt-4o',
  geminiModel: 'gemini-1.5-pro',
  customPrompt: 'You create concise summaries. Your summaries must:\n- Be exactly one sentence\n- Never exceed {maxTitleLength} characters\n- Avoid names, emojis, links, and colons\n- Focus on behaviors and impact\n- Return only the summary text, nothing else'
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
        const sanitizedTitle = this.sanitizeFileName(title);
        const newPath = file.path.replace(/[^/]+$/, `${sanitizedTitle}.md`);
        await this.app.fileManager.renameFile(file, newPath);
        new Notice('Title updated successfully');
      }
    } catch (error) {
      console.error('Error generating title:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`Failed to generate title: ${errorMessage}`);
    }
  }

  sanitizeFileName(fileName: string): string {
    // Replace characters that are invalid in file names
    return fileName
      .replace(/[\\/:*?"<>|]/g, '')  // Remove characters invalid in most file systems
      .replace(/\.\./g, '.') // Replace consecutive dots
      .trim();
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
      const prompt = this.settings.customPrompt.replace('{maxTitleLength}', this.settings.maxTitleLength.toString());
      
      const response = await this.makeAPIRequest(
        'https://api.anthropic.com/v1/messages',
        {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        {
          model: this.settings.anthropicModel,
          max_tokens: 100,
          temperature: 0.7,
          messages: [
            {
              role: "user",
              content: prompt
            },
            {
              role: "user",
              content: `${text}`
            }
          ]
        }
      );

      const data = response.json;
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Unexpected response format from Anthropic API');
      }
      
      return data.content[0].text.trim();
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw error;
    }
  }

  async callOpenAIAPI(text: string): Promise<string> {
    try {
      const prompt = this.settings.customPrompt.replace('{maxTitleLength}', this.settings.maxTitleLength.toString());
      
      const response = await this.makeAPIRequest(
        'https://api.openai.com/v1/chat/completions',
        {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiApiKey}`
        },
        {
          model: this.settings.openaiModel,
          max_tokens: 100,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: prompt
            },
            {
              role: "user",
              content: text
            }
          ]
        }
      );

      const data = response.json;
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error('Unexpected response format from OpenAI API');
      }
      
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  async callGeminiAPI(text: string): Promise<string> {
    try {
      const prompt = this.settings.customPrompt.replace('{maxTitleLength}', this.settings.maxTitleLength.toString());
      
      const response = await this.makeAPIRequest(
        'https://generativelanguage.googleapis.com/v1/models/' + 
        this.settings.geminiModel + ':generateContent?key=' + 
        this.settings.geminiApiKey,
        {
          'Content-Type': 'application/json'
        },
        {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${prompt}

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
        }
      );

      const data = response.json;
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || 
          !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || 
          !data.candidates[0].content.parts[0].text) {
        throw new Error('Unexpected response format from Gemini API');
      }
      
      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  async makeAPIRequest(url: string, headers: Record<string, string>, body: any) {
    const response = await requestUrl({
      url: url,
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (response.status !== 200) {
      const errorData = response.json;
      let errorMessage = `API request failed with status ${response.status}`;
      
      if (errorData && errorData.error) {
        if (typeof errorData.error === 'string') {
          errorMessage += `: ${errorData.error}`;
        } else if (errorData.error.message) {
          errorMessage += `: ${errorData.error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }

    return response;
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
            const trimmedValue = value.trim();
            if (trimmedValue !== value) {
              new Notice('API key trimmed. Please check for extra spaces.');
            }
            this.plugin.settings.anthropicApiKey = trimmedValue;
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
            const trimmedValue = value.trim();
            if (trimmedValue !== value) {
              new Notice('API key trimmed. Please check for extra spaces.');
            }
            this.plugin.settings.openaiApiKey = trimmedValue;
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
            const trimmedValue = value.trim();
            if (trimmedValue !== value) {
              new Notice('API key trimmed. Please check for extra spaces.');
            }
            this.plugin.settings.geminiApiKey = trimmedValue;
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
          if (isNaN(numValue)) {
            new Notice('Please enter a valid number for max title length');
            return;
          }
          if (numValue < 10 || numValue > 500) {
            new Notice('Title length should be between 10 and 500 characters');
            return;
          }
          this.plugin.settings.maxTitleLength = numValue;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: 'Prompt Settings' });
    
    new Setting(containerEl)
      .setName('Customize Prompt')
      .setDesc('Use {maxTitleLength} as a placeholder for the maximum title length.')
      .addExtraButton(button => {
        button
          .setIcon('reset')
          .setTooltip('Reset to default prompt')
          .onClick(async () => {
            this.plugin.settings.customPrompt = DEFAULT_SETTINGS.customPrompt;
            await this.plugin.saveSettings();
            this.display();
          });
      })
      .addTextArea(textarea => {
        textarea
          .setPlaceholder('Enter custom prompt')
          .setValue(this.plugin.settings.customPrompt)
          .onChange(async (value) => {
            this.plugin.settings.customPrompt = value;
            await this.plugin.saveSettings();
          });
        textarea.inputEl.style.height = '10em';
        textarea.inputEl.style.width = '40em';
        return textarea;
      });
  }
}
