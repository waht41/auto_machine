import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { memo, useEffect, useState } from 'react';
import { useExtensionState } from '@webview-ui/context/ExtensionStateContext';
import { validateApiConfiguration, validateModelId } from '@webview-ui/utils/validate';
import { vscode } from '@webview-ui/utils/vscode';
import ApiOptions from './ApiOptions';

type SettingsViewProps = {
	onDone: () => void
}

const SettingsView = ({ onDone }: SettingsViewProps) => {
	const {
		apiConfiguration,
		alwaysAllowMcp,
		soundEnabled,
		soundVolume,
		diffEnabled,
		browserViewportSize,
		openRouterModels,
		glamaModels,
		allowedCommands,
		fuzzyMatchThreshold,
		writeDelayMs,
		screenshotQuality,
		terminalOutputLineLimit,
		mcpEnabled,
		alwaysApproveResubmit,
		requestDelaySeconds,
		currentApiConfigName,
		experimentalDiffStrategy,
	} = useExtensionState();
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined);
	const [modelIdErrorMessage, setModelIdErrorMessage] = useState<string | undefined>(undefined);

	const handleSubmit = () => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration);
		const modelIdValidationResult = validateModelId(apiConfiguration, glamaModels, openRouterModels);

		setApiErrorMessage(apiValidationResult);
		setModelIdErrorMessage(modelIdValidationResult);
		if (!apiValidationResult && !modelIdValidationResult) {
			vscode.postMessage({
				type: 'apiConfiguration',
				apiConfiguration,
			});
			vscode.postMessage({ type: 'alwaysAllowMcp', bool: alwaysAllowMcp });
			vscode.postMessage({ type: 'allowedCommands', commands: allowedCommands ?? [] });
			vscode.postMessage({ type: 'soundEnabled', bool: soundEnabled });
			vscode.postMessage({ type: 'soundVolume', value: soundVolume });
			vscode.postMessage({ type: 'diffEnabled', bool: diffEnabled });
			vscode.postMessage({ type: 'browserViewportSize', text: browserViewportSize });
			vscode.postMessage({ type: 'fuzzyMatchThreshold', value: fuzzyMatchThreshold ?? 1.0 });
			vscode.postMessage({ type: 'writeDelayMs', value: writeDelayMs });
			vscode.postMessage({ type: 'screenshotQuality', value: screenshotQuality ?? 75 });
			vscode.postMessage({ type: 'terminalOutputLineLimit', value: terminalOutputLineLimit ?? 500 });
			vscode.postMessage({ type: 'mcpEnabled', bool: mcpEnabled });
			vscode.postMessage({ type: 'alwaysApproveResubmit', bool: alwaysApproveResubmit });
			vscode.postMessage({ type: 'requestDelaySeconds', value: requestDelaySeconds });
			vscode.postMessage({ type: 'currentApiConfigName', text: currentApiConfigName });
			vscode.postMessage({
				type: 'upsertApiConfiguration',
				text: currentApiConfigName,
				apiConfiguration,
			});
			vscode.postMessage({ type: 'experimentalDiffStrategy', bool: experimentalDiffStrategy });
			onDone();
		}
	};

	useEffect(() => {
		setApiErrorMessage(undefined);
		setModelIdErrorMessage(undefined);
	}, [apiConfiguration]);

	// Initial validation on mount
	useEffect(() => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration);
		const modelIdValidationResult = validateModelId(apiConfiguration, glamaModels, openRouterModels);
		setApiErrorMessage(apiValidationResult);
		setModelIdErrorMessage(modelIdValidationResult);
	}, [apiConfiguration, glamaModels, openRouterModels]);

	return (
		<div
			style={{
				padding: '10px 0px 0px 20px',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			}}>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '17px',
					paddingRight: 17,
				}}>
				<h3 style={{ color: 'var(--vscode-foreground)', margin: 0 }}>Settings</h3>
				<VSCodeButton onClick={handleSubmit}>Done</VSCodeButton>
			</div>
			<div
				style={{ flexGrow: 1, overflowY: 'scroll', paddingRight: 8, display: 'flex', flexDirection: 'column' }}>
				<div style={{ marginBottom: 40 }}>
					<h3 style={{ color: 'var(--vscode-foreground)', margin: '0 0 15px 0' }}>Provider Settings</h3>
					<div style={{ marginBottom: 15 }}>
						<ApiOptions apiErrorMessage={apiErrorMessage} modelIdErrorMessage={modelIdErrorMessage} />
					</div>
				</div>
			</div>
		</div>
	);
};

export default memo(SettingsView);
