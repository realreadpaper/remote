import { z } from "zod";

const message = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const capability = z.enum(["terminal", "file", "desktop"]);
const platform = z.enum(["macos", "windows", "linux"]);

export const ClientMessageSchema = z.discriminatedUnion("type", [
  message({
    type: z.literal("device.register"),
    deviceId: z.string().min(1),
    deviceName: z.string().min(1),
    capabilities: z.array(capability)
  }),
  message({
    type: z.literal("session.open"),
    deviceId: z.string().min(1),
    sessionToken: z.string().min(1).optional()
  }),
  message({
    type: z.literal("pairing.create"),
    deviceId: z.string().min(1)
  }),
  message({
    type: z.literal("pairing.approved"),
    pairingRequestId: z.string().min(1),
    deviceId: z.string().min(1)
  }),
  message({
    type: z.literal("pairing.rejected"),
    pairingRequestId: z.string().min(1),
    deviceId: z.string().min(1),
    reason: z.string().min(1)
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
  }),
  message({
    type: z.literal("terminal.snapshot.request"),
    sessionId: z.string().min(1)
  })
]);

export const ServerMessageSchema = z.discriminatedUnion("type", [
  message({
    type: z.literal("device.registered"),
    deviceId: z.string().min(1)
  }),
  message({
    type: z.literal("device.status"),
    deviceId: z.string().min(1),
    deviceName: z.string().min(1),
    platform,
    capabilities: z.array(capability),
    online: z.boolean(),
    lastSeenAt: z.string().min(1)
  }),
  message({
    type: z.literal("pairing.created"),
    deviceId: z.string().min(1),
    pairingCode: z.string().min(1),
    expiresAt: z.string().min(1),
    serverUrl: z.string().min(1),
    deviceName: z.string().min(1)
  }),
  message({
    type: z.literal("pairing.requested"),
    pairingRequestId: z.string().min(1),
    deviceId: z.string().min(1),
    mobileClientId: z.string().min(1),
    mobileName: z.string().min(1),
    requestedAt: z.string().min(1)
  }),
  message({
    type: z.literal("auth.sessionToken"),
    sessionId: z.string().min(1),
    deviceId: z.string().min(1),
    sessionToken: z.string().min(1),
    expiresAt: z.string().min(1)
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
  }),
  message({
    type: z.literal("terminal.snapshot"),
    sessionId: z.string().min(1),
    deviceId: z.string().min(1),
    output: z.array(z.string()),
    alive: z.boolean(),
    exitCode: z.number().int().nullable(),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
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
