import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useEffect, useState } from 'react';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { validateApiConfiguration } from '../../utils/validate';
import { vscode } from '../../utils/vscode';
import ApiOptions from '../settings/ApiOptions';

const WelcomeView = () => {
	const { apiConfiguration } = useExtensionState();

	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined);

	const disableLetsGoButton = apiErrorMessage != null;

	const handleSubmit = () => {
		vscode.postMessage({ type: 'apiConfiguration', apiConfiguration });
	};

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(apiConfiguration));
	}, [apiConfiguration]);

	return (
		<div style={{padding: '0 20px' }}>
			<h2>Hi, I'm Roo!</h2>
			<p>
				I can do all kinds of tasks thanks to the latest breakthroughs in agentic coding capabilities and access
				to tools that let me create & edit files, explore complex projects, use the browser, and execute
				terminal commands (with your permission, of course). I can even use MCP to create new tools and extend
				my own capabilities.
			</p>

			<b>To get started, this extension needs an API provider.</b>

			<div style={{ marginTop: '10px' }}>
				<ApiOptions />
				<VSCodeButton onClick={handleSubmit} disabled={disableLetsGoButton} style={{ marginTop: '3px' }}>
					Let's go!
				</VSCodeButton>
			</div>
		</div>
	);
};

export default WelcomeView;
