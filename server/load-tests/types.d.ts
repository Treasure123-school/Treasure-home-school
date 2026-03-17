declare module 'autocannon' {
  interface AutocannonOptions {
    url: string;
    connections?: number;
    duration?: number;
    pipelining?: number;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  }

  interface AutocannonResult {
    requests: {
      total: number;
      average: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      p99: number;
    };
    latency: {
      average: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: {
      average: number;
      total: number;
    };
    errors: number;
    timeouts: number;
    '2xx': number;
    '4xx': number;
    '5xx': number;
  }

  interface AutocannonInstance {
    on(event: string, callback: Function): void;
  }

  function autocannon(
    options: AutocannonOptions,
    callback: (err: Error | null, result: AutocannonResult) => void
  ): AutocannonInstance;

  namespace autocannon {
    function track(instance: AutocannonInstance, options?: { renderProgressBar?: boolean }): void;
  }

  export = autocannon;
}
