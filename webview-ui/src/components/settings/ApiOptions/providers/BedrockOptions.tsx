import { VSCodeRadio, VSCodeRadioGroup, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { Checkbox, Dropdown } from "@webview-ui/components/ui";
import type { DropdownOption } from "vscrui";
import { ApiConfiguration } from "@/shared/api";

interface BedrockOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field:  keyof ApiConfiguration) => (e: any) => void;
}

const BedrockOptions = ({ apiConfiguration, handleInputChange }: BedrockOptionsProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <VSCodeRadioGroup
        value={apiConfiguration?.awsUseProfile ? "profile" : "credentials"}
        onChange={(e) => {
          const value = (e.target as HTMLInputElement)?.value;
          const useProfile = value === "profile";
          handleInputChange("awsUseProfile")({
            target: { value: useProfile },
          });
        }}>
        <VSCodeRadio value="credentials">AWS Credentials</VSCodeRadio>
        <VSCodeRadio value="profile">AWS Profile</VSCodeRadio>
      </VSCodeRadioGroup>
      
      {/* AWS Profile Config Block */}
      {apiConfiguration?.awsUseProfile ? (
        <VSCodeTextField
          value={apiConfiguration?.awsProfile || ""}
          style={{ width: "100%" }}
          onInput={handleInputChange("awsProfile")}
          placeholder="Enter profile name">
          <span style={{ fontWeight: 500 }}>AWS Profile Name</span>
        </VSCodeTextField>
      ) : (
        <>
          {/* AWS Credentials Config Block */}
          <VSCodeTextField
            value={apiConfiguration?.awsAccessKey || ""}
            style={{ width: "100%" }}
            type="password"
            onInput={handleInputChange("awsAccessKey")}
            placeholder="Enter Access Key...">
            <span style={{ fontWeight: 500 }}>AWS Access Key</span>
          </VSCodeTextField>
          <VSCodeTextField
            value={apiConfiguration?.awsSecretKey || ""}
            style={{ width: "100%" }}
            type="password"
            onInput={handleInputChange("awsSecretKey")}
            placeholder="Enter Secret Key...">
            <span style={{ fontWeight: 500 }}>AWS Secret Key</span>
          </VSCodeTextField>
          <VSCodeTextField
            value={apiConfiguration?.awsSessionToken || ""}
            style={{ width: "100%" }}
            type="password"
            onInput={handleInputChange("awsSessionToken")}
            placeholder="Enter Session Token...">
            <span style={{ fontWeight: 500 }}>AWS Session Token</span>
          </VSCodeTextField>
        </>
      )}
      
      <div className="dropdown-container">
        <label htmlFor="aws-region-dropdown">
          <span style={{ fontWeight: 500 }}>AWS Region</span>
        </label>
        <Dropdown
          id="aws-region-dropdown"
          value={apiConfiguration?.awsRegion || ""}
          style={{ width: "100%" }}
          onChange={(value: unknown) => {
            handleInputChange("awsRegion")({
              target: {
                value: (value as DropdownOption).value,
              },
            });
          }}
          options={[
            { value: "", label: "Select a region..." },
            { value: "us-east-1", label: "us-east-1" },
            { value: "us-east-2", label: "us-east-2" },
            { value: "us-west-2", label: "us-west-2" },
            { value: "ap-south-1", label: "ap-south-1" },
            { value: "ap-northeast-1", label: "ap-northeast-1" },
            { value: "ap-northeast-2", label: "ap-northeast-2" },
            { value: "ap-southeast-1", label: "ap-southeast-1" },
            { value: "ap-southeast-2", label: "ap-southeast-2" },
            { value: "ca-central-1", label: "ca-central-1" },
            { value: "eu-central-1", label: "eu-central-1" },
            { value: "eu-west-1", label: "eu-west-1" },
            { value: "eu-west-2", label: "eu-west-2" },
            { value: "eu-west-3", label: "eu-west-3" },
            { value: "sa-east-1", label: "sa-east-1" },
            { value: "us-gov-west-1", label: "us-gov-west-1" },
          ]}
        />
      </div>
      
      <Checkbox
        checked={apiConfiguration?.awsUseCrossRegionInference || false}
        onChange={(checked: boolean) => {
          handleInputChange("awsUseCrossRegionInference")({
            target: { value: checked },
          });
        }}>
        Use cross-region inference
      </Checkbox>
      
      <div
        style={{
          fontSize: "12px",
          marginTop: "5px",
          color: "var(--vscode-descriptionForeground)",
        }}>
        Authenticate by either providing the keys above or use the default AWS credential providers,
        i.e. ~/.aws/credentials or environment variables. These credentials are only used locally to
        make API requests from this extension.
      </div>
    </div>
  );
};

export default BedrockOptions;
