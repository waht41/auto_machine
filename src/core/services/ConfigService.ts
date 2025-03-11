import { GlobalState } from "@core/storage/global-state";
import path from "path";
import { configPath } from "@core/storage/common";

export class ConfigService {
    private static _instance: ConfigService;
    private _state = new GlobalState(path.join(configPath, "auto_machine_global_state.json"));

    private constructor() {
    }

    public static get instance(): ConfigService {
        if (!ConfigService._instance) {
            ConfigService._instance = new ConfigService();
        }

        return ConfigService._instance;
    }
}
