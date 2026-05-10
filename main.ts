import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, FuzzySuggestModal } from "obsidian";

interface TaskGroup {
	heading: string;
	tasks: string[];
}

interface RandomTaskSelectorSettings {
	kanbanNotePath: string;
	disabledColumns: string[];
}

const DEFAULT_SETTINGS: RandomTaskSelectorSettings = {
	kanbanNotePath: "Projects 2026.md",
	disabledColumns: [],
};

export default class RandomTaskSelectorPlugin extends Plugin {
	settings: RandomTaskSelectorSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Ribbon icon - dice icon
		this.addRibbonIcon("dice", "Random Task Selector", () => {
			this.openTaskSelector();
		});

		// Command palette command
		this.addCommand({
			id: "open-random-task-selector",
			name: "Pick a random task",
			callback: () => {
				this.openTaskSelector();
			},
		});

		// Command to change the source note via fuzzy search
		this.addCommand({
			id: "change-task-source-note",
			name: "Change source note",
			callback: () => {
				new NotePickerModal(this.app, this, async (path) => {
					this.settings.kanbanNotePath = path;
					await this.saveSettings();
					new Notice(`Source note set to: ${path}`);
				}).open();
			},
		});

		// Settings tab
		this.addSettingTab(new RandomTaskSelectorSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openTaskSelector() {
		const file = this.app.vault.getAbstractFileByPath(this.settings.kanbanNotePath);
		if (!file || !(file instanceof TFile)) {
			new Notice(`Note not found: ${this.settings.kanbanNotePath}`);
			return;
		}

		let content: string;
		try {
			content = await this.app.vault.cachedRead(file);
		} catch {
			content = await this.app.vault.read(file);
		}

		const taskGroups = parseKanbanContent(content);
		if (taskGroups.length === 0) {
			new Notice("No tasks found in the configured note.");
			return;
		}

		// Build toggle states from persisted disabledColumns
		const toggleStates = new Map<string, boolean>();
		for (const group of taskGroups) {
			toggleStates.set(group.heading, !this.settings.disabledColumns.includes(group.heading));
		}

		new TaskSelectorModal(this.app, taskGroups, this.settings, toggleStates).open();
	}

	async saveDisabledColumns(disabledColumns: string[]) {
		this.settings.disabledColumns = disabledColumns;
		await this.saveSettings();
	}
}

// ---------- Kanban Parser ----------

function parseKanbanContent(content: string): TaskGroup[] {
	const groups: TaskGroup[] = [];
	const lines = content.split("\n");

	let currentHeading = "";
	let currentTasks: string[] = [];

	for (const line of lines) {
		// Check for markdown headings (## or any level)
		const headingMatch = line.match(/^#{1,6}\s+(.+)/);
		if (headingMatch) {
			// Save previous group if it has tasks
			if (currentHeading && currentTasks.length > 0) {
				groups.push({ heading: currentHeading, tasks: [...currentTasks] });
			}
			currentHeading = headingMatch[1].trim();
			currentTasks = [];
			continue;
		}

		// Match unchecked tasks only: - [ ] task text
		const taskMatch = line.match(/^[\s]*- \[ \] (.+)/);
		if (taskMatch && currentHeading) {
			const taskText = taskMatch[1].trim();
			// Skip empty tasks
			if (taskText.length > 0) {
				currentTasks.push(taskText);
			}
		}
	}

	// Don't forget the last group
	if (currentHeading && currentTasks.length > 0) {
		groups.push({ heading: currentHeading, tasks: [...currentTasks] });
	}

	return groups;
}

// ---------- Modal: Task Selector ----------

class TaskSelectorModal extends Modal {
	taskGroups: TaskGroup[];
	settings: RandomTaskSelectorSettings;
	toggleStates: Map<string, boolean>;
	resultEl: HTMLElement | null = null;
	taskDisplayEl: HTMLElement | null = null;
	columnBadge: HTMLElement | null = null;
	goToFileBtn: HTMLButtonElement | null = null;
	currentTask: string = "";
	toggleCheckboxes: HTMLInputElement[] = [];

	constructor(
		app: App,
		taskGroups: TaskGroup[],
		settings: RandomTaskSelectorSettings,
		toggleStates: Map<string, boolean>
	) {
		super(app);
		this.taskGroups = taskGroups;
		this.settings = settings;
		this.toggleStates = toggleStates;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("random-task-selector-modal");

		// Title
		contentEl.createEl("h2", { text: "🎲 Random Task Selector", cls: "rts-title" });

		// Subtitle showing source note
		contentEl.createEl("p", {
			text: `From: ${this.settings.kanbanNotePath}`,
			cls: "rts-subtitle",
		});

		// Toggle section header with quick actions
		const toggleHeader = contentEl.createEl("div", { cls: "rts-section-header" });
		toggleHeader.createEl("span", { text: "Select columns to pick from:" });

		const quickActions = toggleHeader.createEl("div", { cls: "rts-quick-actions" });
		const selectAllBtn = quickActions.createEl("button", { text: "All", cls: "rts-btn-small" });
		const deselectAllBtn = quickActions.createEl("button", { text: "None", cls: "rts-btn-small" });

		selectAllBtn.addEventListener("click", () => {
			for (const [key] of this.toggleStates) {
				this.toggleStates.set(key, true);
			}
			this.syncCheckboxes();
		});

		deselectAllBtn.addEventListener("click", () => {
			for (const [key] of this.toggleStates) {
				this.toggleStates.set(key, false);
			}
			this.syncCheckboxes();
		});

		// Toggles container
		const togglesContainer = contentEl.createEl("div", { cls: "rts-toggles-container" });

		for (const group of this.taskGroups) {
			const toggleRow = togglesContainer.createEl("div", { cls: "rts-toggle-row" });

			const checkbox = toggleRow.createEl("input", { type: "checkbox" });
			checkbox.checked = this.toggleStates.get(group.heading) ?? true;
			checkbox.addEventListener("change", () => {
				this.toggleStates.set(group.heading, checkbox.checked);
			});

			const label = toggleRow.createEl("span", { cls: "rts-toggle-label" });
			label.createEl("span", { text: group.heading, cls: "rts-heading-name" });
			label.createEl("span", {
				text: `(${group.tasks.length} tasks)`,
				cls: "rts-task-count",
			});

			// Clicking the entire row toggles the checkbox
			toggleRow.addEventListener("click", (e) => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
					this.toggleStates.set(group.heading, checkbox.checked);
				}
			});

			this.toggleCheckboxes.push(checkbox);
		}

		// Button row
		const buttonRow = contentEl.createEl("div", { cls: "rts-button-row" });

		const rollBtn = buttonRow.createEl("button", { text: "🎲 Pick a Random Task", cls: "rts-btn-roll" });
		rollBtn.addEventListener("click", () => this.pickRandomTask());

		// Result area (hidden initially)
		this.resultEl = contentEl.createEl("div", { cls: "rts-result-area" });
		this.resultEl.style.display = "none";

		this.taskDisplayEl = this.resultEl.createEl("div", { cls: "rts-task-display" });
		this.columnBadge = this.resultEl.createEl("div", { cls: "rts-column-badge" });

		const taskActions = this.resultEl.createEl("div", { cls: "rts-task-actions" });
		this.goToFileBtn = taskActions.createEl("button", { text: "Go to task", cls: "rts-btn-secondary" });
		const rerollBtn = taskActions.createEl("button", { text: "🎲 Reroll", cls: "rts-btn-small" });
		const copyBtn = taskActions.createEl("button", { text: "📋 Copy", cls: "rts-btn-small" });

		rerollBtn.addEventListener("click", () => this.pickRandomTask());
		copyBtn.addEventListener("click", () => {
			if (this.currentTask) {
				navigator.clipboard.writeText(this.currentTask).then(() => {
					new Notice("Task copied to clipboard!");
				});
			}
		});
	}

	syncCheckboxes() {
		const headings = this.taskGroups.map((g) => g.heading);
		this.toggleCheckboxes.forEach((cb, i) => {
			if (i < headings.length) {
				cb.checked = this.toggleStates.get(headings[i]) ?? true;
			}
		});
	}

	pickRandomTask() {
		const enabledGroups = this.taskGroups.filter(
			(g) => this.toggleStates.get(g.heading) === true
		);

		if (enabledGroups.length === 0) {
			new Notice("Select at least one column!");
			return;
		}

		// Collect all tasks from enabled groups
		const allTasks: { text: string; group: string }[] = [];
		for (const group of enabledGroups) {
			for (const task of group.tasks) {
				allTasks.push({ text: task, group: group.heading });
			}
		}

		if (allTasks.length === 0) {
			new Notice("No tasks found in selected columns!");
			return;
		}

		// Pick a random task
		const randomIndex = Math.floor(Math.random() * allTasks.length);
		const picked = allTasks[randomIndex];
		this.currentTask = picked.text;
		this.showResult(picked.text, picked.group);
	}

	showResult(taskText: string, groupName: string) {
		if (!this.resultEl || !this.taskDisplayEl || !this.columnBadge || !this.goToFileBtn) return;

		// Clean up markdown for display
		let displayText = taskText
			.replace(/\*\*/g, "")
			.replace(/\[\[([^\]]+)\]\]/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

		this.taskDisplayEl.setText(displayText);
		this.columnBadge.setText(`📌 ${groupName}`);
		this.resultEl.style.display = "block";

		// Animate
		this.taskDisplayEl.addClass("rts-animate-in");
		setTimeout(() => {
			this.taskDisplayEl?.removeClass("rts-animate-in");
		}, 400);

		// Update go-to-file button
		this.goToFileBtn.onclick = () => {
			this.app.workspace.openLinkText(this.settings.kanbanNotePath, "");
			this.close();
		};
	}

	onClose() {
		// Persist toggle states: save which columns are disabled
		const disabledColumns: string[] = [];
		for (const [heading, enabled] of this.toggleStates) {
			if (!enabled) {
				disabledColumns.push(heading);
			}
		}
		(this.app as any).plugins.getPlugin("random-task-selector").saveDisabledColumns(disabledColumns);

		const { contentEl } = this;
		contentEl.empty();
	}
}

// ---------- Modal: Note Picker (Fuzzy Search) ----------

class NotePickerModal extends FuzzySuggestModal<string> {
	onChoose: (path: string) => void;

	constructor(app: App, onChoose: (path: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Type to search for a note...");
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "select note" },
			{ command: "esc", purpose: "cancel" },
		]);
	}

	getItems(): string[] {
		return this.app.vault.getMarkdownFiles().map((f) => f.path);
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string, _evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(item);
	}
}

// ---------- Settings Tab ----------

class RandomTaskSelectorSettingTab extends PluginSettingTab {
	plugin: RandomTaskSelectorPlugin;

	constructor(app: App, plugin: RandomTaskSelectorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Random Task Selector Settings" });

		// Note search setting - click the input area to open fuzzy search
		const noteSetting = new Setting(containerEl)
			.setName("Kanban note")
			.setDesc("Click to search and select the note containing your kanban board");

		// Build a clickable display showing current note + a search button
		const noteControl = noteSetting.controlEl.createEl("div", { cls: "rts-note-picker" });

		const noteName = noteControl.createEl("span", {
			text: this.plugin.settings.kanbanNotePath,
			cls: "rts-note-name",
		});

		const searchBtn = noteControl.createEl("button", {
			text: "🔍 Search",
			cls: "rts-btn-small",
		});

		searchBtn.addEventListener("click", () => {
			new NotePickerModal(this.app, async (path) => {
				this.plugin.settings.kanbanNotePath = path;
				await this.plugin.saveSettings();
				noteName.setText(path);
				new Notice(`Source note set to: ${path}`);
			}).open();
		});
	}
}
