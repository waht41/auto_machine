import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Checkbox, Pane } from '@webview-ui/components/ui';
import { useState, useEffect } from 'react';
import { ApiConfiguration, azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults } from '@/shared/api';
import OpenAiModelPicker from '../OpenAiModelPicker';

interface OpenAiOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const OpenAiOptions = ({ apiConfiguration, handleInputChange }: OpenAiOptionsProps) => {
	const [azureApiVersionSelected, setAzureApiVersionSelected] = useState(!!apiConfiguration?.azureApiVersion);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

	useEffect(() => {
		setAzureApiVersionSelected(!!apiConfiguration?.azureApiVersion);
	}, [apiConfiguration?.azureApiVersion]);

	return (
		<div>
			<VSCodeTextField
				value={apiConfiguration?.openAiBaseUrl || ''}
				style={{ width: '100%' }}
				type="url"
				onInput={handleInputChange('openAiBaseUrl')}
				placeholder={'Enter base URL...'}>
				<span style={{ fontWeight: 500 }}>Base URL</span>
			</VSCodeTextField>
      
			<VSCodeTextField
				value={apiConfiguration?.openAiApiKey || ''}
				style={{ width: '100%' }}
				type="password"
				onInput={handleInputChange('openAiApiKey')}
				placeholder="Enter API Key...">
				<span style={{ fontWeight: 500 }}>API Key</span>
			</VSCodeTextField>
      
			<OpenAiModelPicker />
      
			<div style={{ display: 'flex', alignItems: 'center' }}>
				<Checkbox
					checked={apiConfiguration?.openAiStreamingEnabled ?? true}
					onChange={(checked: boolean) => {
						handleInputChange('openAiStreamingEnabled')({
							target: { value: checked },
						});
					}}>
          Enable streaming
				</Checkbox>
			</div>
      
			<Checkbox
				checked={apiConfiguration?.openAiUseAzure ?? false}
				onChange={(checked: boolean) => {
					handleInputChange('openAiUseAzure')({
						target: { value: checked },
					});
				}}>
        Use Azure
			</Checkbox>
      
			<Checkbox
				checked={azureApiVersionSelected}
				onChange={(checked: boolean) => {
					setAzureApiVersionSelected(checked);
					if (!checked) {
						handleInputChange('azureApiVersion')({
							target: {
								value: '',
							},
						});
					}
				}}>
        Set Azure API version
			</Checkbox>
      
			{azureApiVersionSelected && (
				<VSCodeTextField
					value={apiConfiguration?.azureApiVersion || ''}
					style={{ width: '100%', marginTop: 3 }}
					onInput={handleInputChange('azureApiVersion')}
					placeholder={`Default: ${azureOpenAiDefaultApiVersion}`}
				/>
			)}

			<div style={{ marginTop: 15 }} />
      
			<Pane
				title="Model Configuration"
				open={false}
				actions={[
					{
						iconName: 'refresh',
						onClick: () =>
							handleInputChange('openAiCustomModelInfo')({
								target: { value: openAiModelInfoSaneDefaults },
							}),
					},
				]}>
				<div
					style={{
						padding: 15,
						backgroundColor: 'var(--vscode-editor-background)',
					}}>
					<div
						style={{
							fontSize: '12px',
							color: 'var(--vscode-descriptionForeground)',
							margin: '0 0 15px 0',
							lineHeight: '1.4',
						}}>
            Configure the capabilities and pricing for your custom OpenAI-compatible model. <br />
            Be careful for the model capabilities, as they can affect how Roo Code can work.
					</div>

					{/* Capabilities Section */}
					<div
						style={{
							marginBottom: 20,
							padding: 12,
							backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
							borderRadius: 4,
						}}>
						<span
							style={{
								fontWeight: 500,
								fontSize: '12px',
								display: 'block',
								marginBottom: 12,
								color: 'var(--vscode-editor-foreground)',
							}}>
              Model Capabilities
						</span>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							<div className="token-config-field">
								<VSCodeTextField
									value={
										apiConfiguration?.openAiCustomModelInfo?.maxTokens?.toString() ||
                    openAiModelInfoSaneDefaults.maxTokens?.toString() ||
                    ''
									}
									type="text"
									style={{
										width: '100%',
										borderColor: (() => {
											const value = apiConfiguration?.openAiCustomModelInfo?.maxTokens;
											if (!value) return 'var(--vscode-input-border)';
											return value > 0
												? 'var(--vscode-charts-green)'
												: 'var(--vscode-errorForeground)';
										})(),
									}}
									title="Maximum number of tokens the model can generate in a single response"
									onChange={(e: any) => {
										const value = parseInt(e.target.value);
										handleInputChange('openAiCustomModelInfo')({
											target: {
												value: {
													...(apiConfiguration?.openAiCustomModelInfo ||
                            openAiModelInfoSaneDefaults),
													maxTokens: isNaN(value) ? undefined : value,
												},
											},
										});
									}}
									placeholder="e.g. 4096">
									<span style={{ fontWeight: 500 }}>Max Output Tokens</span>
								</VSCodeTextField>
								<div
									style={{
										fontSize: '11px',
										color: 'var(--vscode-descriptionForeground)',
										marginTop: 4,
										display: 'flex',
										alignItems: 'center',
										gap: 4,
									}}>
									<i className="codicon codicon-info" style={{ fontSize: '12px' }}></i>
									<span>
                    Maximum number of tokens the model can generate in a response. <br />
                    (-1 is depend on server)
									</span>
								</div>
							</div>

							<div className="token-config-field">
								<VSCodeTextField
									value={
										apiConfiguration?.openAiCustomModelInfo?.contextWindow?.toString() ||
                    openAiModelInfoSaneDefaults.contextWindow?.toString() ||
                    ''
									}
									type="text"
									style={{
										width: '100%',
										borderColor: (() => {
											const value = apiConfiguration?.openAiCustomModelInfo?.contextWindow;
											if (!value) return 'var(--vscode-input-border)';
											return value > 0
												? 'var(--vscode-charts-green)'
												: 'var(--vscode-errorForeground)';
										})(),
									}}
									title="Total number of tokens (input + output) the model can process in a single request"
									onChange={(e: any) => {
										const parsed = parseInt(e.target.value);
										handleInputChange('openAiCustomModelInfo')({
											target: {
												value: {
													...(apiConfiguration?.openAiCustomModelInfo ||
                            openAiModelInfoSaneDefaults),
													contextWindow:
                            e.target.value === ''
                            	? undefined
                            	: isNaN(parsed)
                            		? openAiModelInfoSaneDefaults.contextWindow
                            		: parsed,
												},
											},
										});
									}}
									placeholder="e.g. 128000">
									<span style={{ fontWeight: 500 }}>Context Window Size</span>
								</VSCodeTextField>
								<div
									style={{
										fontSize: '11px',
										color: 'var(--vscode-descriptionForeground)',
										marginTop: 4,
										display: 'flex',
										alignItems: 'center',
										gap: 4,
									}}>
									<i className="codicon codicon-info" style={{ fontSize: '12px' }}></i>
									<span>
                    Total tokens (input + output) the model can process. This will help Roo
                    Code run correctly.
									</span>
								</div>
							</div>

							<div
								style={{
									backgroundColor: 'var(--vscode-editor-background)',
									padding: '12px',
									borderRadius: '4px',
									marginTop: '8px',
									border: '1px solid var(--vscode-input-border)',
									transition: 'background-color 0.2s ease',
								}}>
								<span
									style={{
										fontSize: '11px',
										fontWeight: 500,
										color: 'var(--vscode-editor-foreground)',
										display: 'block',
										marginBottom: '10px',
									}}>
                  Model Features
								</span>

								<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
									<div className="feature-toggle">
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
											<Checkbox
												checked={
													apiConfiguration?.openAiCustomModelInfo?.supportsImages ??
                          openAiModelInfoSaneDefaults.supportsImages
												}
												onChange={(checked: boolean) => {
													handleInputChange('openAiCustomModelInfo')({
														target: {
															value: {
																...(apiConfiguration?.openAiCustomModelInfo ||
                                  openAiModelInfoSaneDefaults),
																supportsImages: checked,
															},
														},
													});
												}}>
												<span style={{ fontWeight: 500 }}>Image Support</span>
											</Checkbox>
											<i
												className="codicon codicon-info"
												title="Enable if the model can process and understand images in the input. Required for image-based assistance and visual code understanding."
												style={{
													fontSize: '12px',
													color: 'var(--vscode-descriptionForeground)',
													cursor: 'help',
												}}
											/>
										</div>
										<div
											style={{
												fontSize: '11px',
												color: 'var(--vscode-descriptionForeground)',
												marginLeft: '24px',
												marginTop: '4px',
												lineHeight: '1.4',
											}}>
                      Allows the model to analyze and understand images, essential for
                      visual code assistance
										</div>
									</div>

									<div
										className="feature-toggle"
										style={{
											borderTop: '1px solid var(--vscode-input-border)',
											paddingTop: '12px',
										}}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
											<Checkbox
												checked={
													apiConfiguration?.openAiCustomModelInfo
														?.supportsComputerUse ?? false
												}
												onChange={(checked: boolean) => {
													handleInputChange('openAiCustomModelInfo')({
														target: {
															value: {
																...(apiConfiguration?.openAiCustomModelInfo ||
                                  openAiModelInfoSaneDefaults),
																supportsComputerUse: checked,
															},
														},
													});
												}}>
												<span style={{ fontWeight: 500 }}>Computer Use</span>
											</Checkbox>
											<i
												className="codicon codicon-info"
												title="Enable if the model can interact with your computer through commands and file operations. Required for automated tasks and file modifications."
												style={{
													fontSize: '12px',
													color: 'var(--vscode-descriptionForeground)',
													cursor: 'help',
												}}
											/>
										</div>
										<div
											style={{
												fontSize: '11px',
												color: 'var(--vscode-descriptionForeground)',
												marginLeft: '24px',
												marginTop: '4px',
												lineHeight: '1.4',
											}}>
                      This model feature is for computer use like sonnet 3.5 support
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Pricing Section */}
					<div
						style={{
							backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
							padding: '12px',
							borderRadius: '4px',
							marginTop: '15px',
						}}>
						<div style={{ marginBottom: '12px' }}>
							<span
								style={{
									fontWeight: 500,
									fontSize: '12px',
									color: 'var(--vscode-editor-foreground)',
									display: 'block',
									marginBottom: '4px',
								}}>
                Model Pricing
							</span>
							<span
								style={{
									fontSize: '11px',
									color: 'var(--vscode-descriptionForeground)',
									display: 'block',
								}}>
                Configure token-based pricing in USD per million tokens
							</span>
						</div>

						<div
							style={{
								display: 'grid',
								gridTemplateColumns: '1fr 1fr',
								gap: '12px',
								backgroundColor: 'var(--vscode-editor-background)',
								padding: '12px',
								borderRadius: '4px',
							}}>
							<div className="price-input">
								<VSCodeTextField
									value={
										apiConfiguration?.openAiCustomModelInfo?.inputPrice?.toString() ??
                    openAiModelInfoSaneDefaults.inputPrice?.toString() ??
                    ''
									}
									type="text"
									style={{
										width: '100%',
										borderColor: (() => {
											const value = apiConfiguration?.openAiCustomModelInfo?.inputPrice;
											if (!value && value !== 0) return 'var(--vscode-input-border)';
											return value >= 0
												? 'var(--vscode-charts-green)'
												: 'var(--vscode-errorForeground)';
										})(),
									}}
									onChange={(e: any) => {
										const parsed = parseFloat(e.target.value);
										handleInputChange('openAiCustomModelInfo')({
											target: {
												value: {
													...(apiConfiguration?.openAiCustomModelInfo ??
                            openAiModelInfoSaneDefaults),
													inputPrice:
                            e.target.value === ''
                            	? undefined
                            	: isNaN(parsed)
                            		? openAiModelInfoSaneDefaults.inputPrice
                            		: parsed,
												},
											},
										});
									}}
									placeholder="e.g. 0.0001">
									<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
										<span style={{ fontWeight: 500 }}>Input Price</span>
										<i
											className="codicon codicon-info"
											title="Cost per million tokens in the input/prompt. This affects the cost of sending context and instructions to the model."
											style={{
												fontSize: '12px',
												color: 'var(--vscode-descriptionForeground)',
												cursor: 'help',
											}}
										/>
									</div>
								</VSCodeTextField>
							</div>

							<div className="price-input">
								<VSCodeTextField
									value={
										apiConfiguration?.openAiCustomModelInfo?.outputPrice?.toString() ||
                    openAiModelInfoSaneDefaults.outputPrice?.toString() ||
                    ''
									}
									type="text"
									style={{
										width: '100%',
										borderColor: (() => {
											const value = apiConfiguration?.openAiCustomModelInfo?.outputPrice;
											if (!value && value !== 0) return 'var(--vscode-input-border)';
											return value >= 0
												? 'var(--vscode-charts-green)'
												: 'var(--vscode-errorForeground)';
										})(),
									}}
									onChange={(e: any) => {
										const parsed = parseFloat(e.target.value);
										handleInputChange('openAiCustomModelInfo')({
											target: {
												value: {
													...(apiConfiguration?.openAiCustomModelInfo ||
                            openAiModelInfoSaneDefaults),
													outputPrice:
                            e.target.value === ''
                            	? undefined
                            	: isNaN(parsed)
                            		? openAiModelInfoSaneDefaults.outputPrice
                            		: parsed,
												},
											},
										});
									}}
									placeholder="e.g. 0.0002">
									<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
										<span style={{ fontWeight: 500 }}>Output Price</span>
										<i
											className="codicon codicon-info"
											title="Cost per million tokens in the model's response. This affects the cost of generated content and completions."
											style={{
												fontSize: '12px',
												color: 'var(--vscode-descriptionForeground)',
												cursor: 'help',
											}}
										/>
									</div>
								</VSCodeTextField>
							</div>
						</div>
					</div>
				</div>
			</Pane>
      
			<div
				style={{
					marginTop: 15,
				}}
			/>

			<div
				style={{
					fontSize: '12px',
					marginTop: 3,
					color: 'var(--vscode-descriptionForeground)',
				}}>
				<span style={{ color: 'var(--vscode-errorForeground)' }}>
          (<span style={{ fontWeight: 500 }}>Note:</span> Roo Code uses complex prompts and works best
          with Claude models. Less capable models may not work as expected.)
				</span>
			</div>
		</div>
	);
};

export default OpenAiOptions;
