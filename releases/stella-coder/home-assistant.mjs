import fs from "node:fs"
import path from "node:path"
import os from "node:os"
const CONFIG_DIR = path.join(os.homedir(), ".stella", "ha")
export class HomeAssistant {
  constructor(url = "", token = "") {
    this.url = (url || process.env.HA_URL || "").replace(/\/$/, "")
    this.token = token || process.env.HA_TOKEN || ""
    if (!this.url && fs.existsSync(path.join(CONFIG_DIR, "config.json"))) {
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "config.json"), "utf8"))
        this.url = cfg.url || ""
        this.token = cfg.token || ""
      } catch {}
    }
  }
  isConfigured() { return !!(this.url && this.token) }
  configure(url, token) {
    this.url = url.replace(/\/$/, "")
    this.token = token
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(path.join(CONFIG_DIR, "config.json"), JSON.stringify({ url: this.url, token: this.token }, null, 2))
  }
  async request(method, endpoint, body) {
    const resp = await fetch(`${this.url}/api/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (resp.status === 404) return { success: false, error: "Not found" }
    if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` }
    const text = await resp.text()
    try { return { success: true, data: JSON.parse(text) } }
    catch { return { success: true, data: text } }
  }
  async getStates() { return this.request("GET", "states") }
  async getState(entityId) { return this.request("GET", `states/${entityId}`) }
  async callService(domain, service, data = {}) {
    return this.request("POST", `services/${domain}/${service}`, data)
  }
  async toggle(entityId) { return this.callService("homeassistant", "toggle", { entity_id: entityId }) }
  async turnOn(entityId) { return this.callService("homeassistant", "turn_on", { entity_id: entityId }) }
  async turnOff(entityId) { return this.callService("homeassistant", "turn_off", { entity_id: entityId }) }
  async getConfig() { return this.request("GET", "config") }
  async getLogbook(startTimestamp) {
    const start = startTimestamp || new Date(Date.now() - 86400000).toISOString()
    return this.request("GET", `logbook/${start}`)
  }
  async getHistory(entityId, hours = 24) {
    const start = new Date(Date.now() - hours * 3600000).toISOString()
    return this.request("GET", `history/period/${start}?filter_entity_id=${entityId}`)
  }
  async getTemplate(template) {
    return this.request("POST", "template", { template })
  }
  async fireEvent(eventType, data = {}) {
    return this.request("POST", `events/${eventType}`, data)
  }
  async getServices() { return this.request("GET", "services") }
  async getEntitySources() { return this.request("GET", "config/entity_registry") }
  async getAutoInfo() {
    const s = await this.request("GET", "config")
    return { success: true, haVersion: s.data?.version, locationName: s.data?.location_name, timezone: s.data?.time_zone }
  }
  async getLights() {
    const states = await this.getStates()
    if (!states.success) return states
    const lights = states.data.filter(s => s.entity_id.startsWith("light."))
    return { success: true, lights: lights.map(l => ({ entity: l.entity_id, state: l.state, brightness: l.attributes?.brightness, friendlyName: l.attributes?.friendly_name })) }
  }
  async getSensors() {
    const states = await this.getStates()
    if (!states.success) return states
    const sensors = states.data.filter(s => s.entity_id.startsWith("sensor."))
    return { success: true, sensors: sensors.map(s => ({ entity: s.entity_id, state: s.state, unit: s.attributes?.unit_of_measurement, friendlyName: s.attributes?.friendly_name })) }
  }
  async getSwitches() {
    const states = await this.getStates()
    if (!states.success) return states
    const switches = states.data.filter(s => s.entity_id.startsWith("switch."))
    return { success: true, switches: switches.map(s => ({ entity: s.entity_id, state: s.state, friendlyName: s.attributes?.friendly_name })) }
  }
  async getClimate() {
    const states = await this.getStates()
    if (!states.success) return states
    const climate = states.data.filter(s => s.entity_id.startsWith("climate."))
    return { success: true, devices: climate.map(c => ({ entity: c.entity_id, state: c.state, temp: c.attributes?.temperature, currentTemp: c.attributes?.current_temperature, mode: c.attributes?.hvac_mode, friendlyName: c.attributes?.friendly_name })) }
  }
  async setClimateTemp(entityId, temp) {
    return this.callService("climate", "set_temperature", { entity_id: entityId, temperature: temp })
  }
  async setClimateMode(entityId, mode) {
    return this.callService("climate", "set_hvac_mode", { entity_id: entityId, hvac_mode: mode })
  }
  async getMediaPlayers() {
    const states = await this.getStates()
    if (!states.success) return states
    return { success: true, players: states.data.filter(s => s.entity_id.startsWith("media_player.")).map(p => ({ entity: p.entity_id, state: p.state, friendlyName: p.attributes?.friendly_name, source: p.attributes?.source, volume: p.attributes?.volume_level })) }
  }
  async mediaPlay(entityId) { return this.callService("media_player", "media_play", { entity_id: entityId }) }
  async mediaPause(entityId) { return this.callService("media_player", "media_pause", { entity_id: entityId }) }
  async mediaStop(entityId) { return this.callService("media_player", "media_stop", { entity_id: entityId }) }
  async mediaNext(entityId) { return this.callService("media_player", "media_next_track", { entity_id: entityId }) }
  async mediaPrev(entityId) { return this.callService("media_player", "media_previous_track", { entity_id: entityId }) }
  async setVolume(entityId, level) { return this.callService("media_player", "volume_set", { entity_id: entityId, volume_level: level }) }
  async selectSource(entityId, source) { return this.callService("media_player", "select_source", { entity_id: entityId, source }) }
  async getCovers() {
    const states = await this.getStates()
    if (!states.success) return states
    return { success: true, covers: states.data.filter(s => s.entity_id.startsWith("cover.")).map(c => ({ entity: c.entity_id, state: c.state, friendlyName: c.attributes?.friendly_name, position: c.attributes?.current_position })) }
  }
  async openCover(entityId) { return this.callService("cover", "open_cover", { entity_id: entityId }) }
  async closeCover(entityId) { return this.callService("cover", "close_cover", { entity_id: entityId }) }
  async stopCover(entityId) { return this.callService("cover", "stop_cover", { entity_id: entityId }) }
  async setCoverPosition(entityId, pos) { return this.callService("cover", "set_cover_position", { entity_id: entityId, position: pos }) }
  async setBrightness(entityId, brightness) {
    return this.callService("light", "turn_on", { entity_id: entityId, brightness })
  }
  async setColor(entityId, color) {
    return this.callService("light", "turn_on", { entity_id: entityId, rgb_color: color })
  }
  async getGroup(entityId) {
    return this.request("GET", `states/${entityId}`)
  }
  async ping() {
    try {
      const resp = await fetch(`${this.url}/api/`, { headers: { Authorization: `Bearer ${this.token}` } })
      return { success: resp.ok, status: resp.status }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
  async getAllEntityIds() {
    const states = await this.getStates()
    if (!states.success) return states
    return { success: true, entities: states.data.map(s => s.entity_id).sort() }
  }
}