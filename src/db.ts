import { MongoClient, Db, Collection, Cursor, MongoClientOptions, AggregationCursor } from "mongodb";
import * as uuid from "uuid";

import { Request, Response } from 'express';
import { configuration } from "./configuration";
import { SERVER_VERSION } from "./server-version";
import { errorManager } from "./error-manager";
import { UserRecord, IpAddressRecord, IpAddressStatus, UserRegistrationRecord, UserAccountType } from "./interfaces/db-records";

export class Database {
  private db: Db;
  private users: Collection;
  private ipAddresses: Collection;
  private userRegistrations: Collection;


  async initialize(): Promise<void> {
    const configOptions = configuration.get('mongo.options') as MongoClientOptions;
    const options: MongoClientOptions = configOptions ? configOptions : { w: 1 };
    const client = await MongoClient.connect(configuration.get('mongo.mongoUrl'), options);
    this.db = client.db();
    await this.initializeUsers();
    await this.initializeIpAddresses();
    await this.initializeUserRegistrations();
  }

  private async initializeUsers(): Promise<void> {
    this.users = this.db.collection('users');
    await this.users.createIndex({ id: 1 }, { unique: true });
    await this.users.createIndex({ address: 1 }, { unique: true });
    await this.users.createIndex({ "identity.handle": 1 }, { unique: true, sparse: true });
    await this.users.createIndex({ "identity.emailAddress": 1 }, { unique: true, sparse: true });
    await this.users.createIndex({ type: 1, lastContact: -1 });
    await this.users.createIndex({ recoveryCode: 1 }, { unique: true, sparse: true });
    await this.users.createIndex({ ipAddresses: 1, added: -1 });
    await this.users.createIndex({ added: -1 });
    await this.users.createIndex({ "identity.emailConfirmationCode": 1 });
  }

  private async initializeIpAddresses(): Promise<void> {
    this.ipAddresses = this.db.collection('ipAddresses');
    await this.ipAddresses.createIndex({ ipAddress: 1 }, { unique: true });
    await this.ipAddresses.createIndex({ countryCode: 1, region: 1 });
  }

  private async initializeUserRegistrations(): Promise<void> {
    this.userRegistrations = this.db.collection('userRegistrations');
    await this.userRegistrations.createIndex({ userId: 1, at: -1 });
    await this.userRegistrations.createIndex({ userId: 1, ipAddress: 1, fingerprint: 1 });
    await this.userRegistrations.createIndex({ mobile: 1, userId: 1, fingerprint: 1 });
    await this.userRegistrations.createIndex({ sessionId: 1 }, { unique: true, sparse: true });
  }

  async findUserById(id: string): Promise<UserRecord> {
    return this.users.findOne<UserRecord>({ id: id });
  }

  async findUserByAddress(address: string): Promise<UserRecord> {
    return this.users.findOne<UserRecord>({ address: address });
  }

  async findUserByHistoricalAddress(address: string): Promise<UserRecord> {
    return this.users.findOne<UserRecord>({ "addressHistory.address": address });
  }

  async findUserByRecoveryCode(code: string): Promise<UserRecord> {
    return this.users.findOne<UserRecord>({ recoveryCode: code });
  }

  async findUserByHandle(handle: string): Promise<UserRecord> {
    return this.users.findOne<UserRecord>({ "identity.handle": handle.toLowerCase() });
  }

  async findUserByEmail(emailAddress: string): Promise<UserRecord> {
    return this.users.findOne<UserRecord>({ "identity.emailAddress": emailAddress.toLowerCase() });
  }

  async addUserIpAddress(userRecord: UserRecord, ipAddress: string, country: string, region: string, city: string, zip: string): Promise<void> {
    const update: any = { $push: { ipAddresses: ipAddress } };
    if (country || region || city || zip) {
      const setPart: any = {};
      setPart.country = country;
      setPart.region = region;
      setPart.city = city;
      setPart.zip = zip;
      update.$set = setPart;
    }
    await this.users.updateOne({ id: userRecord.id }, update);
    userRecord.ipAddresses.push(ipAddress);
  }

  async updateUserGeo(userId: string, country: string, region: string, city: string, zip: string): Promise<void> {
    await this.users.updateOne({ id: userId }, {
      $set: {
        country: country,
        region: region,
        city: city,
        zip: zip
      }
    });
  }

  async insertUser(type: UserAccountType, address: string, publicKey: string, encryptedPrivateKey: string, ipAddress: string, country: string, region: string, city: string, zip: string, referrer: string, landingPage: string): Promise<UserRecord> {
    const now = Date.now();
    const record: UserRecord = {
      id: uuid.v4(),
      type: type,
      status: "active",
      address: address,
      publicKey: publicKey,
      addressHistory: [
        { address: address, publicKey: publicKey, added: now }
      ],
      encryptedPrivateKey: encryptedPrivateKey,
      added: now,
      balance: 0,
      lastContact: now,
      admin: false,
      ipAddresses: [],
      originalReferrer: referrer,
      originalLandingPage: landingPage,
    };
    if (ipAddress) {
      record.ipAddresses.push(ipAddress);
    }
    if (country || region || city || zip) {
      record.country = country;
      record.region = region;
      record.city = city;
      record.zip = zip;
    }
    await this.users.insert(record);
    return record;
  }

  async discardUserIpAddress(userRecord: UserRecord, ipAddress: string): Promise<void> {
    await this.users.updateOne({ id: userRecord.id }, { $pull: { ipAddresses: ipAddress } });
    userRecord.ipAddresses.splice(userRecord.ipAddresses.indexOf(ipAddress), 1);
  }

  async updateLastUserContact(userRecord: UserRecord, lastContact: number): Promise<void> {
    await this.users.updateOne({ id: userRecord.id }, { $set: { lastContact: lastContact } });
    userRecord.lastContact = lastContact;
  }

  async deleteUser(id: string): Promise<void> {
    await this.users.deleteOne({ id: id });
  }

  async insertIpAddress(ipAddress: string, status: IpAddressStatus, country: string, countryCode: string, region: string, regionName: string, city: string, zip: string, lat: number, lon: number, timezone: string, isp: string, org: string, as: string, query: string, message: string): Promise<IpAddressRecord> {
    const now = Date.now();
    const record: IpAddressRecord = {
      ipAddress: ipAddress.toLowerCase(),
      created: now,
      lastUpdated: now,
      status: status,
      country: country,
      countryCode: countryCode,
      region: region,
      regionName: regionName,
      city: city,
      zip: zip,
      lat: lat,
      lon: lon,
      timezone: timezone,
      isp: isp,
      org: org,
      as: as,
      query: query,
      message: message
    };
    try {
      await this.ipAddresses.insertOne(record);
    } catch (err) {
      await this.ipAddresses.findOne<IpAddressRecord>({ ipAddress: ipAddress.toLowerCase() });
    }
    return record;
  }

  async findIpAddress(ipAddress: string): Promise<IpAddressRecord> {
    return this.ipAddresses.findOne<IpAddressRecord>({ ipAddress: ipAddress.toLowerCase() });
  }

  async findIpAddressCountryCode(countryCode: string): Promise<IpAddressRecord> {
    const records = await this.ipAddresses.find<IpAddressRecord>({ countryCode: countryCode }).sort({ created: -1 }).limit(1).toArray();
    return records.length > 0 ? records[0] : null;
  }

  async findIpAddressRegionCode(countryCode: string, regionCode: string): Promise<IpAddressRecord> {
    const records = await this.ipAddresses.find<IpAddressRecord>({ countryCode: countryCode, region: regionCode }).sort({ created: -1 }).limit(1).toArray();
    return records.length > 0 ? records[0] : null;
  }

  async findIpAddressDistinctRegions(countryCode: string): Promise<string> {
    return this.ipAddresses.distinct("region", { countryCode: countryCode });
  }

  async updateIpAddress(ipAddress: string, status: IpAddressStatus, country: string, countryCode: string, region: string, regionName: string, city: string, zip: string, lat: number, lon: number, timezone: string, isp: string, org: string, as: string, query: string, message: string): Promise<IpAddressRecord> {
    const now = Date.now();
    const update: any = {
      ipAddress: ipAddress.toLowerCase(),
      lastUpdated: now,
      status: status
    };
    if (country) {
      update.country = country;
    }
    if (countryCode) {
      update.countryCode = countryCode;
    }
    if (region) {
      update.region = region;
    }
    if (regionName) {
      update.regionName = regionName;
    }
    if (city) {
      update.city = city;
    }
    if (zip) {
      update.zip = zip;
    }
    if (lat) {
      update.lat = lat;
    }
    if (lon) {
      update.lon = lon;
    }
    if (timezone) {
      update.timezone = timezone;
    }
    if (isp) {
      update.isp = isp;
    }
    if (org) {
      update.org = org;
    }
    if (as) {
      update.as = as;
    }
    if (query) {
      update.query = query;
    }
    if (message) {
      update.message = message;
    }
    await this.ipAddresses.update({ ipAddress: ipAddress.toLowerCase() }, { $set: update });
    return this.findIpAddress(ipAddress);
  }

  async insertUserRegistration(userId: string, ipAddress: string, fingerprint: string, isMobile: boolean, address: string, referrer: string, landingPage: string, userAgent: string, referringUserId: string): Promise<UserRegistrationRecord> {
    const record: UserRegistrationRecord = {
      sessionId: uuid.v4(),
      userId: userId,
      at: Date.now(),
      ipAddress: ipAddress ? ipAddress.toLowerCase() : null,
      fingerprint: fingerprint,
      isMobile: isMobile,
      address: address,
      referrer: referrer,
      landingPage: landingPage,
      userAgent: userAgent,
      referringUserId: referringUserId
    };
    await this.userRegistrations.insertOne(record);
    return record;
  }

  async existsUserRegistrationByFingerprint(userId: string, fingerprint: string, mobile: boolean, ipAddress: string): Promise<boolean> {
    const query: any = { userId: userId, fingerprint: fingerprint };
    if (mobile) {
      query.ipAddress = ipAddress;
    }
    const record = await this.userRegistrations.find<UserRegistrationRecord>(query).limit(1).toArray();
    return record.length > 0 ? true : false;
  }

  async findUserRegistrationDistinctFingerprints(userId: string): Promise<string[]> {
    return this.userRegistrations.distinct('fingerprint', { mobile: false, userId: userId, fingerprint: { $ne: null } });
  }

  async findUserIdsByFingerprint(fingerprints: string[]): Promise<string[]> {
    return this.userRegistrations.distinct('userId', { fingerprint: { $in: fingerprints } });
  }

  async findUserRegistrationBySessionId(sessionId: string): Promise<UserRegistrationRecord> {
    return this.userRegistrations.findOne<UserRegistrationRecord>({ sessionId: sessionId });
  }

  async existsFingerprint(fingerprint: string): Promise<boolean> {
    const existing = await this.userRegistrations.findOne<UserRegistrationRecord>({ fingerprint: fingerprint });
    return existing ? true : false;
  }

  async existsFingerprintAndIpAddress(fingerprint: string, ipAddress: string): Promise<boolean> {
    const existing = await this.userRegistrations.findOne<UserRegistrationRecord>({ fingerprint: fingerprint, ipAddress: ipAddress });
    return existing ? true : false;
  }

  async removeUserRegistrations(userId: string): Promise<void> {
    await this.userRegistrations.deleteMany({ userId: userId });
  }


}

const db = new Database();

export { db };

