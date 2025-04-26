import os from 'os';
import { execSync } from 'child_process';

export interface ShellInfo {
	name: string;
	version: string;
}

/**
 * 尝试执行命令并捕获输出
 * @param command 要执行的命令
 * @param options 执行选项
 * @returns 命令输出或null（如果执行失败）
 */
function tryExecuteCommand(command: string, options: {shell?: string, encoding?: string} = {}): string | null {
	try {
		return execSync(command, { encoding: 'utf8', ...options }).trim();
	} catch (e) {
		return null;
	}
}

/**
 * 从版本字符串中提取版本号
 * @param versionOutput 版本输出字符串
 * @param pattern 正则表达式模式
 * @param defaultValue 默认值
 * @returns 提取的版本号或默认值
 */
function extractVersion(versionOutput: string | null, pattern: RegExp, defaultValue: string = 'unknown'): string {
	if (!versionOutput) return defaultValue;
	const match = versionOutput.match(pattern);
	return match ? match[1] : defaultValue;
}

/**
 * 检测Windows系统上的CMD shell
 * @returns Shell信息或null（如果不是CMD）
 */
function detectWindowsCmd(): ShellInfo | null {
	const cmdVersionOutput = tryExecuteCommand('ver', { shell: 'cmd.exe' });
	if (!cmdVersionOutput) return null;
	
	// 测试CMD特有命令
	if (!tryExecuteCommand('dir /b', { shell: 'cmd.exe' })) return null;
	
	// 获取CMD版本而不是Windows版本
	// CMD本身没有版本标识命令，尝试获取cmd.exe文件版本
	const cmdExeVersionOutput = tryExecuteCommand('powershell -command "(Get-Item C:\\Windows\\System32\\cmd.exe).VersionInfo.FileVersion"', { shell: 'powershell.exe' });
	const version = cmdExeVersionOutput || 'unknown';
	
	return {
		name: 'cmd.exe',
		version
	};
}

/**
 * 检测Windows系统上的PowerShell
 * @returns Shell信息或null（如果不是PowerShell）
 */
function detectWindowsPowerShell(): ShellInfo | null {
	const psVersionOutput = tryExecuteCommand('(Get-Host).Version.ToString()', { shell: 'powershell.exe' });
	if (!psVersionOutput) return null;
	
	// 测试PowerShell特有命令
	if (!tryExecuteCommand('Get-Process | Select-Object -First 1', { shell: 'powershell.exe' })) return null;
	
	return {
		name: 'powershell',
		version: psVersionOutput
	};
}

/**
 * 检测Windows系统上的Git Bash
 * @returns Shell信息或null（如果不是Git Bash）
 */
function detectWindowsGitBash(): ShellInfo | null {
	const bashVersionOutput = tryExecuteCommand('bash --version');
	if (!bashVersionOutput) return null;
	
	const version = extractVersion(bashVersionOutput, /version\s+([^\s,]+)/i);
	
	return {
		name: 'git_bash',
		version
	};
}

/**
 * 检测Unix系统上的shell
 * @param shellPath shell路径
 * @returns Shell信息
 */
function detectUnixShell(shellPath: string | undefined): ShellInfo {
	if (!shellPath) {
		return detectUnixShellViaCommand();
	}
	
	// 从路径中提取shell名称
	const parts = shellPath.split('/');
	const shellName = parts[parts.length - 1];
	
	if (shellName.includes('zsh')) {
		return detectSpecificUnixShell('zsh', shellPath);
	} else if (shellName.includes('bash')) {
		return detectSpecificUnixShell('bash', shellPath);
	} else if (shellName.includes('fish')) {
		return detectSpecificUnixShell('fish', shellPath);
	} else if (shellName.includes('sh')) {
		return detectSpecificUnixShell('sh', shellPath);
	} else {
		// 尝试通用方法获取shell版本
		let version = 'unknown';
		const versionOutput = tryExecuteCommand(`${shellName} --version`);
		
		if (versionOutput) {
			// 尝试从第一行提取版本号
			const firstLine = versionOutput.split('\n')[0];
			// 查找包含version或v后跟数字的部分
			const versionMatch = firstLine.match(/(?:version|v)[^\d]*(\d+(?:\.\d+)+)/i);
			version = versionMatch ? versionMatch[1] : 'unknown';
		}
		
		return {
			name: shellName || 'unknown_unix_shell',
			version
		};
	}
}

/**
 * 检测特定类型的Unix shell
 * @param shellType shell类型
 * @param shellPath shell路径
 * @returns Shell信息
 */
function detectSpecificUnixShell(shellType: string, shellPath?: string): ShellInfo {
	let version = 'unknown';
	
	switch (shellType) {
		case 'zsh':
			// 尝试获取zsh版本
			const zshVersionOutput = tryExecuteCommand('zsh --version');
			if (zshVersionOutput) {
				// zsh 版本通常格式为 "zsh 5.8 (x86_64-apple-darwin21.0)"
				const versionMatch = zshVersionOutput.match(/zsh\s+(\d+\.\d+(?:\.\d+)*)/i);
				version = versionMatch ? versionMatch[1] : 'unknown';
				// 测试zsh特有命令
				tryExecuteCommand('setopt', { shell: shellPath });
			}
			break;
			
		case 'bash':
			// 尝试获取bash版本
			const bashVersionOutput = tryExecuteCommand('bash --version');
			if (bashVersionOutput) {
				// bash 版本通常格式为 "GNU bash, version 5.1.16(1)-release (x86_64-pc-linux-gnu)"
				const versionMatch = bashVersionOutput.match(/version\s+(\d+\.\d+(?:\.\d+)*)/i);
				version = versionMatch ? versionMatch[1] : 'unknown';
				// 测试bash特有命令
				if (shellPath) tryExecuteCommand('shopt -p', { shell: shellPath });
			}
			break;
			
		case 'fish':
			// 尝试获取fish版本
			const fishVersionOutput = tryExecuteCommand('fish --version');
			if (fishVersionOutput) {
				// fish 版本通常格式为 "fish, version 3.3.1"
				const versionMatch = fishVersionOutput.match(/version\s+(\d+\.\d+(?:\.\d+)*)/i);
				version = versionMatch ? versionMatch[1] : 'unknown';
				// 测试fish特有命令
				if (shellPath) tryExecuteCommand('status', { shell: shellPath });
			}
			break;
			
		case 'sh':
			// sh通常没有版本命令，但我们可以尝试
			const shVersionOutput = tryExecuteCommand('sh --version');
			if (shVersionOutput) {
				// 尝试提取版本号
				const versionMatch = shVersionOutput.match(/(?:version|v)[^\d]*(\d+(?:\.\d+)+)/i);
				version = versionMatch ? versionMatch[1] : 'unknown';
			}
			break;
	}
	
	return {
		name: shellType,
		version
	};
}

/**
 * 通过命令执行检测Unix shell
 * @returns Shell信息
 */
function detectUnixShellViaCommand(): ShellInfo {
	// 尝试通过$0获取shell名称
	const shellName = tryExecuteCommand('echo $0');
	
	if (!shellName) {
		return {
			name: 'unknown_unix_shell',
			version: 'unknown'
		};
	}
	
	if (shellName.includes('zsh')) {
		return detectSpecificUnixShell('zsh');
	} else if (shellName.includes('bash')) {
		return detectSpecificUnixShell('bash');
	} else if (shellName.includes('fish')) {
		return detectSpecificUnixShell('fish');
	} else if (shellName.includes('sh')) {
		return detectSpecificUnixShell('sh');
	}
	
	// 如果无法识别具体的shell类型，尝试提取版本
	let version = 'unknown';
	const versionOutput = tryExecuteCommand(`${shellName} --version`);
	if (versionOutput) {
		const versionMatch = versionOutput.match(/(?:version|v)[^\d]*(\d+(?:\.\d+)+)/i);
		version = versionMatch ? versionMatch[1] : 'unknown';
	}
	
	return {
		name: shellName || 'unknown_unix_shell',
		version
	};
}

/**
 * 检测当前系统使用的shell
 * @returns Shell信息
 */
export function detectShell(): ShellInfo {
	const platform = os.platform();
	
	if (platform === 'win32') {
		// Windows平台检测
		return (
			detectWindowsCmd() ||
			detectWindowsPowerShell() ||
			detectWindowsGitBash() ||
			{ name: 'unknown_windows_shell', version: 'unknown' }
		);
	} else {
		// Unix-like平台检测
		return detectUnixShell(process.env.SHELL);
	}
}