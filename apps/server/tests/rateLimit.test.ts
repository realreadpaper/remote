import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "../src/rateLimit.js";

describe("MemoryRateLimiter", () => {
  it("allows requests until the window limit is exceeded", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, maxRequests: 2, now: () => now });

    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: false, retryAfterMs: 10_000 });

    now = 5_000;
    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: false, retryAfterMs: 6_000 });
  });

  it("resets a key after the window expires", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, maxRequests: 1, now: () => now });

    expect(limiter.check("pairing.status:127.0.0.1").allowed).toBe(true);
    expect(limiter.check("pairing.status:127.0.0.1").allowed).toBe(false);

    now = 11_001;
    expect(limiter.check("pairing.status:127.0.0.1")).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("tracks different keys independently", () => {
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, maxRequests: 1, now: () => 1_000 });

    expect(limiter.check("pairing.request:127.0.0.1").allowed).toBe(true);
    expect(limiter.check("pairing.request:127.0.0.1").allowed).toBe(false);
    expect(limiter.check("pairing.request:127.0.0.2").allowed).toBe(true);
  });
});
