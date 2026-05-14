export interface Channel {
  uuid: string
  name: string
  number: number
  icon_public_url?: string
}

export interface EpgEvent {
  eventId: string
  channelUuid: string
  channelName: string
  start: number
  stop: number
  title: string
  description: string
  subtitle?: string
}

export interface TvheadendConfig {
    host: string
    port: string
    user: string
    pass: string
}
