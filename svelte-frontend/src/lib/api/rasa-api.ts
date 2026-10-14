import type { AvailabilityResponse, HttpError, RasaContext, RasaRequestOptions, RasaResponse } from "#lib";

const DEFAULT_TIMEOUT = 15_000;
const AVAILABILITY_TIMEOUT = 3_000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1_000;
const AVAILABILITY_CHECK_INTERVAL = 30_000;
const CONNECTION_FAILURE_COOLDOWN = 5_000;



export class RasaAPI {
  private readonly baseUrl = '/api/send_message';
  private readonly maxRetries = MAX_RETRIES;
  private readonly retryDelay = RETRY_DELAY;
  private readonly defaultTimeout = DEFAULT_TIMEOUT;

  private readonly pendingRequests = new Map<
    string,
    Promise<RasaResponse>
  >();

  private isConnected = true;
  private lastCheckTime = 0;
  private connectionCheckInterval: ReturnType<typeof setInterval> | null =
    null;
  private destroyed = false;

  constructor() {
    this.startAvailabilityChecks();
  }

  /**
   * Send a message to Rasa.
   *
   * Identical concurrent requests share a promise. Requests that have
   * completed are not cached.
   */
  async sendMessage(
    message: string,
    context: RasaContext = {},
    options: RasaRequestOptions = {}
  ): Promise<RasaResponse> {
    if (typeof message !== 'string' || !message.trim()) {
      throw new TypeError('Message must be a non-empty string.');
    }

    if (
      !this.isConnected &&
      Date.now() - this.lastCheckTime < CONNECTION_FAILURE_COOLDOWN
    ) {
      return this.createErrorResponse(
        'Server connection issue',
        "I'm sorry, I'm having trouble connecting to my backend service. Please try again in a few moments.",
        context
      );
    }

    const requestId = this.generateRequestId(message, context);
    const pendingRequest = this.pendingRequests.get(requestId);

    if (pendingRequest) {
      return pendingRequest;
    }

    const requestPromise = this.executeRequest(message, context, options);
    this.pendingRequests.set(requestId, requestPromise);

    try {
      return await requestPromise;
    } finally {
      if (this.pendingRequests.get(requestId) === requestPromise) {
        this.pendingRequests.delete(requestId);
      }
    }
  }

  /**
   * Execute the request with timeout and limited retries.
   *
   * A POST is retried only when fetch fails before returning an HTTP
   * response. An HTTP error response is not retried because the server
   * may already have processed the message.
   */
  async executeRequest(
    message: string,
    context: RasaContext = {},
    options: RasaRequestOptions = {}
  ): Promise<RasaResponse> {
    const timeout = options.timeout ?? this.defaultTimeout;
    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= this.maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const startTime = Date.now();

      try {
        console.info(
          `Sending request to Rasa: ${message.slice(0, 30)}${message.length > 30 ? '...' : ''}`
        );

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message, context }),
          signal: controller.signal
        });

        if (!response.ok) {
          const error: HttpError = Object.assign(
            new Error(
              `Server responded with ${response.status}: ${response.statusText}`
            ),
            { status: response.status }
          );

          throw error;
        }

        const data: RasaResponse = await response.json();

        this.isConnected = true;
        this.lastCheckTime = Date.now();

        console.info(
          `Rasa request completed in ${Date.now() - startTime}ms`
        );

        return data;
      } catch (error: unknown) {
        lastError = toError(error);

        // HTTP responses indicate that the backend was reachable.
        const status = getHttpStatus(error);

        if (status !== undefined) {
          this.isConnected = true;
          this.lastCheckTime = Date.now();

          // Do not retry an HTTP failure.
          break;
        }

        this.isConnected = false;
        this.lastCheckTime = Date.now();

        // Timeouts and network failures may be transient. Retrying a POST
        // can still duplicate processing if the server received it first.
        const retryable =
          error instanceof Error &&
          (error.name === 'AbortError' || error instanceof TypeError);

        if (!retryable || retries >= this.maxRetries) {
          break;
        }

        retries++;

        console.warn(
          `Attempt ${retries} failed: ${lastError.message}. Retrying...`
        );

        await new Promise<void>((resolve) =>
          setTimeout(resolve, this.retryDelay)
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    console.error('Rasa request failed:', lastError);

    return this.createErrorResponse(
      lastError?.message ?? 'Unknown request error',
      "I'm sorry, I encountered a problem communicating with my backend. Please try again later.",
      context
    );
  }

  /**
   * Create a standardized error response.
   */
  private createErrorResponse(
    errorMessage: string,
    userMessage: string,
    context: RasaContext
  ): RasaResponse {
    return {
      error: errorMessage,
      messages: [{ text: userMessage }],
      context
    };
  }

  /**
   * Create a stable key for concurrent duplicate detection.
   */
  private generateRequestId(
    message: string,
    context: RasaContext
  ): string {
    return JSON.stringify([message, context]);
  }

  /**
   * Check whether the Rasa backend is available.
   */
  async checkAvailability(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      AVAILABILITY_TIMEOUT
    );

    try {
      const response = await fetch('/api/check_rasa', {
        signal: controller.signal
      });

      const data: AvailabilityResponse | null = response.ok
        ? await response.json()
        : null;

      const wasConnected = this.isConnected;

      this.isConnected =
        response.ok && data?.status === 'available';
      this.lastCheckTime = Date.now();

      if (wasConnected !== this.isConnected) {
        console.info(
          this.isConnected
            ? 'Rasa server connection restored'
            : 'Rasa server connection lost'
        );
      }

      return this.isConnected;
    } catch (error: unknown) {
      this.isConnected = false;
      this.lastCheckTime = Date.now();

      console.warn('Error checking Rasa availability:', error);

      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Start periodic availability checks.
   */
  startAvailabilityChecks(): void {
    if (this.connectionCheckInterval !== null || this.destroyed) {
      return;
    }

    void this.checkAvailability();

    this.connectionCheckInterval = setInterval(
      () => void this.checkAvailability(),
      AVAILABILITY_CHECK_INTERVAL
    );
  }

  /**
   * Stop periodic checks and release resources.
   */
  destroy(): void {
    if (this.connectionCheckInterval !== null) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    this.destroyed = true;
  }
}

/**
 * Convert an unknown thrown value into an Error.
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/**
 * Read an HTTP status from an unknown thrown value, if available.
 */
function getHttpStatus(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }

  return undefined;
}

/**
 * Shared API instance for the frontend.
 */
export const rasaAPI = new RasaAPI();
