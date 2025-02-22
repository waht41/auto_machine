import { getPage } from './common';
import { OpenOptions, BrowserResult } from './type';

export async function open(options: OpenOptions): Promise<BrowserResult> {
    const page = await getPage({url: options.url, userDataDir: options.userDataDir});
    return {success: true, page};
}
