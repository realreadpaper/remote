import { z } from "zod";

const message = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const ClientMessageSchema = z.discriminatedUnion("type", [
  message({
    type: z.literal("device.register"),
    deviceId: z.string().min(1),
    deviceName: z.string().min(1),
    capabilities: z.array(z.enum(["terminal", "file", "desktop"]))
  }),
  message({
    type: z.literal("session.open"),
    deviceId: z.string().min(1)
  }),
  message({
    type: z.literal("terminal.input"),
    sessionId: z.string().min(1),
    data: z.string()
  }),
  message({
    type: z.literal("terminal.resize"),
    sessionId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
  }),
  message({
    type: z.literal("terminal.close"),
    sessionId: z.string().min(1)
  })
]);

export const ServerMessageSchema = z.discriminatedUnion("type", [
  message({
    type: z.literal("device.registered"),
    deviceId: z.string().min(1)
  }),
  message({
    type: z.literal("session.opened"),
    sessionId: z.string().min(1),
    deviceId: z.string().min(1)
  }),
  message({
    type: z.literal("session.error"),
    sessionId: z.string().optional(),
    code: z.string().min(1),
    message: z.string().min(1)
  }),
  message({
    type: z.literal("terminal.output"),
    sessionId: z.string().min(1),
    stream: z.enum(["stdout", "stderr"]),
    data: z.string()
  }),
  message({
    type: z.literal("terminal.exit"),
    sessionId: z.string().min(1),
    exitCode: z.number().int().nullable()
  })
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(input: unknown): ClientMessage {
  return ClientMessageSchema.parse(input);
}

export function parseServerMessage(input: unknown): ServerMessage {
  return ServerMessageSchema.parse(input);
}

export function encodeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}
