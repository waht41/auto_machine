import { ModelInfo } from "@/shared/api";
import axios from "axios";
import vscode from "vscode";
import path from "path";
import fs from "fs/promises";
import { GlobalFileNames } from "@core/webview/ClineProvider";
import { fileExistsAtPath } from "@/utils/fs";
import { URL } from "url";

class ApiProviderService {
  private static _instance: ApiProviderService;
  private constructor() {}

  public static get instance(): ApiProviderService {
    if (!ApiProviderService._instance) {
      ApiProviderService._instance = new ApiProviderService();
    }
    return ApiProviderService._instance;
  }

  // Ollama
  async getOllamaModels(baseUrl?: string) {
    try {
      if (!baseUrl) {
        baseUrl = "http://localhost:11434";
      }
      if (!URL.canParse(baseUrl)) {
        return [];
      }
      const response = await axios.get(`${baseUrl}/api/tags`);
      const modelsArray = response.data?.models?.map((model: any) => model.name) || [];
      const models = [...new Set<string>(modelsArray)];
      return models;
    } catch (error) {
      return [];
    }
  }

  // LM Studio
  async getLmStudioModels(baseUrl?: string) {
    try {
      if (!baseUrl) {
        baseUrl = "http://localhost:1234";
      }
      if (!URL.canParse(baseUrl)) {
        return [];
      }
      const response = await axios.get(`${baseUrl}/v1/models`);
      const modelsArray = response.data?.data?.map((model: any) => model.id) || [];
      const models = [...new Set<string>(modelsArray)];
      return models;
    } catch (error) {
      return [];
    }
  }

  // VSCode LM API
  private async getVsCodeLmModels() {
    try {
      const models = await vscode.lm.selectChatModels({});
      return models || [];
    } catch (error) {
      console.error("Error fetching VS Code LM models:", error);
      return [];
    }
  }

  // OpenAI
  async getOpenAiModels(baseUrl?: string, apiKey?: string) {
    try {
      if (!baseUrl) {
        return [];
      }

      if (!URL.canParse(baseUrl)) {
        return [];
      }

      const config: Record<string, any> = {};
      if (apiKey) {
        config["headers"] = { Authorization: `Bearer ${apiKey}` };
      }

      const response = await axios.get(`${baseUrl}/models`, config);
      const modelsArray = response.data?.data?.map((model: any) => model.id) || [];
      const models = [...new Set<string>(modelsArray)];
      return models;
    } catch (error) {
      return [];
    }
  }

  // OpenRouter
  async handleOpenRouterCallback(code: string) {
    let apiKey: string;
    try {
      const response = await axios.post("https://openrouter.ai/api/v1/auth/keys", { code });
      if (response.data && response.data.key) {
        apiKey = response.data.key;
      } else {
        throw new Error("Invalid response from OpenRouter API");
      }
    } catch (error) {
      console.error("Error exchanging code for API key:", error);
      throw error;
    }

    return apiKey;
  }

  private async ensureCacheDirectoryExists(cacheDir: string): Promise<string> {
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  }

  // Glama
  async handleGlamaCallback(code: string) {
    let apiKey: string;
    try {
      const response = await axios.post("https://glama.ai/api/gateway/v1/auth/exchange-code", { code });
      if (response.data && response.data.apiKey) {
        apiKey = response.data.apiKey;
      } else {
        throw new Error("Invalid response from Glama API");
      }
    } catch (error) {
      console.error("Error exchanging code for API key:", error);
      throw error;
    }

    return apiKey;
  }

  async readGlamaModels(cacheDir: string): Promise<Record<string, ModelInfo> | undefined> {
    const glamaModelsFilePath = path.join(await this.ensureCacheDirectoryExists(cacheDir), GlobalFileNames.glamaModels);
    const fileExists = await fileExistsAtPath(glamaModelsFilePath);
    if (fileExists) {
      const fileContents = await fs.readFile(glamaModelsFilePath, "utf8");
      return JSON.parse(fileContents);
    }
    return undefined;
  }

  async getGlamaModels(cacheDir: string) {
    const glamaModelsFilePath = path.join(await this.ensureCacheDirectoryExists(cacheDir), GlobalFileNames.glamaModels);

    let models: Record<string, ModelInfo> = {};
    try {
      const response = await axios.get("https://glama.ai/api/gateway/v1/models");
      /*
				{
					"added": "2024-12-24T15:12:49.324Z",
					"capabilities": [
						"adjustable_safety_settings",
						"caching",
						"code_execution",
						"function_calling",
						"json_mode",
						"json_schema",
						"system_instructions",
						"tuning",
						"input:audio",
						"input:image",
						"input:text",
						"input:video",
						"output:text"
					],
					"id": "google-vertex/gemini-1.5-flash-002",
					"maxTokensInput": 1048576,
					"maxTokensOutput": 8192,
					"pricePerToken": {
						"cacheRead": null,
						"cacheWrite": null,
						"input": "0.000000075",
						"output": "0.0000003"
					}
				}
			*/
      if (response.data) {
        const rawModels = response.data;
        const parsePrice = (price: any) => {
          if (price) {
            return parseFloat(price) * 1_000_000;
          }
          return undefined;
        };
        for (const rawModel of rawModels) {
          const modelInfo: ModelInfo = {
            maxTokens: rawModel.maxTokensOutput,
            contextWindow: rawModel.maxTokensInput,
            supportsImages: rawModel.capabilities?.includes("input:image"),
            supportsComputerUse: rawModel.capabilities?.includes("computer_use"),
            supportsPromptCache: rawModel.capabilities?.includes("caching"),
            inputPrice: parsePrice(rawModel.pricePerToken?.input),
            outputPrice: parsePrice(rawModel.pricePerToken?.output),
            description: undefined,
            cacheWritesPrice: parsePrice(rawModel.pricePerToken?.cacheWrite),
            cacheReadsPrice: parsePrice(rawModel.pricePerToken?.cacheRead),
          };

          models[rawModel.id] = modelInfo;
        }
      } else {
        console.error("Invalid response from Glama API");
      }
      await fs.writeFile(glamaModelsFilePath, JSON.stringify(models));
    } catch (error) {
      // console.error("Error fetching Glama models:", error) // todo waht
    }

    return models;
  }

  async readOpenRouterModels(cacheDir: string): Promise<Record<string, ModelInfo> | undefined> {
    const openRouterModelsFilePath = path.join(
      await this.ensureCacheDirectoryExists(cacheDir),
      GlobalFileNames.openRouterModels
    );
    const fileExists = await fileExistsAtPath(openRouterModelsFilePath);
    if (fileExists) {
      const fileContents = await fs.readFile(openRouterModelsFilePath, "utf8");
      return JSON.parse(fileContents);
    }
    return undefined;
  }

  async getOpenRouterModels(cacheDir: string) {
    const openRouterModelsFilePath = path.join(
      await this.ensureCacheDirectoryExists(cacheDir),
      GlobalFileNames.openRouterModels,
    )

    let models: Record<string, ModelInfo> = {}
    try {
      const response = await axios.get("https://openrouter.ai/api/v1/models")
      /*
      {
        "id": "anthropic/claude-3.5-sonnet",
        "name": "Anthropic: Claude 3.5 Sonnet",
        "created": 1718841600,
        "description": "Claude 3.5 Sonnet delivers better-than-Opus capabilities, faster-than-Sonnet speeds, at the same Sonnet prices. Sonnet is particularly good at:\n\n- Coding: Autonomously writes, edits, and runs code with reasoning and troubleshooting\n- Data science: Augments human data science expertise; navigates unstructured data while using multiple tools for insights\n- Visual processing: excelling at interpreting charts, graphs, and images, accurately transcribing text to derive insights beyond just the text alone\n- Agentic tasks: exceptional tool use, making it great at agentic tasks (i.e. complex, multi-step problem solving tasks that require engaging with other systems)\n\n#multimodal",
        "context_length": 200000,
        "architecture": {
          "modality": "text+image-\u003Etext",
          "tokenizer": "Claude",
          "instruct_type": null
        },
        "pricing": {
          "prompt": "0.000003",
          "completion": "0.000015",
          "image": "0.0048",
          "request": "0"
        },
        "top_provider": {
          "context_length": 200000,
          "max_completion_tokens": 8192,
          "is_moderated": true
        },
        "per_request_limits": null
      },
      */
      if (response.data?.data) {
        const rawModels = response.data.data
        const parsePrice = (price: any) => {
          if (price) {
            return parseFloat(price) * 1_000_000
          }
          return undefined
        }
        for (const rawModel of rawModels) {
          const modelInfo: ModelInfo = {
            maxTokens: rawModel.top_provider?.max_completion_tokens,
            contextWindow: rawModel.context_length,
            supportsImages: rawModel.architecture?.modality?.includes("image"),
            supportsPromptCache: false,
            inputPrice: parsePrice(rawModel.pricing?.prompt),
            outputPrice: parsePrice(rawModel.pricing?.completion),
            description: rawModel.description,
          }

          switch (rawModel.id) {
            case "anthropic/claude-3.5-sonnet":
            case "anthropic/claude-3.5-sonnet:beta":
              // NOTE: this needs to be synced with api.ts/openrouter default model info
              modelInfo.supportsComputerUse = true
              modelInfo.supportsPromptCache = true
              modelInfo.cacheWritesPrice = 3.75
              modelInfo.cacheReadsPrice = 0.3
              break
            case "anthropic/claude-3.5-sonnet-20240620":
            case "anthropic/claude-3.5-sonnet-20240620:beta":
              modelInfo.supportsPromptCache = true
              modelInfo.cacheWritesPrice = 3.75
              modelInfo.cacheReadsPrice = 0.3
              break
            case "anthropic/claude-3-5-haiku":
            case "anthropic/claude-3-5-haiku:beta":
            case "anthropic/claude-3-5-haiku-20241022":
            case "anthropic/claude-3-5-haiku-20241022:beta":
            case "anthropic/claude-3.5-haiku":
            case "anthropic/claude-3.5-haiku:beta":
            case "anthropic/claude-3.5-haiku-20241022":
            case "anthropic/claude-3.5-haiku-20241022:beta":
              modelInfo.supportsPromptCache = true
              modelInfo.cacheWritesPrice = 1.25
              modelInfo.cacheReadsPrice = 0.1
              break
            case "anthropic/claude-3-opus":
            case "anthropic/claude-3-opus:beta":
              modelInfo.supportsPromptCache = true
              modelInfo.cacheWritesPrice = 18.75
              modelInfo.cacheReadsPrice = 1.5
              break
            case "anthropic/claude-3-haiku":
            case "anthropic/claude-3-haiku:beta":
              modelInfo.supportsPromptCache = true
              modelInfo.cacheWritesPrice = 0.3
              modelInfo.cacheReadsPrice = 0.03
              break
          }

          models[rawModel.id] = modelInfo
        }
      } else {
        console.error("Invalid response from OpenRouter API")
      }
      await fs.writeFile(openRouterModelsFilePath, JSON.stringify(models))
      // console.log("OpenRouter models fetched and saved", models)
    } catch (error) {
      // console.error("Error fetching OpenRouter models:", error) //todo waht
    }

    return models;
  }
}

export default ApiProviderService;
