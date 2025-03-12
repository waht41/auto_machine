import { VSCodeLink, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { ApiConfiguration } from '@/shared/api';

interface OpenAiNativeOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const OpenAiNativeOptions = ({ apiConfiguration, handleInputChange }: OpenAiNativeOptionsProps) => {
	return (
		<div>
			<VSCodeTextField
				value={apiConfiguration?.openAiNativeApiKey || ''}
				style={{ width: '100%' }}
				type="password"
				onInput={handleInputChange('openAiNativeApiKey')}
				placeholder="Enter API Key...">
				<span style={{ fontWeight: 500 }}>OpenAI API Key</span>
			</VSCodeTextField>
      
			<div
				style={{
					fontSize: '12px',
					marginTop: 3,
					color: 'var(--vscode-descriptionForeground)',
				}}>
        This key is stored locally and only used to make API requests from this extension.
				{!apiConfiguration?.openAiNativeApiKey && (
					<VSCodeLink
						href="https://platform.openai.com/api-keys"
						style={{ display: 'inline', fontSize: 'inherit' }}>
            You can get an OpenAI API key by signing up here.
					</VSCodeLink>
				)}
			</div>
		</div>
	);
};

export default OpenAiNativeOptions;
