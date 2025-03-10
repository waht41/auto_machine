import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { Dropdown } from "@webview-ui/components/ui";
import type { DropdownOption } from "vscrui";
import { ApiConfiguration } from "@/shared/api";

interface VertexOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const VertexOptions = ({ apiConfiguration, handleInputChange }: VertexOptionsProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <VSCodeTextField
        value={apiConfiguration?.vertexProjectId || ""}
        style={{ width: "100%" }}
        onInput={handleInputChange("vertexProjectId")}
        placeholder="Enter Project ID...">
        <span style={{ fontWeight: 500 }}>Google Cloud Project ID</span>
      </VSCodeTextField>
      
      <div className="dropdown-container">
        <label htmlFor="vertex-region-dropdown">
          <span style={{ fontWeight: 500 }}>Google Cloud Region</span>
        </label>
        <Dropdown
          id="vertex-region-dropdown"
          value={apiConfiguration?.vertexRegion || ""}
          style={{ width: "100%" }}
          onChange={(value: unknown) => {
            handleInputChange("vertexRegion")({
              target: {
                value: (value as DropdownOption).value,
              },
            });
          }}
          options={[
            { value: "", label: "Select a region..." },
            { value: "us-east5", label: "us-east5" },
            { value: "us-central1", label: "us-central1" },
            { value: "europe-west1", label: "europe-west1" },
            { value: "europe-west4", label: "europe-west4" },
            { value: "asia-southeast1", label: "asia-southeast1" },
          ]}
        />
      </div>
      
      <div
        style={{
          fontSize: "12px",
          marginTop: "5px",
          color: "var(--vscode-descriptionForeground)",
        }}>
        To use Google Cloud Vertex AI, you need to
        <VSCodeLink
          href="https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#before_you_begin"
          style={{ display: "inline", fontSize: "inherit" }}>
          {
            "1) create a Google Cloud account › enable the Vertex AI API › enable the desired Claude models,"
          }
        </VSCodeLink>{" "}
        <VSCodeLink
          href="https://cloud.google.com/docs/authentication/provide-credentials-adc#google-idp"
          style={{ display: "inline", fontSize: "inherit" }}>
          {"2) install the Google Cloud CLI › configure Application Default Credentials."}
        </VSCodeLink>
      </div>
    </div>
  );
};

export default VertexOptions;
