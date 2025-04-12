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

interface AITitlePluginSettings {
	apiKey: string;
	maxTitleLength: number;
	model: string;
}

const DEFAULT_SETTINGS: AITitlePluginSettings = {
	apiKey: '',
	maxTitleLength: 110,
	model: 'claude-3-7-sonnet-latest'
}

export default class AITitlePlugin extends Plugin {
	settings: AITitlePluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AITitleSettingTab(this.app, this));

		this.addCommand({
			id: 'generate-ai-title',
			name: 'Generate AI Title',
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

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async generateTitle(view: MarkdownView) {
		if (!this.settings.apiKey) {
			new Notice('Please set your Anthropic API key in the settings');
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
			const title = await this.callAnthropicAPI(text);
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

	async callAnthropicAPI(text: string): Promise<string> {
		try {
			const response = await requestUrl({
				url: 'https://api.anthropic.com/v1/messages',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.settings.apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: this.settings.model,
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
			.setName('Anthropic API Key')
			.setDesc('Your Anthropic API key')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

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

		new Setting(containerEl)
			.setName('Model')
			.setDesc('The model to use for generating the title')
			.addDropdown(dropdown => dropdown
				.addOption('claude-3-7-sonnet-latest', 'Claude 3.7 Sonnet')
				.addOption('claude-3-5-haiku-latest', 'Claude 3.5 Haiku')
				.addOption('claude-3-opus-latest', 'Claude 3 Opus')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));
	}
}
