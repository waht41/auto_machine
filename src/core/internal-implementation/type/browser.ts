import {
	AnalyzeOptions,
	AuthOptions,
	DownloadOptions as BrowserDownloadOptions,
	InteractOptions,
	NavigateOptions,
	OpenOptions,
	SearchOptions as BrowserSearchOptions
} from '@operation/Browser';

export type BrowserCommand = { type: 'browser' } & (
  {
    cmd: 'open';
  } & OpenOptions |
  {
    cmd: 'search';
  } & BrowserSearchOptions |
  {
    cmd: 'state';
  } |
  {
    cmd: 'analyze';
  } & AnalyzeOptions |
  {
    cmd: 'navigation';
  } & NavigateOptions |
  {
    cmd: 'interact';
  } & InteractOptions |
  {
    cmd: 'auth';
  } & AuthOptions |
  {
    cmd: 'download';
  } & BrowserDownloadOptions
  );
