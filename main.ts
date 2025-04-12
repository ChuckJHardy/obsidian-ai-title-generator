import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian';

// Remember to rename these classes and interfaces!

interface AITitlePluginSettings {
	apiKey: string;
	maxTitleLength: number;
}

const DEFAULT_SETTINGS: AITitlePluginSettings = {
	apiKey: '',
	maxTitleLength: 110
}

export default class AITitlePlugin extends Plugin {
	settings: AITitlePluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AITitleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Add command to generate title
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

	onunload() {

	}

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
				// Update the file title (rename the file)
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
					model: "claude-3-5-haiku-20241022",
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
							content: `Summarize this performance feedback.\n\n${text}`
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class AITitleSettingTab extends PluginSettingTab {
	plugin: AITitlePlugin;

	constructor(app: App, plugin: AITitlePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'AI Title Generator Settings'});

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
	}
}
