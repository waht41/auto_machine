import path from 'path';
import { app } from 'electron';
import os from 'os';

export const getResourcePath = () => {
	if (app.isPackaged) {
		return process.resourcesPath;
	} else {
		return path.join(app.getAppPath(), 'resources');
	}
};

export const getPublicPath = () => {
	if (process.env.NODE_ENV === 'development') {
		return path.join(process.cwd(), 'public');
	}
	return path.join(getResourcePath(), 'public');
};

export const getIcon = () => {
	if (os.platform() === 'darwin') {
		return path.join(getPublicPath(), 'Roo.icns');
	}
	console.log('[waht]', 'public path', getPublicPath());
	return path.join(getPublicPath(), 'Roo64.ico');
};