import { Dropdown } from "@webview-ui/components/ui"
import type { DropdownOption } from "vscrui"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useEvent, useInterval } from "react-use"
import {
  anthropicModels,
  bedrockModels,
  deepSeekModels,
  geminiModels,
  mistralModels,
  openAiNativeModels,
  vertexModels,
} from "@/shared/api"
import { ExtensionMessage } from "@/shared/ExtensionMessage"
import { useExtensionState } from "@webview-ui/context/ExtensionStateContext"
import { vscode } from "@webview-ui/utils/vscode"
import * as vscodemodels from "vscode"
import { normalizeApiConfiguration } from "@webview-ui/components/settings/ApiOptions/utils";
import AnthropicOptions from "./providers/AnthropicOptions";
import GlamaOptions from "./providers/GlamaOptions";
import OpenAiNativeOptions from "./providers/OpenAiNativeOptions";
import MistralOptions from "./providers/MistralOptions";
import OpenRouterOptions from "./providers/OpenRouterOptions";
import BedrockOptions from "./providers/BedrockOptions";
import VertexOptions from "./providers/VertexOptions";
import GeminiOptions from "./providers/GeminiOptions";
import OpenAiOptions from "./providers/OpenAiOptions";
import DeepSeekOptions from "./providers/DeepSeekOptions";
import VSCodeLmOptions from "./providers/VSCodeLmOptions";
import LmStudioOptions from "./providers/LmStudioOptions";
import OllamaOptions from "./providers/OllamaOptions";
import ModelSelector from "./providers/ModelSelector";

interface ApiOptionsProps {
  apiErrorMessage?: string
  modelIdErrorMessage?: string
}

const ApiOptions = ({ apiErrorMessage, modelIdErrorMessage }: ApiOptionsProps) => {
  const { apiConfiguration, uriScheme, handleInputChange } = useExtensionState()
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [lmStudioModels, setLmStudioModels] = useState<string[]>([])
  const [vsCodeLmModels, setVsCodeLmModels] = useState<vscodemodels.LanguageModelChatSelector[]>([])

  const { selectedProvider, selectedModelId, selectedModelInfo } = useMemo(() => {
    return normalizeApiConfiguration(apiConfiguration)
  }, [apiConfiguration])

  // 提供商配置表
  const providerConfig = useMemo(() => ({
    openrouter: {
      label: "OpenRouter",
      component: () => (
        <OpenRouterOptions 
          apiConfiguration={apiConfiguration} 
          uriScheme={uriScheme} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: null, // 不需要 ModelSelector
    },
    anthropic: {
      label: "Anthropic",
      component: () => (
        <AnthropicOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: anthropicModels,
    },
    gemini: {
      label: "Google Gemini",
      component: () => (
        <GeminiOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: geminiModels,
    },
    deepseek: {
      label: "DeepSeek",
      component: () => (
        <DeepSeekOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: deepSeekModels,
    },
    "openai-native": {
      label: "OpenAI",
      component: () => (
        <OpenAiNativeOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: openAiNativeModels,
    },
    openai: {
      label: "OpenAI Compatible",
      component: () => (
        <OpenAiOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: null, // 不需要 ModelSelector
    },
    vertex: {
      label: "GCP Vertex AI",
      component: () => (
        <VertexOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: vertexModels,
    },
    bedrock: {
      label: "AWS Bedrock",
      component: () => (
        <BedrockOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: bedrockModels,
    },
    glama: {
      label: "Glama",
      component: () => (
        <GlamaOptions 
          apiConfiguration={apiConfiguration} 
          uriScheme={uriScheme} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: null, // 不需要 ModelSelector
    },
    "vscode-lm": {
      label: "VS Code LM API",
      component: () => (
        <VSCodeLmOptions 
          apiConfiguration={apiConfiguration} 
          vsCodeLmModels={vsCodeLmModels} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: null, // 使用特殊的 vsCodeLmModels
    },
    mistral: {
      label: "Mistral",
      component: () => (
        <MistralOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: mistralModels,
    },
    lmstudio: {
      label: "LM Studio",
      component: () => (
        <LmStudioOptions 
          apiConfiguration={apiConfiguration} 
          lmStudioModels={lmStudioModels} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: null, // 使用特殊的 lmStudioModels
    },
    ollama: {
      label: "Ollama",
      component: () => (
        <OllamaOptions 
          apiConfiguration={apiConfiguration} 
          ollamaModels={ollamaModels} 
          handleInputChange={handleInputChange} 
        />
      ),
      models: null, // 使用特殊的 ollamaModels
    },
  }), [apiConfiguration, uriScheme, handleInputChange, ollamaModels, lmStudioModels, vsCodeLmModels]);

  // 生成下拉选项
  const providerOptions = useMemo(() => 
    Object.entries(providerConfig).map(([value, { label }]) => ({
      value,
      label,
    }))
  , [providerConfig]);

  // 不需要 ModelSelector 的提供商列表
  const noModelSelectorProviders = ["glama", "openrouter", "openai", "ollama", "lmstudio", "vscode-lm"];

  // Poll ollama/lmstudio models
  const requestLocalModels = useCallback(() => {
    if (selectedProvider === "ollama") {
      vscode.postMessage({ type: "requestOllamaModels", text: apiConfiguration?.ollamaBaseUrl })
    } else if (selectedProvider === "lmstudio") {
      vscode.postMessage({ type: "requestLmStudioModels", text: apiConfiguration?.lmStudioBaseUrl })
    } else if (selectedProvider === "vscode-lm") {
      vscode.postMessage({ type: "requestVsCodeLmModels" })
    }
  }, [selectedProvider, apiConfiguration?.ollamaBaseUrl, apiConfiguration?.lmStudioBaseUrl])

  useEffect(() => {
    if (selectedProvider === "ollama" || selectedProvider === "lmstudio" || selectedProvider === "vscode-lm") {
      requestLocalModels()
    }
  }, [selectedProvider, requestLocalModels])

  useInterval(
    requestLocalModels,
    selectedProvider === "ollama" || selectedProvider === "lmstudio" || selectedProvider === "vscode-lm"
      ? 2000
      : null,
  )

  const handleMessage = useCallback((event: MessageEvent) => {
    const message: ExtensionMessage = event.data
    if (message.type === "ollamaModels" && message.ollamaModels) {
      setOllamaModels(message.ollamaModels)
    } else if (message.type === "lmStudioModels" && message.lmStudioModels) {
      setLmStudioModels(message.lmStudioModels)
    } else if (message.type === "vsCodeLmModels" && message.vsCodeLmModels) {
      setVsCodeLmModels(message.vsCodeLmModels)
    }
  }, [])

  useEvent("message", handleMessage)

  // 渲染当前选中的提供商组件
  const renderProviderComponent = useMemo(() => {
    const config = providerConfig[selectedProvider];
    if (!config) return null;
    return config.component();
  }, [providerConfig, selectedProvider]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div className="dropdown-container">
        <label htmlFor="api-provider">
          <span style={{ fontWeight: 500 }}>API Provider</span>
        </label>
        <Dropdown
          id="api-provider"
          value={selectedProvider}
          onChange={(value: unknown) => {
            handleInputChange("apiProvider")({
              target: {
                value: (value as DropdownOption).value,
              },
            })
          }}
          style={{ minWidth: 130, position: "relative", zIndex: 1001 }}
          options={providerOptions}
        />
      </div>

      {renderProviderComponent}

      {apiErrorMessage && (
        <div
          style={{
            margin: "-10px 0 4px 0",
            fontSize: 12,
            color: "var(--vscode-errorForeground)",
          }}>
          {apiErrorMessage}
        </div>
      )}

      {!noModelSelectorProviders.includes(selectedProvider) && (
        <ModelSelector
          selectedProvider={selectedProvider}
          selectedModelId={selectedModelId}
          selectedModelInfo={selectedModelInfo}
          models={providerConfig[selectedProvider]?.models || {}}
          handleInputChange={handleInputChange}
        />
      )}

      {modelIdErrorMessage && (
        <div
          style={{
            margin: "-10px 0 4px 0",
            fontSize: 12,
            color: "var(--vscode-errorForeground)",
          }}>
          {modelIdErrorMessage}
        </div>
      )}
    </div>
  )
}

export default memo(ApiOptions)
