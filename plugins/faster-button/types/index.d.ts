export type Mode = boolean

declare module 'claude-code' {
  interface PluginState {
    'faster-button': { isOn: Mode }
  }
}
