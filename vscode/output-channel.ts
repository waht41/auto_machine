type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class MockOutputChannel {
	private _content: string = '';
	private _isShown: boolean = false;
	private _name: string;

	constructor(name: string) {
		this._name = name;
	}

	// ---------- Core Methods ----------
	append(value: string): void {
		this._content += value;
	}

	appendLine(value: string): void {
		this._content += value + '\n';
	}

	clear(): void {
		this._content = '';
	}

	show(preserveFocus?: boolean): void {
		this._isShown = true;
		console.log(`[${this._name}] Output channel shown`);
	}

	hide(): void {
		this._isShown = false;
	}

	dispose(): void {
		this.clear();
		console.log(`[${this._name}] Channel disposed`);
	}

	// ---------- Utility Methods (For Testing) ----------
	get content(): string {
		return this._content;
	}

	get lines(): string[] {
		return this._content.split('\n').filter(line => line.length > 0);
	}

	dumpToConsole(level: LogLevel = 'info'): void {
		const header = `===== ${this._name} (${this._isShown ? 'visible' : 'hidden'}) =====`;
		console[level](header);
		console[level](this._content);
		console[level]('='.repeat(header.length));
	}
}

export class OutputChannel extends MockOutputChannel {
	constructor(name: string) {
		super(name); // Important: Call the super constructor!
	}
}
