import { ApiConfiguration, ApiProvider, ModelInfo } from "@/shared/api";
import { ApiHandler, buildApiHandler } from "@/api";
import ApiService from "@core/services/ApiService";
import { ConfigService } from "@core/services/ConfigService";
import { MessageService } from "@core/services/MessageService";

/**
 * ApiManager 负责管理 API 服务，包括配置、模型获取和缓存管理
 */
class ApiManager {
  private static _instance: ApiManager;
  private api: ApiHandler | null = null;

  private constructor(
    private readonly cacheDir: string,
    private readonly messageService : MessageService,
    private readonly apiService = ApiService.instance,
    private readonly globalStateService = ConfigService.instance,

  ) {}

  public static getInstance(cacheDir: string, messageService : MessageService): ApiManager {
    if (!ApiManager._instance) {
      ApiManager._instance = new ApiManager(cacheDir,messageService);
    }
    return ApiManager._instance;
  }

  /**
   * 初始化 API 配置
   */
  // public async initialize(): Promise<void> {
  //   // 从全局状态中获取 API 提供者
  //   const apiProvider = await this.globalStateService.getGlobalState<ApiProvider>("apiProvider");
  //   if (!apiProvider) return;
  //
  //   // 根据 API 提供者构建配置
  //   const config: ApiConfiguration = { apiProvider };
  //
  //   // 根据不同的 API 提供者，获取相应的配置
  //   switch (apiProvider) {
  //     case "anthropic":
  //       const anthropicApiKey = await this.globalStateService.getSecret("anthropicApiKey");
  //       const anthropicBaseUrl = await this.globalStateService.getGlobalState<string>("anthropicBaseUrl");
  //       const anthropicModelId = await this.globalStateService.getGlobalState<string>("anthropicModelId");
  //       if (anthropicApiKey) config.apiKey = anthropicApiKey;
  //       if (anthropicBaseUrl) config.anthropicBaseUrl = anthropicBaseUrl;
  //       if (anthropicModelId) config.apiModelId = anthropicModelId;
  //       break;
  //
  //     case "glama":
  //       const glamaApiKey = await this.globalStateService.getSecret("glamaApiKey");
  //       const glamaModelId = await this.globalStateService.getGlobalState<string>("glamaModelId");
  //       if (glamaApiKey) config.glamaApiKey = glamaApiKey;
  //       if (glamaModelId) config.glamaModelId = glamaModelId;
  //
  //       // 获取 Glama 模型信息
  //       const glamaModels = await this.apiService.readGlamaModels(this.cacheDir);
  //       if (glamaModels && glamaModelId && glamaModels[glamaModelId]) {
  //         config.glamaModelInfo = glamaModels[glamaModelId];
  //       }
  //       break;
  //
  //     case "openrouter":
  //       const openRouterApiKey = await this.globalStateService.getSecret("openRouterApiKey");
  //       const openRouterModelId = await this.globalStateService.getGlobalState<string>("openRouterModelId");
  //       const openRouterBaseUrl = await this.globalStateService.getGlobalState<string>("openRouterBaseUrl");
  //       if (openRouterApiKey) config.openRouterApiKey = openRouterApiKey;
  //       if (openRouterModelId) config.openRouterModelId = openRouterModelId;
  //       if (openRouterBaseUrl) config.openRouterBaseUrl = openRouterBaseUrl;
  //
  //       // 获取 OpenRouter 模型信息
  //       const openRouterModels = await this.apiService.readOpenRouterModels(this.cacheDir);
  //       if (openRouterModels && openRouterModelId && openRouterModels[openRouterModelId]) {
  //         config.openRouterModelInfo = openRouterModels[openRouterModelId];
  //       }
  //       break;
  //
  //     case "ollama":
  //       const ollamaModelId = await this.globalStateService.getGlobalState<string>("ollamaModelId");
  //       const ollamaBaseUrl = await this.globalStateService.getGlobalState<string>("ollamaBaseUrl");
  //       if (ollamaModelId) config.ollamaModelId = ollamaModelId;
  //       if (ollamaBaseUrl) config.ollamaBaseUrl = ollamaBaseUrl;
  //       break;
  //
  //     case "lmstudio":
  //       const lmStudioModelId = await this.globalStateService.getGlobalState<string>("lmStudioModelId");
  //       const lmStudioBaseUrl = await this.globalStateService.getGlobalState<string>("lmStudioBaseUrl");
  //       if (lmStudioModelId) config.lmStudioModelId = lmStudioModelId;
  //       if (lmStudioBaseUrl) config.lmStudioBaseUrl = lmStudioBaseUrl;
  //       break;
  //
  //     case "openai":
  //       const openAiApiKey = await this.globalStateService.getSecret("openAiApiKey");
  //       const openAiModelId = await this.globalStateService.getGlobalState<string>("openAiModelId");
  //       const openAiBaseUrl = await this.globalStateService.getGlobalState<string>("openAiBaseUrl");
  //       const openAiUseAzure = await this.globalStateService.getGlobalState<boolean>("openAiUseAzure");
  //       if (openAiApiKey) config.openAiApiKey = openAiApiKey;
  //       if (openAiModelId) config.openAiModelId = openAiModelId;
  //       if (openAiBaseUrl) config.openAiBaseUrl = openAiBaseUrl;
  //       if (openAiUseAzure !== undefined) config.openAiUseAzure = openAiUseAzure;
  //       break;
  //
  //     case "vscode-lm":
  //       // VSCode LM 不需要额外配置
  //       break;
  //
  //     // 其他 API 提供者的配置可以根据需要添加
  //   }
  //
  //   // 构建 API 处理器
  //   this.api = buildApiHandler(config);
  // }

  /**
   * 获取 API 处理器
   */
  public getApi(): ApiHandler | null {
    return this.api;
  }
  //
  // /**
  //  * 设置 API 提供者并更新配置
  //  */
  // public async setApiProvider(provider: ApiProvider): Promise<void> {
  //   await this.globalStateService.updateGlobalState("apiProvider", provider);
  //   await this.initialize();
  // }
  //
  // /**
  //  * 处理 OpenRouter 回调
  //  */
  // public async handleOpenRouterCallback(code: string): Promise<void> {
  //   const apiKey = await this.apiService.handleOpenRouterCallback(code);
  //   await this.globalStateService.updateGlobalState("apiProvider", "openrouter" as ApiProvider);
  //   await this.globalStateService.storeSecret("openRouterApiKey", apiKey);
  //   await this.initialize();
  //
  //   // 刷新 OpenRouter 模型
  //   await this.refreshOpenRouterModels();
  // }
  //
  // /**
  //  * 处理 Glama 回调
  //  */
  // public async handleGlamaCallback(code: string): Promise<void> {
  //   const apiKey = await this.apiService.handleGlamaCallback(code);
  //   await this.globalStateService.updateGlobalState("apiProvider", "glama" as ApiProvider);
  //   await this.globalStateService.storeSecret("glamaApiKey", apiKey);
  //   await this.initialize();
  //
  //   // 刷新 Glama 模型
  //   await this.refreshGlamaModels();
  // }

  /**
   * 获取 Ollama 模型列表
   */
  public async getOllamaModels(baseUrl?: string): Promise<string[]> {
    return this.apiService.getOllamaModels(baseUrl);
  }

  /**
   * 获取 LM Studio 模型列表
   */
  public async getLmStudioModels(baseUrl?: string): Promise<string[]> {
    return this.apiService.getLmStudioModels(baseUrl);
  }

  /**
   * 获取 OpenAI 模型列表
   */
  public async getOpenAiModels(baseUrl?: string, apiKey?: string): Promise<string[]> {
    return this.apiService.getOpenAiModels(baseUrl, apiKey);
  }

  /**
   * 刷新 Glama 模型
   */
  public async refreshGlamaModels(): Promise<Record<string, ModelInfo>> {
    const models =  await this.apiService.getGlamaModels(this.cacheDir);
    await this.messageService.postMessageToWebview({ type: "glamaModels", glamaModels: models })
    return models;
  }

  /**
   * 刷新 OpenRouter 模型
   */
  public async refreshOpenRouterModels(): Promise<Record<string, ModelInfo>> {
    const models = await this.apiService.getOpenRouterModels(this.cacheDir);
    await this.messageService.postMessageToWebview({ type: "openRouterModels", openRouterModels: models });
    return models;
  }

  public async readGlamaModels(): Promise<Record<string, ModelInfo> | undefined> {
    return this.apiService.readGlamaModels(this.cacheDir);
  }

  public async readOpenRouterModels(): Promise<Record<string, ModelInfo> | undefined>{
    return this.apiService.readOpenRouterModels(this.cacheDir);
  }
}

export default ApiManager;
