import vscode from "vscode";
import path from "path";
import fs from "fs";
import {undefined} from "zod";

export class GlobalState implements vscode.Memento {
    private storagePath: string;
    private cache: Record<string, any>;
    private syncedKeys: Set<string>;
    private dirty: boolean = false;

    constructor() {
        this.storagePath = path.join('.', 'auto_machine_global_state.json');
        this.syncedKeys = new Set();
        this.cache = {};

        // Initialize cache from file
        if (fs.existsSync(this.storagePath)) {
            try {
                this.cache = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
            } catch (error) {
                this.cache = {};
            }
        }
    }

    private async flushIfNeeded(): Promise<void> {
        if (this.dirty) {
            await fs.promises.writeFile(this.storagePath, JSON.stringify(this.cache, null, 2), 'utf8');
            this.dirty = false;
        }
    }

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get(key: string, defaultValue?: any): any {
        const value = this.cache[key];
        return value !== undefined ? value : defaultValue;
    }

    keys(): readonly string[] {
        return Object.keys(this.cache);
    }

    async update(key: string, value: any): Promise<void> {
        if (this.cache[key] !== value) {
            this.cache[key] = value;
            this.dirty = true;
            await this.flushIfNeeded();
        }
    }

    setKeysForSync(keys: readonly string[]): void {
        this.syncedKeys = new Set(keys);
    }
}