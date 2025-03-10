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
          options={[
            { value: "openrouter", label: "OpenRouter" },
            { value: "anthropic", label: "Anthropic" },
            { value: "gemini", label: "Google Gemini" },
            { value: "deepseek", label: "DeepSeek" },
            { value: "openai-native", label: "OpenAI" },
            { value: "openai", label: "OpenAI Compatible" },
            { value: "vertex", label: "GCP Vertex AI" },
            { value: "bedrock", label: "AWS Bedrock" },
            { value: "glama", label: "Glama" },
            { value: "vscode-lm", label: "VS Code LM API" },
            { value: "mistral", label: "Mistral" },
            { value: "lmstudio", label: "LM Studio" },
            { value: "ollama", label: "Ollama" },
          ]}
        />
      </div>

      {selectedProvider === "anthropic" && (
        <AnthropicOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "glama" && (
        <GlamaOptions 
          apiConfiguration={apiConfiguration} 
          uriScheme={uriScheme} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "openai-native" && (
        <OpenAiNativeOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "mistral" && (
        <MistralOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "openrouter" && (
        <OpenRouterOptions 
          apiConfiguration={apiConfiguration} 
          uriScheme={uriScheme} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "bedrock" && (
        <BedrockOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "vertex" && (
        <VertexOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "gemini" && (
        <GeminiOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "openai" && (
        <OpenAiOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "deepseek" && (
        <DeepSeekOptions 
          apiConfiguration={apiConfiguration} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "vscode-lm" && (
        <VSCodeLmOptions 
          apiConfiguration={apiConfiguration} 
          vsCodeLmModels={vsCodeLmModels} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "lmstudio" && (
        <LmStudioOptions 
          apiConfiguration={apiConfiguration} 
          lmStudioModels={lmStudioModels} 
          handleInputChange={handleInputChange} 
        />
      )}

      {selectedProvider === "ollama" && (
        <OllamaOptions 
          apiConfiguration={apiConfiguration} 
          ollamaModels={ollamaModels} 
          handleInputChange={handleInputChange} 
        />
      )}

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

      {selectedProvider !== "glama" &&
        selectedProvider !== "openrouter" &&
        selectedProvider !== "openai" &&
        selectedProvider !== "ollama" &&
        selectedProvider !== "lmstudio" &&
        selectedProvider !== "vscode-lm" && (
          <ModelSelector
            selectedProvider={selectedProvider}
            selectedModelId={selectedModelId}
            selectedModelInfo={selectedModelInfo}
            models={
              selectedProvider === "anthropic" ? anthropicModels :
              selectedProvider === "bedrock" ? bedrockModels :
              selectedProvider === "vertex" ? vertexModels :
              selectedProvider === "gemini" ? geminiModels :
              selectedProvider === "openai-native" ? openAiNativeModels :
              selectedProvider === "deepseek" ? deepSeekModels :
              selectedProvider === "mistral" ? mistralModels : {}
            }
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
