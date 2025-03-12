import { VSCodeLink, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { ApiConfiguration } from '@/shared/api';

interface DeepSeekOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const DeepSeekOptions = ({ apiConfiguration, handleInputChange }: DeepSeekOptionsProps) => {
	return (
		<div>
			<VSCodeTextField
				value={apiConfiguration?.deepSeekApiKey || ''}
				style={{ width: '100%' }}
				type="password"
				onInput={handleInputChange('deepSeekApiKey')}
				placeholder="Enter API Key...">
				<span style={{ fontWeight: 500 }}>DeepSeek API Key</span>
			</VSCodeTextField>
      
			<div
				style={{
					fontSize: '12px',
					marginTop: '5px',
					color: 'var(--vscode-descriptionForeground)',
				}}>
        This key is stored locally and only used to make API requests from this extension.
				{!apiConfiguration?.deepSeekApiKey && (
					<VSCodeLink
						href="https://platform.deepseek.com/"
						style={{ display: 'inline', fontSize: 'inherit' }}>
            You can get a DeepSeek API key by signing up here.
					</VSCodeLink>
				)}
			</div>
		</div>
	);
};

export default DeepSeekOptions;
