import { Dropdown } from '@webview-ui/components/ui';
import type { DropdownOption } from 'vscrui';
import { ApiConfiguration, ModelInfo } from '@/shared/api';
import { ModelInfoView } from '../ModelInfoView';
import { useState } from 'react';

interface ModelSelectorProps {
  selectedProvider: string;
  selectedModelId: string;
  selectedModelInfo: ModelInfo;
  models: Record<string, ModelInfo>;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const ModelSelector = ({ 
	selectedProvider, 
	selectedModelId, 
	selectedModelInfo, 
	models, 
	handleInputChange 
}: ModelSelectorProps) => {
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

	const createDropdown = (models: Record<string, ModelInfo>) => {
		const options: DropdownOption[] = [
			{ value: '', label: 'Select a model...' },
			...Object.keys(models).map((modelId) => ({
				value: modelId,
				label: modelId,
			})),
		];
		return (
			<Dropdown
				id="model-id"
				value={selectedModelId}
				onChange={(value: unknown) => {
					handleInputChange('apiModelId')({
						target: {
							value: (value as DropdownOption).value,
						},
					});
				}}
				style={{ width: '100%' }}
				options={options}
			/>
		);
	};

	return (
		<>
			<div className="dropdown-container">
				<label htmlFor="model-id">
					<span style={{ fontWeight: 500 }}>Model</span>
				</label>
				{createDropdown(models)}
			</div>

			<ModelInfoView
				selectedModelId={selectedModelId}
				modelInfo={selectedModelInfo}
				isDescriptionExpanded={isDescriptionExpanded}
				setIsDescriptionExpanded={setIsDescriptionExpanded}
			/>
		</>
	);
};

export default ModelSelector;
