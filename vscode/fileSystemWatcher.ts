import {Uri } from 'vscode'; // Or 'vscode' if in a VS Code extension context
import { Event, Emitter } from './events';
import {FileSystemWatcher} from "vscode"; // Import from correct location (see below)

// Mock implementation of Event and Emitter (if not in VS Code extension)
// In a VS Code extension, you would use the real VS Code Event and Emitter.



export class MockFileSystemWatcher implements FileSystemWatcher {
    public ignoreCreateEvents: boolean;
    public ignoreChangeEvents: boolean;
    public ignoreDeleteEvents: boolean;

    private _onDidCreate: Emitter<Uri> = new Emitter<Uri>();
    public onDidCreate: Event<Uri> = this._onDidCreate.event;

    private _onDidChange: Emitter<Uri> = new Emitter<Uri>();
    public onDidChange: Event<Uri> = this._onDidChange.event;

    private _onDidDelete: Emitter<Uri> = new Emitter<Uri>();
    public onDidDelete: Event<Uri> = this._onDidDelete.event;

    constructor(
        ignoreCreateEvents: boolean = false,
        ignoreChangeEvents: boolean = false,
        ignoreDeleteEvents: boolean = false
    ) {
        this.ignoreCreateEvents = ignoreCreateEvents;
        this.ignoreChangeEvents = ignoreChangeEvents;
        this.ignoreDeleteEvents = ignoreDeleteEvents;
    }

    public fireCreate(uri: Uri): void {
        if (!this.ignoreCreateEvents) {
            this._onDidCreate.fire(uri);
        }
    }

    public fireChange(uri: Uri): void {
        if (!this.ignoreChangeEvents) {
            this._onDidChange.fire(uri);
        }
    }

    public fireDelete(uri: Uri): void {
        if (!this.ignoreDeleteEvents) {
            this._onDidDelete.fire(uri);
        }
    }

    public dispose(): void {
        this._onDidCreate.dispose();
        this._onDidChange.dispose();
        this._onDidDelete.dispose();
    }
}