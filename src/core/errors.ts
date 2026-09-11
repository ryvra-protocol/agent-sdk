export interface GatewayErrorMetadata {
  reasonCode?: string;
  intentId?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
  status?: number;
}

export class GatewayError extends Error {
  readonly reasonCode?: string;
  readonly intentId?: string;
  readonly correlationId?: string;
  readonly details?: Record<string, unknown>;
  readonly status?: number;

  constructor(message: string, metadata: GatewayErrorMetadata = {}) {
    super(message);
    this.name = new.target.name;
    this.reasonCode = metadata.reasonCode;
    this.intentId = metadata.intentId;
    this.correlationId = metadata.correlationId;
    this.details = metadata.details;
    this.status = metadata.status;
  }
}

export class AuthenticationError extends GatewayError {}
export class AuthorizationError extends GatewayError {}
export class PolicyDeniedError extends GatewayError {}
export class RiskDeniedError extends GatewayError {}
export class CapabilityMismatchError extends GatewayError {}
export class RateLimitError extends GatewayError {}
export class ReplayDetectedError extends GatewayError {}
export class ValidationError extends GatewayError {}
export class GatewayUnavailableError extends GatewayError {}
