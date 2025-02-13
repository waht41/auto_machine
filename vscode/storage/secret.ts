import { Event } from "../events";
import * as fs from 'fs';
import * as path from 'path';
import vscode, {SecretStorageChangeEvent} from "vscode";

export class MockSecretStorage implements vscode.SecretStorage {
    private storagePath: string;
    private cache: Record<string, string>;
    onDidChange: Event<SecretStorageChangeEvent>;

    constructor() {
        // Store in the user's home directory
        this.storagePath = path.join('.', 'auto_machine_secrets.json');
        this.onDidChange = undefined;
        this.cache = {};
        
        // Initialize cache from file
        if (fs.existsSync(this.storagePath)) {
            const data = fs.readFileSync(this.storagePath, 'utf8');
            try {
                this.cache = JSON.parse(data);
            } catch (error) {
                this.cache = {};
            }
        } else {
            fs.writeFileSync(this.storagePath, JSON.stringify({}), 'utf8');
        }
    }

    private async readStorage(): Promise<Record<string, string>> {
        return this.cache;
    }

    private async writeStorage(data: Record<string, string>): Promise<void> {
        this.cache = data;
        await fs.promises.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
    }

    async get(key: string): Promise<string | undefined> {
        return this.cache[key];
    }

    async store(key: string, value: string): Promise<void> {
        if (this.cache[key] !== value){
            console.log('[waht] secret store',key);
            this.cache[key] = value;
            await this.writeStorage(this.cache);
        }
    }

    async delete(key: string): Promise<void> {
        if (key in this.cache){
            delete this.cache[key];
            await this.writeStorage(this.cache);
        }
    }

    async getAll(): Promise<Record<string, string>> {
        return this.cache;
    }
}