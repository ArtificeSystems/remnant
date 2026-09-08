export const PROTOCOL_VERSION = '0.1' as const;

export type RemnantStatus =
  | 'draft'
  | 'partial'
  | 'current'
  | 'superseded'
  | 'rejected';

export type AssumptionBasis =
  | 'user'
  | 'tool'
  | 'remnant'
  | 'external'
  | 'agent'
  | 'unknown';

export interface Assumption {
  statement: string;
  basis: AssumptionBasis;
  ref?: string;
}

export type VerificationResult = 'pass' | 'fail' | 'unknown';

export interface VerificationRecord {
  claim: string;
  method: string;
  result: VerificationResult;
  evidence?: string[];
  asOf?: string;
  doesNotProve?: string[];
}

export type SideEffectStatus = 'planned' | 'attempted' | 'completed' | 'failed';

export interface SideEffect {
  action: string;
  status: SideEffectStatus;
  evidence?: string[];
  asOf?: string;
}

/** Typed attachment. Core does not interpret `type`. A digest is not a truth claim. */
export interface Evidence {
  type: string;
  claim?: string;
  uri?: string;
  digest?: string;
  data?: unknown;
}

export interface OutputBase {
  name?: string;
  description?: string;
}

export interface TextOutput extends OutputBase {
  kind: 'text';
  mediaType?: string;
  text: string;
}

export interface DataOutput extends OutputBase {
  kind: 'data';
  mediaType?: 'application/json' | string;
  data: unknown;
}

export interface FileOutput extends OutputBase {
  kind: 'file';
  path: string;
  mediaType: string;
  sha256?: string;
  size?: number;
}

export interface ReferenceOutput extends OutputBase {
  kind: 'reference';
  uri: string;
  mediaType?: string;
  sha256?: string;
}

export type RemnantOutput =
  | TextOutput
  | DataOutput
  | FileOutput
  | ReferenceOutput;

export interface Remnant {
  protocolVersion: '0.1';
  id: string;
  createdAt: string;
  asOf: string;
  producer: string;
  goal: string;
  status: RemnantStatus;
  outputs: RemnantOutput[];
  assumptions: Assumption[];
  unknowns: string[];
  verification: VerificationRecord[];
  stop: string[];
  supersedes?: string[];
  effects?: SideEffect[];
  evidence?: Evidence[];
  nextAction?: string | null;
  extensions?: Record<string, unknown>;
}

export type RemnantOutputInput = RemnantOutput;

export type CreateRemnantInput = {
  id?: string;
  createdAt?: string;
  asOf?: string;
  producer: string;
  goal: string;
  status?: RemnantStatus;
  outputs: RemnantOutputInput[];
  assumptions?: Array<string | Assumption>;
  unknowns?: string[];
  verification?: VerificationRecord[];
  stop?: string[];
  supersedes?: string[];
  effects?: SideEffect[];
  evidence?: Evidence[];
  nextAction?: string | null;
  extensions?: Record<string, unknown>;
};

export type CreateRemnantOptions = {
  now?: Date;
  fileRoot?: string;
};
