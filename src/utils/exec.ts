import iconv from 'iconv-lite';
import { promisify } from 'util';
import { exec } from 'child_process';

const execPromise = promisify(exec);

export async function safeExec(command: string) {
	const options = {
		encoding: 'buffer' as const, // 强制返回 Buffer
		windowsHide: true,
	};

	try {
		const { stdout, stderr } = await execPromise(command, options);
		const { out, err } = await decode(stdout, stderr);
		return { stdout: out, stderr: err };
	} catch (error) {
		const { stderr } = error;
		const { err } = await decode(Buffer.alloc(0), stderr);
		console.log('error in safe exec',error, err);
		return { stdout:'', stderr: err || error};
	}
}

async function decode(
	stdout: Buffer | string, // 修改为支持 Buffer 输入
	stderr: Buffer | string
): Promise<{ out: string; err: string }> {
	// 统一处理 Buffer 或字符串输入
	const decodeBuffer = (buffer: Buffer | string): string => {
		if (process.platform === 'win32') {
			try {
				// 如果是字符串，说明已被错误解码，尝试恢复
				if (typeof buffer === 'string') {
					// 将字符串重新转换为二进制 Buffer
					const binaryBuffer = Buffer.from(buffer, 'binary');
					// 用 GBK 重新解码为 UTF-8
					return iconv.decode(binaryBuffer, 'gbk');
				} else {
					// 直接解码 Buffer
					return iconv.decode(buffer, 'gbk');
				}
			} catch (error) {
				return buffer.toString('utf8'); // 保底处理
			}
		} else {
			return buffer.toString('utf8');
		}
	};

	return {
		out: decodeBuffer(stdout),
		err: decodeBuffer(stderr)
	};
}