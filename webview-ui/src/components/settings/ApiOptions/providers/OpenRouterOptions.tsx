import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Checkbox } from '@webview-ui/components/ui';
import VSCodeButtonLink from '@webview-ui/components/common/VSCodeButtonLink';
import { useState, useEffect } from 'react';
import { getOpenRouterAuthUrl } from '../utils';
import OpenRouterModelPicker from '../OpenRouterModelPicker';
import { ApiConfiguration } from '@/shared/api';

interface OpenRouterOptionsProps {
  apiConfiguration: any;
  uriScheme?: string;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const OpenRouterOptions = ({ apiConfiguration, uriScheme, handleInputChange }: OpenRouterOptionsProps) => {
	const [openRouterBaseUrlSelected, setOpenRouterBaseUrlSelected] = useState(!!apiConfiguration?.openRouterBaseUrl);

	useEffect(() => {
		setOpenRouterBaseUrlSelected(!!apiConfiguration?.openRouterBaseUrl);
	}, [apiConfiguration?.openRouterBaseUrl]);

	return (
		<div>
			<VSCodeTextField
				value={apiConfiguration?.openRouterApiKey || ''}
				style={{ width: '100%' }}
				type="password"
				onInput={handleInputChange('openRouterApiKey')}
				placeholder="Enter API Key...">
				<span style={{ fontWeight: 500 }}>OpenRouter API Key</span>
			</VSCodeTextField>
      
			{!apiConfiguration?.openRouterApiKey && (
				<div>
					<VSCodeButtonLink
						href={getOpenRouterAuthUrl(uriScheme)}
						style={{ margin: '5px 0 0 0' }}
						appearance="secondary">
            Get OpenRouter API Key
					</VSCodeButtonLink>
				</div>
			)}
      
			<Checkbox
				checked={openRouterBaseUrlSelected}
				onChange={(checked: boolean) => {
					setOpenRouterBaseUrlSelected(checked);
					if (!checked) {
						handleInputChange('openRouterBaseUrl')({
							target: {
								value: '',
							},
						});
					}
				}}>
        Use custom base URL
			</Checkbox>

			{openRouterBaseUrlSelected && (
				<VSCodeTextField
					value={apiConfiguration?.openRouterBaseUrl || ''}
					style={{ width: '100%', marginTop: 3 }}
					type="url"
					onInput={handleInputChange('openRouterBaseUrl')}
					placeholder="Default: https://openrouter.ai/api/v1"
				/>
			)}
      
			<div
				style={{
					fontSize: '12px',
					marginTop: '5px',
					color: 'var(--vscode-descriptionForeground)',
				}}>
        This key is stored locally and only used to make API requests from this extension.
			</div>
      
			<Checkbox
				checked={apiConfiguration?.openRouterUseMiddleOutTransform || false}
				onChange={(checked: boolean) => {
					handleInputChange('openRouterUseMiddleOutTransform')({
						target: { value: checked },
					});
				}}>
        Compress prompts and message chains to the context size (
				<a href="https://openrouter.ai/docs/transforms">OpenRouter Transforms</a>)
			</Checkbox>
      
			<br />
			<OpenRouterModelPicker />
		</div>
	);
};

export default OpenRouterOptions;
