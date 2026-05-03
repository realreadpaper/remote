export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface RateLimitBucket {
  windowStartedAt: number;
  count: number;
}

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing && now - existing.windowStartedAt <= this.windowMs
        ? existing
        : { windowStartedAt: now, count: 0 };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count <= this.maxRequests) {
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(0, bucket.windowStartedAt + this.windowMs - now)
    };
  }
}

export class MemoryWeightedRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.now = options.now ?? Date.now;
  }

  check(key: string, weight: number): RateLimitResult {
    const now = this.now();
    const normalizedWeight = Math.max(1, Math.floor(weight));
    const existing = this.buckets.get(key);
    const bucket =
      existing && now - existing.windowStartedAt <= this.windowMs
        ? existing
        : { windowStartedAt: now, count: 0 };

    if (bucket.count + normalizedWeight > this.maxRequests) {
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        retryAfterMs: Math.max(0, bucket.windowStartedAt + this.windowMs - now)
      };
    }

    bucket.count += normalizedWeight;
    this.buckets.set(key, bucket);
    return { allowed: true, retryAfterMs: 0 };
  }
}
