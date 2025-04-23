export type CoderCommand = { type: 'coder' } & (
  {
    cmd: 'cmd';
    content: string;
  } |
  {
    cmd: 'node';
    content: string;
  }
);
