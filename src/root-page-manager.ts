import path = require('path');
import fs = require('fs');
import url = require('url');
import { Request, Response, Application } from 'express';
import { UrlManager } from "./url-manager";
import { Initializable } from "./interfaces/initializable";
import { configuration } from "./configuration";
import * as useragent from 'useragent';
import { UserRecord } from "./interfaces/db-records";
import * as escapeHtml from 'escape-html';
import Mustache = require('mustache');

export class RootPageManager implements Initializable {
  private urlManager: UrlManager;
  private templates: { [key: string]: string } = {};
  private landingTemplates: { [key: string]: string } = {};
  private templatesLoaded = false;

  constructor() {
    this.landingTemplates['default'] = '../templates/landing/default.html';
  }

  async initialize(urlManager: UrlManager): Promise<void> {
    this.urlManager = urlManager;
    if (!this.templatesLoaded) {
      this.templates['index'] = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

      const gaId = configuration.get('google.analytics.id', "UA-52117709-8");
      let globalJsContent = "<script>\nwindow.googleAnalyticsId = \"" + gaId + "\";\n" + fs.readFileSync(path.join(__dirname, '../public/scripts/global.js'), 'utf8') + "\n</script>";
      globalJsContent += "\n<script>\n" + fs.readFileSync(path.join(__dirname, '../public/scripts/intersection-observer.js'), 'utf8') + "\n</script>";
      this.templates['globaljs'] = globalJsContent;

      this.templates['svglogo'] = '<svg id="svg-logo" style="height: 39px; width: auto; padding: 10px 0 0;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2300.89 531.46"><defs><style>.cls-1{fill:#c7f465;}.cls-2{fill:#ffb734;}.cls-3{fill:#4ecdc4;}.cls-3,.cls-4,.cls-5{fill-rule:evenodd;}.cls-4{fill:#865ea4;}.cls-5{fill:#ff6b6b;}.cls-6{font-size:472px;fill:#fff;font-family:OpenSans-Light, Open Sans;}</style></defs><title>Asset 1</title><g><g><path class="cls-1" d="M147.56,210.89c4.92-70.88,52.61-105.41,113.14-105.41a174,174,0,0,1,67.55,13.16l16.38-63.89C330.35,47.35,298.7,38.92,257,38.92c-107.7,0-194.29,67.59-194.29,189,0,6,.22,11.79.63,17.56Z"/><path class="cls-2" d="M328.24,327.76c-15.82,6.36-42.74,11.61-67,11.61-38.08,0-67.84-12.61-87.4-35.05L95,337.52c30.39,42.11,82,68.4,154,68.4,43.29,0,76.57-7.91,91.36-15.31Z"/><path class="cls-3" d="M0,253.26l160.83-92.88c-8.76,16.93-13.68,37.86-13.68,62.82,0,3.29.07,6.51.26,9.69L0,318Z"/><path class="cls-4" d="M44.33,292.42l103.08-59.53c1.22,21.48,6.47,40.27,15.38,55.87L44.33,357.16Z"/><path class="cls-5" d="M16.75,373l146-84.3a94.7,94.7,0,0,0,43.44,39.67L16.75,437.72Z"/><text class="cls-6" transform="translate(366.93 404.47)">hannels</text></g></g></svg>'
        + '<svg id="svg-logo-small" style="height: 39px; width: auto; padding: 10px 0 0;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344.62 398.8"><defs><style>.cls-1{fill:#c7f465;}.cls-2{fill:#ffb734;}.cls-3{fill:#4ecdc4;}.cls-3,.cls-4,.cls-5{fill-rule:evenodd;}.cls-4{fill:#865ea4;}.cls-5{fill:#ff6b6b;}</style></defs><title>Asset 2</title><g><g><path class="cls-1" d="M147.56,172c4.92-70.88,52.61-105.41,113.14-105.41a174,174,0,0,1,67.55,13.16l16.38-63.89C330.35,8.43,298.7,0,257,0,149.26,0,62.67,67.59,62.67,189c0,6,.22,11.79.63,17.56Z"/><path class="cls-2" d="M328.24,288.84c-15.82,6.36-42.74,11.61-67,11.61-38.08,0-67.84-12.61-87.4-35.05L95,298.6c30.39,42.11,82,68.4,154,68.4,43.29,0,76.57-7.91,91.36-15.31Z"/><path class="cls-3" d="M0,214.34l160.83-92.88c-8.76,16.93-13.68,37.86-13.68,62.82,0,3.29.07,6.51.26,9.69L0,279.08Z"/><path class="cls-4" d="M44.33,253.49,147.41,194c1.22,21.48,6.47,40.27,15.38,55.87L44.33,318.23Z"/><path class="cls-5" d="M16.75,334.06l146-84.3a94.7,94.7,0,0,0,43.44,39.67L16.75,398.8Z"/></g></g></svg>';

      this.templatesLoaded = true;
    }
    return;
  }

  async initialize2(): Promise<void> {
    return;
  }

  private async getLandingContent(request: Request): Promise<string> {
    let landingTemplate = "default";
    if (request && request.query && request.query['landing']) {
      landingTemplate = request.query['landing'].trim();
      if (!this.landingTemplates[landingTemplate]) {
        landingTemplate = "default";
      }
    }
    const key = "landing-" + landingTemplate;
    if (!this.templates[key]) {
      this.templates[key] = fs.readFileSync(path.join(__dirname, this.landingTemplates[landingTemplate]), 'utf8');
    }
    return this.templates[key];
  }

  async handlePage(type: string, request: Request, response: Response): Promise<void> {
    // this.templates['index'] = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

    // analyze user agent
    const userAgent = (request.headers['user-agent'] || "").toString();
    const agentInfo = useragent.is(userAgent);
    const useShadyDom = agentInfo.safari || agentInfo.mobile_safari || agentInfo.ie || (userAgent.indexOf("Edge") >= 0);

    let canonicalUrl = this.urlManager.getAbsoluteUrl(request.url.split(/[\#\?]/)[0]);
    // initialize metadata
    const ogUrl = configuration.get('baseClientUri');
    const metadata = {
      title: "CopperBeam",
      description: "CopperBeam is the world's first hybrid/micropayment paywall consortium",
      url: ogUrl,
      image: url.resolve(ogUrl, '/s/images/logo700.png'),
      imageWidth: 700,
      imageHeight: 700,
      author: 'Channels',
      publishedTime: ''
    };
    let searchText = "";

    // Replace in template
    const view = {
      public_base: this.urlManager.getPublicBaseUrl(),
      canonical_url: metadata.url,
      rest_base: this.urlManager.getDynamicBaseUrl(),
      og_title: metadata.title,
      og_description: metadata.description,
      og_url: metadata.url,
      og_image: metadata.image,
      og_imagewidth: metadata.imageWidth,
      og_imageheight: metadata.imageHeight,
      globaljs: this.templates['globaljs'] || '',
      pre_globaljs: (useShadyDom ? "<script>ShadyDOM = { force: true }; window.customElements.forcePolyfill = true;</script>" : ""),
      svglogo: this.templates['svglogo'],
      analyticsId: configuration.get('google.analytics.id', "UA-52117709-8"),
      og_published_time: metadata.publishedTime,
      og_author: metadata.author,
      seoContent: searchText,
      landingcontent: await this.getLandingContent(request)
    };
    const output = Mustache.render(this.templates[type], view);
    response.setHeader("Cache-Control", 'public, max-age=' + 5);
    response.contentType('text/html');
    response.status(200);
    response.send(output);
  }
}

const rootPageManager = new RootPageManager();
export { rootPageManager };
