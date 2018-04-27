
import { Signable } from "./rest-services";
import { SignedObject } from "./signed-object";

export interface UserRecord {
  id: string;
  added: number;
  status: UserStatus;
  type: UserAccountType;
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
  addressHistory: UserAddressHistory[];
  balance: number;
  lastContact: number;
  identity?: UserIdentity;
  admin: boolean;
  recoveryCode?: string;
  recoveryCodeExpires?: number;
  ipAddresses: string[];
  country?: string;
  region?: string;
  city?: string;
  zip?: string;
  originalReferrer: string;
  originalLandingPage: string;
}

export type UserStatus = "active" | "deleted";

export interface UserAddressHistory {
  address: string;
  publicKey: string;
  added: number;
}

export type UserAccountType = "normal" | "network";

export interface UserIdentity {
  name: string;
  handle: string;
  imageId: string;
  location: string;
  emailAddress: string;
  emailConfirmed: boolean;
  emailConfirmationCode: string;
  emailLastConfirmed: number;
}

export interface IpAddressRecord {
  ipAddress: string;
  created: number;
  lastUpdated: number;

  status: IpAddressStatus;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  "as": string;
  query: string;
  message: string;
}

export type IpAddressStatus = "success" | "fail";

export interface GeoLocation {
  fingerprint: string;
  ipAddress: string;
  continentCode: string;
  countryCode: string;
  regionCode: string;
  city: string;
  zipCode: string;
  lat: number;
  lon: number;
}

export interface UserRegistrationRecord {
  sessionId: string;
  userId: string;
  at: number;
  ipAddress: string;
  fingerprint: string;
  isMobile: boolean;
  address: string;
  referrer: string;
  landingPage: string;
  userAgent: string;
  referringUserId: string;
}
