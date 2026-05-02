export const Channel = {
  Control: "control",
  Terminal: "terminal",
  File: "file",
  Desktop: "desktop"
} as const;

export type ChannelName = (typeof Channel)[keyof typeof Channel];
