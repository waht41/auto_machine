import os from 'os';
import { execSync } from 'child_process';

export function detectShell() {
	const platform = os.platform();

	if (platform === 'win32') {
		// Windows
		if (process.env.PSModulePath || process.env.ProgramFiles?.includes('PowerShell') || process.env.PROCESSOR_ARCHITEW6432 === 'ARM64') {
			// PSModulePath 是一个强指示
			// ProgramFiles 包含 PowerShell 也是一个线索
			// ARM64 Windows 默认使用 PowerShell Core
			// 可以增加 try-catch 执行 PowerShell 命令来确认
			try {
				execSync('echo $PSVersionTable.PSVersion', { stdio: 'ignore' });
				return 'powershell';
			} catch (e) {
				console.error('Failed to detect shell via echo $PSVersionTable.PSVersion,',e.toString());
			}
		}
		// ComSpec 通常指向 cmd.exe
		if (process.env.ComSpec && process.env.ComSpec.toLowerCase().endsWith('cmd.exe')) {
			return 'cmd.exe';
		}
		// 如果都无法确定，可能是其他 shell (如 Git Bash, Cygwin 等) 或无法识别
		return 'unknown_windows_shell';

	} else {
		// Unix-like (Linux, macOS, etc.)
		const shellEnv = process.env.SHELL;
		if (shellEnv) {
			if (shellEnv.includes('zsh')) {
				return 'zsh';
			} else if (shellEnv.includes('bash')) {
				return 'bash';
			} else if (shellEnv.includes('sh')) {
				return 'sh';
			} else if (shellEnv.includes('fish')) {
				return 'fish';
			} else {
				// 返回路径的最后一部分作为猜测
				const parts = shellEnv.split('/');
				return parts[parts.length - 1] || 'unknown_unix_shell';
			}
		}

		// 如果 SHELL 环境变量不存在，尝试执行命令 (需要 execSync)
		try {
			// 尝试 $0
			const shellName = execSync('echo $0', { encoding: 'utf8' }).trim();
			if (shellName.includes('zsh')) return 'zsh';
			if (shellName.includes('bash')) return 'bash';
			if (shellName.includes('sh')) return 'sh';
			if (shellName.includes('fish')) return 'fish';
			// 可以继续尝试 ps 命令等

			// 尝试检查特定版本变量
			if (execSync('echo $ZSH_VERSION', { encoding: 'utf8' }).trim()) return 'zsh';
			if (execSync('echo $BASH_VERSION', { encoding: 'utf8' }).trim()) return 'bash';

		} catch(e) {
			// 命令执行失败
			console.error('Failed to detect shell via command execution:', e.message);
		}

		return 'unknown_unix_shell';
	}
}