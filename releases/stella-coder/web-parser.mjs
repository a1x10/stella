import http from "http"
import https from "https"
import { JSDOM } from "jsdom"
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http
    const headers = {
      "User-Agent": "StellaBot/5.2 (compatible; like Googlebot)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      ...options.headers,
    }
    const req = mod.get(url, { headers, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href
        return fetchUrl(redirectUrl, options).then(resolve).catch(reject)
      }
      let data = ""
      res.on("data", (chunk) => data += chunk)
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        html: data,
        url,
      }))
    })
    req.on("error", reject)
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")) })
  })
}
export class WebParser {
  constructor() {
    this.cache = new Map()
  }
  async fetchPage(url) {
    if (this.cache.has(url)) {
      return this.cache.get(url)
    }
    const result = await fetchUrl(url)
    const dom = new JSDOM(result.html)
    const doc = dom.window.document
    const parsed = {
      url,
      status: result.status,
      title: doc.querySelector("title")?.textContent?.trim() || "",
      meta: {
        description: doc.querySelector('meta[name="description"]')?.content || "",
        keywords: doc.querySelector('meta[name="keywords"]')?.content || "",
        ogTitle: doc.querySelector('meta[property="og:title"]')?.content || "",
        ogDescription: doc.querySelector('meta[property="og:description"]')?.content || "",
        ogImage: doc.querySelector('meta[property="og:image"]')?.content || "",
        canonical: doc.querySelector('link[rel="canonical"]')?.href || "",
      },
      headings: Array.from(doc.querySelectorAll("h1,h2,h3,h4")).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim(),
      })),
      links: Array.from(doc.querySelectorAll("a[href]")).map(a => ({
        text: a.textContent.trim().slice(0, 100),
        href: a.href,
      })).filter(l => l.text).slice(0, 100),
      images: Array.from(doc.querySelectorAll("img[src]")).map(img => ({
        src: img.src,
        alt: img.alt || "",
      })).slice(0, 50),
      text: doc.body?.innerText?.trim()?.slice(0, 50000) || "",
      html: result.html,
      linksCount: doc.querySelectorAll("a[href]").length,
      imagesCount: doc.querySelectorAll("img[src]").length,
      formsCount: doc.querySelectorAll("form").length,
      scriptsCount: doc.querySelectorAll("script").length,
    }
    this.cache.set(url, parsed)
    return parsed
  }
  async extractText(url) {
    const page = await this.fetchPage(url)
    return { success: true, title: page.title, text: page.text }
  }
  async extractLinks(url) {
    const page = await this.fetchPage(url)
    return { success: true, links: page.links }
  }
  async extractImages(url) {
    const page = await this.fetchPage(url)
    return { success: true, images: page.images }
  }
  async extractForms(url) {
    const page = await this.fetchPage(url)
    const dom = new JSDOM(page.html)
    const doc = dom.window.document
    const forms = Array.from(doc.querySelectorAll("form")).map(f => ({
      action: f.action,
      method: f.method?.toUpperCase() || "GET",
      fields: Array.from(f.querySelectorAll("input,textarea,select,button")).map(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || "",
        name: el.name || "",
        placeholder: el.placeholder || "",
        value: el.value || "",
        required: el.required,
        options: el.tagName === "SELECT"
          ? Array.from(el.querySelectorAll("option")).map(o => ({ value: o.value, text: o.textContent.trim() }))
          : undefined,
      })),
    }))
    return { success: true, forms }
  }
  async search(query, engine = "duckduckgo") {
    if (engine === "duckduckgo") {
      const url = `https:
      const page = await this.fetchPage(url)
      const dom = new JSDOM(page.html)
      const doc = dom.window.document
      const results = Array.from(doc.querySelectorAll(".result")).map(r => ({
        title: r.querySelector(".result__title")?.textContent?.trim() || "",
        url: r.querySelector(".result__url")?.textContent?.trim() || "",
        snippet: r.querySelector(".result__snippet")?.textContent?.trim() || "",
      })).slice(0, 10)
      return { success: true, results }
    }
    if (engine === "google") {
      const url = `https:
      const page = await this.fetchPage(url)
      const dom = new JSDOM(page.html)
      const doc = dom.window.document
      const results = Array.from(doc.querySelectorAll("div.g,div[data-sokoban-container]")).map(r => ({
        title: r.querySelector("h3")?.textContent?.trim() || "",
        url: r.querySelector("a")?.href || "",
        snippet: r.querySelector(".VwiC3b,.st")?.textContent?.trim() || "",
      })).filter(r => r.title).slice(0, 10)
      return { success: true, results }
    }
    return { success: false, error: `Unknown engine: ${engine}` }
  }
  async getSEO(url) {
    const page = await this.fetchPage(url)
    const dom = new JSDOM(page.html)
    const doc = dom.window.document
    const seo = {
      title: page.title,
      titleLength: page.title.length,
      metaDescription: page.meta.description,
      metaDescLength: page.meta.description.length,
      h1Count: doc.querySelectorAll("h1").length,
      hasCanonical: !!page.meta.canonical,
      hasOgTitle: !!page.meta.ogTitle,
      hasOgDescription: !!page.meta.ogDescription,
      hasOgImage: !!page.meta.ogImage,
      imageAlts: Array.from(doc.querySelectorAll("img")).filter(img => !img.alt).length === 0,
      linksInternal: page.links.filter(l => new URL(l.href, url).hostname === new URL(url).hostname).length,
      linksExternal: page.links.filter(l => new URL(l.href, url).hostname !== new URL(url).hostname).length,
      score: 0,
      issues: [],
    }
    if (seo.titleLength >= 30 && seo.titleLength <= 60) seo.score += 20
    else seo.issues.push(`Title length ${seo.titleLength} (optimal: 30-60)`)
    if (seo.metaDescLength >= 120 && seo.metaDescLength <= 160) seo.score += 20
    else seo.issues.push(`Meta description length ${seo.metaDescLength} (optimal: 120-160)`)
    if (seo.h1Count === 1) seo.score += 15
    else seo.issues.push(`H1 count: ${seo.h1Count} (should be 1)`)
    if (seo.hasCanonical) seo.score += 10
    else seo.issues.push("Missing canonical tag")
    if (seo.hasOgTitle) seo.score += 10
    else seo.issues.push("Missing og:title")
    if (seo.hasOgDescription) seo.score += 10
    else seo.issues.push("Missing og:description")
    if (seo.hasOgImage) seo.score += 5
    else seo.issues.push("Missing og:image")
    if (seo.imageAlts) seo.score += 10
    else seo.issues.push("Images without alt text")
    return { success: true, seo }
  }
  async batchFetch(urls) {
    const results = await Promise.allSettled(
      urls.map(url => this.fetchPage(url).then(p => ({
        url,
        title: p.title,
        status: p.status,
        textLength: p.text.length,
      })))
    )
    return {
      success: true,
      results: results.map((r, i) => ({
        url: urls[i],
        ...(r.status === "fulfilled" ? r.value : { error: r.reason?.message }),
      })),
    }
  }
}
export default WebParser