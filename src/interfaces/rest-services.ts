
import { UserRecord } from "./db-records";
import { SignedObject } from "./signed-object";

export interface RestRequest<T extends Signable> {
  sessionId: string;
  version: number;
  details: string;
  detailsObject?: T;
  signature: string;
}

export interface RestResponse {
  serverVersion: number;
}

export interface RegisterUserDetails extends Signable {
  publicKey: string;
  referrer: string;
  landingUrl: string;
  userAgent: string;
}

export interface Signable {
  address: string;
  fingerprint: string;
  timestamp: number;
}

export interface RegisterUserResponse extends RestResponse {
  sessionId: string;
  id: string;
  admin: boolean;
}

export interface CodeAndName {
  code: string;
  name: string;
}
