import {
	CreateOptions,
	DownloadOptions as FileDownloadOptions,
	EditOptions,
	ListOptions,
	ReadOptions,
	RenameOptions,
	SearchOptions as FileSearchOptions
} from '@operation/File/type';

export type FileCommand = { type: 'file' } & (
  {
    cmd: 'read';
  } & ReadOptions |
  {
    cmd: 'create';
  } & CreateOptions |
  {
    cmd: 'list';
  } & ListOptions |
  {
    cmd: 'search';
  } & FileSearchOptions |
  {
    cmd: 'edit';
  } & EditOptions |
  {
    cmd: 'download';
  } & FileDownloadOptions |
  {
    cmd: 'rename'
  } & RenameOptions);
