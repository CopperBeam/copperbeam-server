import * as express from "express";
// tslint:disable-next-line:no-duplicate-imports
import { Request, Response } from 'express';
import * as net from 'net';
import { configuration } from "./configuration";
import { RestServer } from './interfaces/rest-server';
import { RestRequest, RegisterUserDetails, Signable, CodeAndName, RegisterUserResponse, } from "./interfaces/rest-services";
import { db } from "./db";
import { UserRecord, IpAddressRecord, IpAddressStatus, GeoLocation } from "./interfaces/db-records";
// import * as NodeRSA from "node-rsa";
import { UrlManager } from "./url-manager";
import { KeyUtils, KeyInfo } from "./key-utils";
import { RestHelper } from "./rest-helper";
import { Initializable } from "./interfaces/initializable";
import { SERVER_VERSION } from "./server-version";
import * as uuid from "uuid";
import { Utils } from "./utils";
import fetch from "node-fetch";
import * as LRU from 'lru-cache';
import { errorManager } from "./error-manager";

const LETTERS = 'abcdefghjklmnpqrstuvwxyz';
const DIGITS = '0123456789';
const URL_SYMBOLS = '-._~';
const CODE_SYMBOLS = LETTERS + LETTERS.toUpperCase() + DIGITS + URL_SYMBOLS;
const NON_ZERO_DIGITS = '123456789';
const RECOVERY_CODE_LIFETIME = 1000 * 60 * 10;
const MAX_USER_IP_ADDRESSES = 64;

const MAX_IP_ADDRESS_LIFETIME = 1000 * 60 * 60 * 24 * 30;
const IP_ADDRESS_FAIL_RETRY_INTERVAL = 1000 * 60 * 60 * 24;

const continentNameByContinentCode: { [continentCode: string]: string } = {
  "AF": "Africa",
  "AS": "Asia",
  "EU": "Europe",
  "OC": "Oceania",
  "NA": "North America",
  "SA": "South America"
};

const infoByCountryCode: { [countryCode: string]: CountryInfo } = {
  "AD": { continentCode: "EU", name: "Andorra" },
  "AE": { continentCode: "AS", name: "United Arab Emirates" },
  "AF": { continentCode: "AS", name: "Afghanistan" },
  "AG": { continentCode: "NA", name: "Antigua and Barbuda" },
  "AI": { continentCode: "NA", name: "Anguilla" },
  "AL": { continentCode: "EU", name: "Albania" },
  "AM": { continentCode: "EU", name: "Armenia" },
  "AO": { continentCode: "AF", name: "Angola" },
  "AR": { continentCode: "SA", name: "Argentina" },
  "AS": { continentCode: "OC", name: "American Samoa" },
  "AT": { continentCode: "EU", name: "Austria" },
  "AU": { continentCode: "OC", name: "Australia" },
  "AW": { continentCode: "NA", name: "Aruba" },
  "AX": { continentCode: "EU", name: "Åland Islands" },
  "AZ": { continentCode: "EU", name: "Azerbaijan" },
  "BA": { continentCode: "EU", name: "Bosnia and Herzegovina" },
  "BB": { continentCode: "NA", name: "Barbados" },
  "BD": { continentCode: "AS", name: "Bangladesh" },
  "BE": { continentCode: "EU", name: "Belgium" },
  "BF": { continentCode: "AF", name: "Burkina Faso" },
  "BG": { continentCode: "EU", name: "Bulgaria" },
  "BH": { continentCode: "AS", name: "Bahrain" },
  "BI": { continentCode: "AF", name: "Burundi" },
  "BJ": { continentCode: "AF", name: "Benin" },
  "BL": { continentCode: "NA", name: "Saint Barthélemy" },
  "BM": { continentCode: "NA", name: "Bermuda" },
  "BN": { continentCode: "AS", name: "Brunei Darussalam" },
  "BO": { continentCode: "SA", name: "Bolivia (Plurinational State of)" },
  "BQ": { continentCode: "SA", name: "Bonaire, Sint Eustatius and Saba" },
  "BR": { continentCode: "SA", name: "Brazil" },
  "BS": { continentCode: "NA", name: "Bahamas" },
  "BT": { continentCode: "AS", name: "Bhutan" },
  "BW": { continentCode: "AF", name: "Botswana" },
  "BY": { continentCode: "EU", name: "Belarus" },
  "BZ": { continentCode: "NA", name: "Belize" },
  "CA": { continentCode: "NA", name: "Canada" },
  "CC": { continentCode: "AS", name: "Cocos (Keeling) Islands" },
  "CD": { continentCode: "AF", name: "Congo (Democratic Republic of the)" },
  "CF": { continentCode: "AF", name: "Central African Republic" },
  "CG": { continentCode: "AF", name: "Congo" },
  "CH": { continentCode: "EU", name: "Switzerland" },
  "CI": { continentCode: "AF", name: "Côte d'Ivoire" },
  "CK": { continentCode: "OC", name: "Cook Islands" },
  "CL": { continentCode: "SA", name: "Chile" },
  "CM": { continentCode: "AF", name: "Cameroon" },
  "CN": { continentCode: "AS", name: "China" },
  "CO": { continentCode: "SA", name: "Colombia" },
  "CR": { continentCode: "NA", name: "Costa Rica" },
  "CU": { continentCode: "NA", name: "Cuba" },
  "CV": { continentCode: "AF", name: "Cabo Verde" },
  "CW": { continentCode: "NA", name: "Curaçao" },
  "CX": { continentCode: "AS", name: "Christmas Island" },
  "CY": { continentCode: "EU", name: "Cyprus" },
  "CZ": { continentCode: "EU", name: "Czechia" },
  "DE": { continentCode: "EU", name: "Germany" },
  "DJ": { continentCode: "AF", name: "Djibouti" },
  "DK": { continentCode: "EU", name: "Denmark" },
  "DM": { continentCode: "NA", name: "Dominica" },
  "DO": { continentCode: "NA", name: "Dominican Republic" },
  "DZ": { continentCode: "AF", name: "Algeria" },
  "EC": { continentCode: "SA", name: "Ecuador" },
  "EE": { continentCode: "EU", name: "Estonia" },
  "EG": { continentCode: "AF", name: "Egypt" },
  "EH": { continentCode: "AF", name: "Western Sahara" },
  "ER": { continentCode: "AF", name: "Eritrea" },
  "ES": { continentCode: "EU", name: "Spain" },
  "ET": { continentCode: "AF", name: "Ethiopia" },
  "FI": { continentCode: "EU", name: "Finland" },
  "FJ": { continentCode: "OC", name: "Fiji" },
  "FK": { continentCode: "SA", name: "Falkland Islands (Malvinas)" },
  "FM": { continentCode: "OC", name: "Micronesia (Federated States of)" },
  "FO": { continentCode: "EU", name: "Faroe Islands" },
  "FR": { continentCode: "EU", name: "France" },
  "GA": { continentCode: "AF", name: "Gabon" },
  "GB": { continentCode: "EU", name: "United Kingdom of Great Britain and Northern Ireland" },
  "GD": { continentCode: "NA", name: "Grenada" },
  "GE": { continentCode: "AS", name: "Georgia" },
  "GF": { continentCode: "SA", name: "French Guiana" },
  "GG": { continentCode: "EU", name: "Guernsey" },
  "GH": { continentCode: "AF", name: "Ghana" },
  "GI": { continentCode: "EU", name: "Gibraltar" },
  "GL": { continentCode: "NA", name: "Greenland" },
  "GM": { continentCode: "AF", name: "Gambia" },
  "GN": { continentCode: "AF", name: "Guinea" },
  "GP": { continentCode: "NA", name: "Guadeloupe" },
  "GQ": { continentCode: "AF", name: "Equatorial Guinea" },
  "GR": { continentCode: "EU", name: "Greece" },
  "GT": { continentCode: "NA", name: "Guatemala" },
  "GU": { continentCode: "OC", name: "Guam" },
  "GW": { continentCode: "AF", name: "Guinea-Bissau" },
  "GY": { continentCode: "SA", name: "Guyana" },
  "HK": { continentCode: "AS", name: "Hong Kong" },
  "HM": { continentCode: "OC", name: "Heard Island and McDonald Islands" },
  "HN": { continentCode: "NA", name: "Honduras" },
  "HR": { continentCode: "EU", name: "Croatia" },
  "HT": { continentCode: "NA", name: "Haiti" },
  "HU": { continentCode: "EU", name: "Hungary" },
  "ID": { continentCode: "AS", name: "Indonesia" },
  "IE": { continentCode: "EU", name: "Ireland" },
  "IL": { continentCode: "AS", name: "Israel" },
  "IM": { continentCode: "EU", name: "Isle of Man" },
  "IN": { continentCode: "AS", name: "India" },
  "IO": { continentCode: "AS", name: "British Indian Ocean Territory" },
  "IQ": { continentCode: "AS", name: "Iraq" },
  "IR": { continentCode: "AS", name: "Iran (Islamic Republic of)" },
  "IS": { continentCode: "EU", name: "Iceland" },
  "IT": { continentCode: "EU", name: "Italy" },
  "JE": { continentCode: "EU", name: "Jersey" },
  "JM": { continentCode: "NA", name: "Jamaica" },
  "JO": { continentCode: "AS", name: "Jordan" },
  "JP": { continentCode: "AS", name: "Japan" },
  "KE": { continentCode: "AF", name: "Kenya" },
  "KG": { continentCode: "AS", name: "Kyrgyzstan" },
  "KH": { continentCode: "AS", name: "Cambodia" },
  "KI": { continentCode: "OC", name: "Kiribati" },
  "KM": { continentCode: "AF", name: "Comoros" },
  "KN": { continentCode: "NA", name: "Saint Kitts and Nevis" },
  "KP": { continentCode: "AS", name: "Korea (Democratic People's Republic of)" },
  "KR": { continentCode: "AS", name: "Korea (Republic of)" },
  "KW": { continentCode: "AS", name: "Kuwait" },
  "KY": { continentCode: "NA", name: "Cayman Islands" },
  "KZ": { continentCode: "AS", name: "Kazakhstan" },
  "LA": { continentCode: "AS", name: "Lao People's Democratic Republic" },
  "LB": { continentCode: "AS", name: "Lebanon" },
  "LC": { continentCode: "NA", name: "Saint Lucia" },
  "LI": { continentCode: "EU", name: "Liechtenstein" },
  "LK": { continentCode: "AS", name: "Sri Lanka" },
  "LR": { continentCode: "AF", name: "Liberia" },
  "LS": { continentCode: "AF", name: "Lesotho" },
  "LT": { continentCode: "EU", name: "Lithuania" },
  "LU": { continentCode: "EU", name: "Luxembourg" },
  "LV": { continentCode: "EU", name: "Latvia" },
  "LY": { continentCode: "AF", name: "Libya" },
  "MA": { continentCode: "AF", name: "Morocco" },
  "MC": { continentCode: "EU", name: "Monaco" },
  "MD": { continentCode: "EU", name: "Moldova (Republic of)" },
  "ME": { continentCode: "EU", name: "Montenegro" },
  "MF": { continentCode: "NA", name: "Saint Martin (French part)" },
  "MG": { continentCode: "AF", name: "Madagascar" },
  "MH": { continentCode: "OC", name: "Marshall Islands" },
  "MK": { continentCode: "EU", name: "Macedonia (the former Yugoslav Republic of)" },
  "ML": { continentCode: "AF", name: "Mali" },
  "MM": { continentCode: "AS", name: "Myanmar" },
  "MN": { continentCode: "AS", name: "Mongolia" },
  "MO": { continentCode: "AS", name: "Macao" },
  "MP": { continentCode: "OC", name: "Northern Mariana Islands" },
  "MQ": { continentCode: "NA", name: "Martinique" },
  "MR": { continentCode: "AF", name: "Mauritania" },
  "MS": { continentCode: "NA", name: "Montserrat" },
  "MT": { continentCode: "EU", name: "Malta" },
  "MU": { continentCode: "AF", name: "Mauritius" },
  "MV": { continentCode: "AS", name: "Maldives" },
  "MW": { continentCode: "AF", name: "Malawi" },
  "MX": { continentCode: "NA", name: "Mexico" },
  "MY": { continentCode: "AS", name: "Malaysia" },
  "MZ": { continentCode: "AF", name: "Mozambique" },
  "NA": { continentCode: "AF", name: "Namibia" },
  "NC": { continentCode: "OC", name: "New Caledonia" },
  "NE": { continentCode: "AF", name: "Niger" },
  "NF": { continentCode: "OC", name: "Norfolk Island" },
  "NG": { continentCode: "AF", name: "Nigeria" },
  "NI": { continentCode: "NA", name: "Nicaragua" },
  "NL": { continentCode: "EU", name: "Netherlands" },
  "NO": { continentCode: "EU", name: "Norway" },
  "NP": { continentCode: "AS", name: "Nepal" },
  "NR": { continentCode: "OC", name: "Nauru" },
  "NU": { continentCode: "OC", name: "Niue" },
  "NZ": { continentCode: "OC", name: "New Zealand" },
  "OM": { continentCode: "AS", name: "Oman" },
  "PA": { continentCode: "NA", name: "Panama" },
  "PE": { continentCode: "SA", name: "Peru" },
  "PF": { continentCode: "OC", name: "French Polynesia" },
  "PG": { continentCode: "OC", name: "Papua New Guinea" },
  "PH": { continentCode: "OC", name: "Philippines" },
  "PK": { continentCode: "AS", name: "Pakistan" },
  "PL": { continentCode: "EU", name: "Poland" },
  "PM": { continentCode: "NA", name: "Saint Pierre and Miquelon" },
  "PN": { continentCode: "OC", name: "Pitcairn" },
  "PR": { continentCode: "NA", name: "Puerto Rico" },
  "PS": { continentCode: "AS", name: "Palestine, State of" },
  "PT": { continentCode: "EU", name: "Portugal" },
  "PW": { continentCode: "OC", name: "Palau" },
  "PY": { continentCode: "SA", name: "Paraguay" },
  "QA": { continentCode: "AS", name: "Qatar" },
  "RE": { continentCode: "AF", name: "Réunion" },
  "RO": { continentCode: "EU", name: "Romania" },
  "RS": { continentCode: "EU", name: "Serbia" },
  "RU": { continentCode: "AS", name: "Russian Federation" },
  "RW": { continentCode: "AF", name: "Rwanda" },
  "SA": { continentCode: "AS", name: "Saudi Arabia" },
  "SB": { continentCode: "OC", name: "Solomon Islands" },
  "SC": { continentCode: "NA", name: "Seychelles" },
  "SD": { continentCode: "AF", name: "Sudan" },
  "SE": { continentCode: "EU", name: "Sweden" },
  "SG": { continentCode: "AS", name: "Singapore" },
  "SH": { continentCode: "AF", name: "Saint Helena, Ascension and Tristan da Cunha" },
  "SI": { continentCode: "EU", name: "Slovenia" },
  "SJ": { continentCode: "EU", name: "Svalbard and Jan Mayen" },
  "SK": { continentCode: "EU", name: "Slovakia" },
  "SL": { continentCode: "AF", name: "Sierra Leone" },
  "SM": { continentCode: "EU", name: "San Marino" },
  "SN": { continentCode: "AF", name: "Senegal" },
  "SO": { continentCode: "AF", name: "Somalia" },
  "SR": { continentCode: "SA", name: "Suriname" },
  "SS": { continentCode: "AF", name: "South Sudan" },
  "ST": { continentCode: "AF", name: "Sao Tome and Principe" },
  "SV": { continentCode: "NA", name: "El Salvador" },
  "SX": { continentCode: "NA", name: "Sint Maarten (Dutch part)" },
  "SY": { continentCode: "AS", name: "Syrian Arab Republic" },
  "SZ": { continentCode: "AF", name: "Swaziland" },
  "TC": { continentCode: "NA", name: "Turks and Caicos Islands" },
  "TD": { continentCode: "AF", name: "Chad" },
  "TG": { continentCode: "AF", name: "Togo" },
  "TH": { continentCode: "AS", name: "Thailand" },
  "TJ": { continentCode: "AS", name: "Tajikistan" },
  "TK": { continentCode: "OC", name: "Tokelau" },
  "TL": { continentCode: "OC", name: "Timor-Leste" },
  "TM": { continentCode: "AS", name: "Turkmenistan" },
  "TN": { continentCode: "AF", name: "Tunisia" },
  "TO": { continentCode: "AF", name: "Tonga" },
  "TR": { continentCode: "EU", name: "Turkey" },
  "TT": { continentCode: "NA", name: "Trinidad and Tobago" },
  "TV": { continentCode: "OC", name: "Tuvalu" },
  "TW": { continentCode: "AS", name: "Taiwan, Province of China[a]" },
  "TZ": { continentCode: "AF", name: "Tanzania, United Republic of" },
  "UA": { continentCode: "EU", name: "Ukraine" },
  "UG": { continentCode: "AF", name: "Uganda" },
  "UM": { continentCode: "OC", name: "United States Minor Outlying Islands" },
  "US": { continentCode: "NA", name: "United States of America" },
  "UY": { continentCode: "SA", name: "Uruguay" },
  "UZ": { continentCode: "AS", name: "Uzbekistan" },
  "VA": { continentCode: "EU", name: "Holy See" },
  "VC": { continentCode: "NA", name: "Saint Vincent and the Grenadines" },
  "VE": { continentCode: "SA", name: "Venezuela (Bolivarian Republic of)" },
  "VG": { continentCode: "NA", name: "Virgin Islands (British)" },
  "VI": { continentCode: "NA", name: "Virgin Islands (U.S.)" },
  "VN": { continentCode: "AS", name: "Viet Nam" },
  "VU": { continentCode: "OC", name: "Vanuatu" },
  "WF": { continentCode: "OC", name: "Wallis and Futuna" },
  "WS": { continentCode: "OC", name: "Samoa" },
  "XK": { continentCode: "EU", name: "Kosovo" },
  "YE": { continentCode: "AF", name: "Yemen" },
  "YT": { continentCode: "AF", name: "Mayotte" },
  "ZA": { continentCode: "AF", name: "South Africa" },
  "ZM": { continentCode: "AF", name: "Zambia" },
  "ZW": { continentCode: "AF", name: "Zimbabwe" },
};

export class UserManager implements RestServer, Initializable {
  private app: express.Application;
  private urlManager: UrlManager;
  private userCache = LRU<string, UserRecord>({ max: 10000, maxAge: 1000 * 60 * 5 });
  private ipCache = LRU<string, IpAddressRecord>({ max: 10000, maxAge: 1000 * 60 * 60 });

  private countryCache = LRU<string, string>({ max: 10000, maxAge: 1000 * 60 * 60 * 24 });
  private regionCache = LRU<string, string>({ max: 10000, maxAge: 1000 * 60 * 60 * 24 });

  private countryRegionsCache = LRU<string, CodeAndName[]>({ max: 10000, maxAge: 1000 * 60 * 60 * 3 });
  private pollUnderway = false;

  async initialize(urlManager: UrlManager): Promise<void> {
    this.urlManager = urlManager;
  }

  async initializeRestServices(urlManager: UrlManager, app: express.Application): Promise<void> {
    this.app = app;
    this.registerHandlers();
  }

  async initialize2(): Promise<void> {
    setInterval(() => {
      if (this.pollUnderway) {
        errorManager.error("User.poll is already underway.  Skipping cycle...", null);
      } else {
        void this.poll();
      }
    }, 60000);
    await this.poll();
  }

  private async poll(): Promise<void> {

  }

  private registerHandlers(): void {
    this.app.post(this.urlManager.getDynamicUrl('register-user'), (request: Request, response: Response) => {
      void this.handleRegisterUser(request, response);
    });
  }

  async getUser(userId: string, force: boolean): Promise<UserRecord> {
    let result = this.userCache.get(userId);
    if (result && !force) {
      return result;
    }
    result = await db.findUserById(userId);
    if (result) {
      this.userCache.set(userId, result);
    }
    return result;
  }

  async getUserByAddress(address: string): Promise<UserRecord> {
    const result = await db.findUserByAddress(address);
    if (result) {
      this.userCache.set(result.id, result);
    }
    return result;
  }

  async getUserByHandle(handle: string): Promise<UserRecord> {
    const result = await db.findUserByHandle(handle);
    if (result) {
      this.userCache.set(result.id, result);
    }
    return result;
  }

  private async handleRegisterUser(request: Request, response: Response): Promise<void> {
    try {
      const requestBody = request.body as RestRequest<RegisterUserDetails>;
      requestBody.detailsObject = JSON.parse(requestBody.details);
      if (!RestHelper.validateRequest(requestBody, requestBody.detailsObject ? requestBody.detailsObject.publicKey : null, response)) {
        return;
      }
      if (!requestBody.detailsObject.address || !requestBody.detailsObject.publicKey) {
        response.status(400).send("Invalid request-user details");
        return;
      }
      if (KeyUtils.getAddressFromPublicKey(requestBody.detailsObject.publicKey) !== requestBody.detailsObject.address) {
        response.status(400).send("This address is inconsistent with the publicKey provided.");
        return;
      }
      console.log("UserManager.register-user", requestBody.detailsObject.address);
      const ipAddress = this.getIpAddressFromRequest(request);
      let ipAddressInfo: IpAddressRecord;
      if (ipAddress && ipAddress.length > 0) {
        ipAddressInfo = await this.fetchIpAddressInfo(ipAddress, false);
      }
      console.log("UserManager.register-user:", request.headers, ipAddress);
      const isMobile = requestBody.detailsObject.userAgent && requestBody.detailsObject.userAgent.toLowerCase().indexOf('mobi') >= 0;
      let userRecord = await this.getUserByAddress(requestBody.detailsObject.address);
      if (userRecord) {
        if (ipAddress && userRecord.ipAddresses.indexOf(ipAddress) < 0) {
          await db.addUserIpAddress(userRecord, ipAddress, ipAddressInfo ? ipAddressInfo.country : null, ipAddressInfo ? ipAddressInfo.region : null, ipAddressInfo ? ipAddressInfo.city : null, ipAddressInfo ? ipAddressInfo.zip : null);
          if (userRecord.ipAddresses.length > MAX_USER_IP_ADDRESSES) {
            await db.discardUserIpAddress(userRecord, userRecord.ipAddresses[0]);
          }
        } else if (ipAddressInfo && ipAddressInfo.city && ipAddressInfo.city !== userRecord.city) {
          await db.updateUserGeo(userRecord.id, ipAddressInfo.country, ipAddressInfo.region, ipAddressInfo.city, ipAddressInfo.zip);
        }
      } else {
        const historicalUser = await db.findUserByHistoricalAddress(requestBody.detailsObject.address);
        if (historicalUser) {
          response.status(409).send("This address was registered previously and cannot be reused.");
          return;
        }
        userRecord = await db.insertUser("normal", requestBody.detailsObject.address, requestBody.detailsObject.publicKey, null, ipAddress, ipAddressInfo ? ipAddressInfo.country : null, ipAddressInfo ? ipAddressInfo.region : null, ipAddressInfo ? ipAddressInfo.city : null, ipAddressInfo ? ipAddressInfo.zip : null, requestBody.detailsObject.referrer, requestBody.detailsObject.landingUrl);
      }
      let referringUserId: string;
      if (requestBody.detailsObject.landingUrl) {
        try {
          const landingUrl = new URL(requestBody.detailsObject.landingUrl);
          if (!landingUrl.searchParams) {
            console.warn("User.handleRegisterUser:  landingUrl has no searchParams", requestBody.detailsObject.landingUrl);
          }
          const address = landingUrl && landingUrl.searchParams ? landingUrl.searchParams.get('s') : null;
          if (address) {
            let referringUser = await db.findUserByAddress(address);
            if (referringUser) {
              referringUserId = referringUser.id;
            } else {
              referringUser = await db.findUserByHistoricalAddress(address);
              if (referringUser) {
                referringUserId = referringUser.id;
              }
            }
          }
        } catch (err) {
          errorManager.warning("User.handleRegisterUser: failure processing landingUrl", request, requestBody.detailsObject.landingUrl, err);
        }
      }
      const registrationRecord = await db.insertUserRegistration(userRecord.id, ipAddress, requestBody.detailsObject.fingerprint, isMobile, requestBody.detailsObject.address, requestBody.detailsObject.referrer, requestBody.detailsObject.landingUrl, requestBody.detailsObject.userAgent, referringUserId);
      const registerResponse: RegisterUserResponse = {
        sessionId: registrationRecord.sessionId,
        serverVersion: SERVER_VERSION,
        id: userRecord.id,
        admin: userRecord.admin,
      };
      response.json(registerResponse);
    } catch (err) {
      errorManager.error("User.handleRegisterUser: Failure", request, err);
      response.status(err.code ? err.code : 500).send(err.message ? err.message : err);
    }
  }

  getIpAddressFromRequest(request: Request): string {
    if (!request) {
      return null;
    }
    if (configuration.get('ipOverride')) {
      return configuration.get('ipOverride');
    }
    const ipAddressHeader = request.headers['x-forwarded-for'] as string;
    let ipAddress: string;
    if (ipAddressHeader) {
      const ipAddresses = ipAddressHeader.split(',');
      if (ipAddresses.length >= 1 && ipAddresses[0].trim().length > 0) {
        ipAddress = ipAddresses[0].trim();
      }
    } else if (request.ip) {
      ipAddress = request.ip.trim();
    }
    return ipAddress;
  }

  async fetchIpAddressInfo(ipAddress: string, force: boolean): Promise<IpAddressRecord> {
    if (!ipAddress) {
      return null;
    }
    if (ipAddress === "::1" || ipAddress === "localhost" || ipAddress === "127.0.0.1") {
      return null;
    }
    let record = this.ipCache.get(ipAddress);
    if (!force && record) {
      return record;
    }
    record = await db.findIpAddress(ipAddress);
    const lifetime = record && record.status === 'success' ? MAX_IP_ADDRESS_LIFETIME : IP_ADDRESS_FAIL_RETRY_INTERVAL;
    if (record && Date.now() - record.lastUpdated < lifetime) {
      this.ipCache.set(ipAddress, record);
      return record;
    }
    if (configuration.get('ipAddress.geo.enabled')) {
      if (record) {
        // Don't wait for response
        void this.initiateIpAddressUpdate(ipAddress, null);
        this.ipCache.set(ipAddress, record);
        return record;
      } else {
        record = await this.initiateIpAddressUpdate(ipAddress, record);
        this.ipCache.set(ipAddress, record);
        return record;
      }
    }
  }

  private async initiateIpAddressUpdate(ipAddress: string, record: IpAddressRecord): Promise<IpAddressRecord> {
    try {
      console.log("User.fetchIpAddressInfo: Fetching geo location for ip " + ipAddress);
      const fetchResponse = await fetch(configuration.get("ipAddress.geo.urlPrefix") + ipAddress + configuration.get("ipAddress.geo.urlSuffix"));
      if (fetchResponse && fetchResponse.status === 200) {
        const json = await fetchResponse.json() as IpApiResponse;
        if (json.status) {
          console.log("User.initiateIpAddressUpdate", ipAddress, json);
          if (record) {
            return db.updateIpAddress(ipAddress, json.status, json.country, json.countryCode, json.region, json.regionName, json.city, json.zip, json.lat, json.lon, json.timezone, json.isp, json.org, json.as, json.query, json.message);
          } else {
            return db.insertIpAddress(ipAddress, json.status, json.country, json.countryCode, json.region, json.regionName, json.city, json.zip, json.lat, json.lon, json.timezone, json.isp, json.org, json.as, json.query, json.message);
          }
        } else {
          errorManager.warning("User.initiateIpAddressUpdate: invalid response from ipapi", null, json);
        }
      } else {
        errorManager.warning("User.initiateIpAddressUpdate: unexpected response from ipapi", null, fetchResponse);
      }
    } catch (err) {
      errorManager.warning("User.initiateIpAddressUpdate: failure fetching IP geo info", null, err);
    }
    return null;
  }


}

const BAD_WORDS: string[] = ["4r5e",
  "a55",
  "anal",
  "anus",
  "ar5e",
  "arrse",
  "arse",
  "ass",
  "ass_fucker",
  "asses",
  "assfucker",
  "assfukka",
  "asshole",
  "assholes",
  "asswhole",
  "a_s_s",
  "b1tch",
  "ballbag",
  "balls",
  "ballsack",
  "bastard",
  "beastial",
  "beastiality",
  "bellend",
  "bestial",
  "bestiality",
  "biatch",
  "bitch",
  "bitcher",
  "bitchers",
  "bitches",
  "bitchin",
  "bitching",
  "bloody",
  "blow job",
  "blowjob",
  "blowjobs",
  "boiolas",
  "bollock",
  "bollok",
  "boner",
  "boob",
  "boobs",
  "booobs",
  "boooobs",
  "booooobs",
  "booooooobs",
  "breasts",
  "buceta",
  "bugger",
  "bum",
  "bunny fucker",
  "butt",
  "butthole",
  "buttmuch",
  "buttplug",
  "carpet muncher",
  "cawk",
  "chink",
  "cipa",
  "cl1t",
  "clit",
  "clitoris",
  "clits",
  "cnut",
  "cock",
  "cock_sucker",
  "cockface",
  "cockhead",
  "cockmunch",
  "cockmuncher",
  "cocks",
  "cocksuck ",
  "cocksucked ",
  "cocksucker",
  "cocksucking",
  "cocksucks ",
  "cocksuka",
  "cocksukka",
  "cok",
  "cokmuncher",
  "coksucka",
  "coon",
  "cox",
  "crap",
  "cum",
  "cummer",
  "cumming",
  "cums",
  "cumshot",
  "cunilingus",
  "cunillingus",
  "cunnilingus",
  "cunt",
  "cuntlick ",
  "cuntlicker ",
  "cuntlicking ",
  "cunts",
  "cyalis",
  "cyberfuc",
  "cyberfuck ",
  "cyberfucked ",
  "cyberfucker",
  "cyberfuckers",
  "cyberfucking ",
  "d1ck",
  "damn",
  "dick",
  "dickhead",
  "dildo",
  "dildos",
  "dink",
  "dinks",
  "dirsa",
  "dlck",
  "dog_fucker",
  "doggin",
  "dogging",
  "donkeyribber",
  "doosh",
  "duche",
  "dyke",
  "ejaculate",
  "ejaculated",
  "ejaculates ",
  "ejaculating ",
  "ejaculatings",
  "ejaculation",
  "ejakulate",
  "f4nny",
  "fag",
  "fagging",
  "faggitt",
  "faggot",
  "faggs",
  "fagot",
  "fagots",
  "fags",
  "fanny",
  "fannyflaps",
  "fannyfucker",
  "fanyy",
  "fatass",
  "fcuk",
  "fcuker",
  "fcuking",
  "feck",
  "fecker",
  "felching",
  "fellate",
  "fellatio",
  "fingerfuck ",
  "fingerfucked ",
  "fingerfucker ",
  "fingerfuckers",
  "fingerfucking ",
  "fingerfucks ",
  "fistfuck",
  "fistfucked ",
  "fistfucker ",
  "fistfuckers ",
  "fistfucking ",
  "fistfuckings ",
  "fistfucks ",
  "flange",
  "fook",
  "fooker",
  "fuck",
  "fucka",
  "fucked",
  "fucker",
  "fuckers",
  "fuckhead",
  "fuckheads",
  "fuckin",
  "fucking",
  "fuckings",
  "fuckingshitmotherfucker",
  "fuckme ",
  "fucks",
  "fuckwhit",
  "fuckwit",
  "fuckyou",
  "fuck_you",
  "fudge packer",
  "fudgepacker",
  "fuk",
  "fuker",
  "fukker",
  "fukkin",
  "fuks",
  "fukwhit",
  "fukwit",
  "fux",
  "fux0r",
  "f_u_c_k",
  "gangbang",
  "gangbanged ",
  "gangbangs ",
  "gaylord",
  "gaysex",
  "goatse",
  "God",
  "god_dam",
  "god_damned",
  "goddamn",
  "goddamned",
  "hardcoresex ",
  "hell",
  "heshe",
  "hoar",
  "hoare",
  "hoer",
  "homo",
  "hore",
  "horniest",
  "horny",
  "hotsex",
  "jack_off ",
  "jackoff",
  "jap",
  "jerk_off ",
  "jism",
  "jiz ",
  "jizm ",
  "jizz",
  "kawk",
  "knob",
  "knobead",
  "knobed",
  "knobend",
  "knobhead",
  "knobjocky",
  "knobjokey",
  "kock",
  "kondum",
  "kondums",
  "kum",
  "kummer",
  "kumming",
  "kums",
  "kunilingus",
  "l3itch",
  "labia",
  "lmfao",
  "lust",
  "lusting",
  "m45terbate",
  "ma5terb8",
  "ma5terbate",
  "masochist",
  "master_bate",
  "masterb8",
  "masterbat*",
  "masterbat3",
  "masterbate",
  "masterbation",
  "masterbations",
  "masturbate",
  "mo_fo",
  "mof0",
  "mofo",
  "mothafuck",
  "mothafucka",
  "mothafuckas",
  "mothafuckaz",
  "mothafucked ",
  "mothafucker",
  "mothafuckers",
  "mothafuckin",
  "mothafucking ",
  "mothafuckings",
  "mothafucks",
  "mother fucker",
  "motherfuck",
  "motherfucked",
  "motherfucker",
  "motherfuckers",
  "motherfuckin",
  "motherfucking",
  "motherfuckings",
  "motherfuckka",
  "motherfucks",
  "muff",
  "mutha",
  "muthafecker",
  "muthafuckker",
  "muther",
  "mutherfucker",
  "n1gga",
  "n1gger",
  "nazi",
  "nigg3r",
  "nigg4h",
  "nigga",
  "niggah",
  "niggas",
  "niggaz",
  "nigger",
  "niggers ",
  "nob",
  "nob jokey",
  "nobhead",
  "nobjocky",
  "nobjokey",
  "numbnuts",
  "nutsack",
  "orgasim ",
  "orgasims ",
  "orgasm",
  "orgasms ",
  "p0rn",
  "pawn",
  "pecker",
  "penis",
  "penisfucker",
  "phonesex",
  "phuck",
  "phuk",
  "phuked",
  "phuking",
  "phukked",
  "phukking",
  "phuks",
  "phuq",
  "pigfucker",
  "pimpis",
  "piss",
  "pissed",
  "pisser",
  "pissers",
  "pisses ",
  "pissflaps",
  "pissin ",
  "pissing",
  "pissoff ",
  "poop",
  "porn",
  "porno",
  "pornography",
  "pornos",
  "prick",
  "pricks ",
  "pron",
  "pube",
  "pusse",
  "pussi",
  "pussies",
  "pussy",
  "pussys ",
  "rectum",
  "retard",
  "rimjaw",
  "rimming",
  "sadist",
  "schlong",
  "screwing",
  "scroat",
  "scrote",
  "scrotum",
  "semen",
  "sex",
  "sh1t",
  "shag",
  "shagger",
  "shaggin",
  "shagging",
  "shemale",
  "shit",
  "shitdick",
  "shite",
  "shited",
  "shitey",
  "shitfuck",
  "shitfull",
  "shithead",
  "shiting",
  "shitings",
  "shits",
  "shitted",
  "shitter",
  "shitters ",
  "shitting",
  "shittings",
  "shitty ",
  "skank",
  "slut",
  "sluts",
  "smegma",
  "smut",
  "snatch",
  "son_of_a_bitch",
  "spac",
  "spunk",
  "s_h_i_t",
  "t1tt1e5",
  "t1tties",
  "teets",
  "teez",
  "testical",
  "testicle",
  "tit",
  "titfuck",
  "tits",
  "titt",
  "tittie5",
  "tittiefucker",
  "titties",
  "tittyfuck",
  "tittywank",
  "titwank",
  "tosser",
  "turd",
  "tw4t",
  "twat",
  "twathead",
  "twatty",
  "twunt",
  "twunter",
  "v14gra",
  "v1gra",
  "vagina",
  "viagra",
  "vulva",
  "w00se",
  "wang",
  "wank",
  "wanker",
  "wanky",
  "whoar",
  "whore",
  "willies",
  "willy",
  "xrated",
  "xxx"
];

const userManager = new UserManager();

export { userManager };

interface IpApiResponse {
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

interface CountryInfo {
  continentCode: string;
  name: string;
}
