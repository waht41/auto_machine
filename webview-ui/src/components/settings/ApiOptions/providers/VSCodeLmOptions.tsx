import { Dropdown } from '@webview-ui/components/ui';
import type { DropdownOption } from 'vscrui';
import * as vscodemodels from 'vscode';
import { ApiConfiguration } from '@/shared/api';

interface VSCodeLmOptionsProps {
  apiConfiguration: any;
  vsCodeLmModels: vscodemodels.LanguageModelChatSelector[];
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const VSCodeLmOptions = ({ apiConfiguration, vsCodeLmModels, handleInputChange }: VSCodeLmOptionsProps) => {
	return (
		<div>
			<div className="dropdown-container">
				<label htmlFor="vscode-lm-model">
					<span style={{ fontWeight: 500 }}>Language Model</span>
				</label>
				{vsCodeLmModels.length > 0 ? (
					<Dropdown
						id="vscode-lm-model"
						value={
							apiConfiguration?.vsCodeLmModelSelector
								? `${apiConfiguration.vsCodeLmModelSelector.vendor ?? ''}/${apiConfiguration.vsCodeLmModelSelector.family ?? ''}`
								: ''
						}
						onChange={(value: unknown) => {
							const valueStr = (value as DropdownOption)?.value;
							if (!valueStr) {
								return;
							}
							const [vendor, family] = valueStr.split('/');
							handleInputChange('vsCodeLmModelSelector')({
								target: {
									value: { vendor, family },
								},
							});
						}}
						style={{ width: '100%' }}
						options={[
							{ value: '', label: 'Select a model...' },
							...vsCodeLmModels.map((model) => ({
								value: `${model.vendor}/${model.family}`,
								label: `${model.vendor} - ${model.family}`,
							})),
						]}
					/>
				) : (
					<div
						style={{
							fontSize: '12px',
							marginTop: '5px',
							color: 'var(--vscode-descriptionForeground)',
						}}>
            The VS Code Language Model API allows you to run models provided by other VS Code
            extensions (including but not limited to GitHub Copilot). The easiest way to get started
            is to install the Copilot and Copilot Chat extensions from the VS Code Marketplace.
					</div>
				)}

				<div
					style={{
						fontSize: '12px',
						marginTop: '5px',
						color: 'var(--vscode-errorForeground)',
						fontWeight: 500,
					}}>
          Note: This is a very experimental integration and may not work as expected. Please report
          any issues to the Roo-Code GitHub repository.
				</div>
			</div>
		</div>
	);
};

export default VSCodeLmOptions;
