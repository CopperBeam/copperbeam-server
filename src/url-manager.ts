import * as express from "express";
// tslint:disable-next-line:no-duplicate-imports
import { Request, Response } from 'express';
import * as net from 'net';
import { RestServer } from './interfaces/rest-server';
import { configuration } from "./configuration";
import * as url from 'url';
import { SERVER_VERSION } from "./server-version";
import { RestRequest } from "./interfaces/rest-services";
import { RestHelper } from "./rest-helper";
import { errorManager } from "./error-manager";
import { db } from "./db";

const LETTERS = 'abcdefghjklmnpqrstuvwxyz';
const DIGITS = '0123456789';
const URL_SYMBOLS = '-._~';
const CODE_SYMBOLS = LETTERS + LETTERS.toUpperCase() + DIGITS + URL_SYMBOLS;

export class UrlManager implements RestServer {
  private version: number;
  private app: express.Application;
  constructor(version: number) {
    this.version = version;
  }

  async initializeRestServices(urlManager: UrlManager, app: express.Application): Promise<void> {
    this.app = app;
    this.registerHandlers();
  }

  private registerHandlers(): void {
  }

  getAbsoluteUrl(relativeUrl: string): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl += '/';
    }
    return configuration.get('baseClientUri') + relativeUrl;
  }

  getPublicBaseUrl(absolute = false): string {
    const baseUrl = '/v' + this.version;
    if (absolute) {
      return configuration.get('baseClientUri') + baseUrl;
    }
    return baseUrl;
  }

  getDynamicBaseUrl(absolute = false): string {
    if (absolute) {
      return configuration.get('baseClientUri') + '/d';
    } else {
      return '/d';
    }
  }

  getStaticBaseUrl(absolute = false): string {
    if (absolute) {
      return configuration.get('baseClientUri') + '/s';
    } else {
      return '/s';
    }
  }

  getStaticUrl(relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      return configuration.get('baseClientUri') + '/s' + relativeUrl;
    } else {
      return '/s' + relativeUrl;
    }
  }

  getDynamicUrl(relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      return configuration.get('baseClientUri') + '/d' + relativeUrl;
    } else {
      return '/d' + relativeUrl;
    }
  }

  getPublicUrl(relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    return this.getPublicBaseUrl(absolute) + relativeUrl;
  }

  getVersionedUrl(relativeUrl: string, absolute = false): string {
    if (!relativeUrl.startsWith('/')) {
      relativeUrl = '/' + relativeUrl;
    }
    if (absolute) {
      return configuration.get('baseClientUri') + '/v' + this.version + relativeUrl;
    } else {
      return '/d' + relativeUrl;
    }
  }

}

