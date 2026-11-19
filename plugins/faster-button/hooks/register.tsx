import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const isOn = atom({ plugin: 'faster-button', key: 'isOn' } as const, false)

const FASTER = `The user turned on the "Faster" switch: work faster.
- Act on the most reasonable interpretation; ask only if truly blocked.
- No preamble, planning narration or end-of-turn recap.
- Batch independent tool calls in parallel; read only what you need.
- Don't spawn subagents; run only the most relevant test, if any.
- Keep the reply to a few lines.`

const SOUND = 'sounds/buttonSound.wav'

async function playSound($: EngineInterface) {
  const { platform } = await $.session.info()
  if (platform === 'windows') {
    const file = `${$.plugin.root}/${SOUND}`.replace(/\//g, '\\').replace(/'/g, "''")
    const ps = `(New-Object System.Media.SoundPlayer '${file}').PlaySync()`
    const r = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps], { timeoutMs: 10000 })
    if (r.exitCode !== 0) throw new Error(r.stderr.trim() || `PowerShell exited with ${r.exitCode}`)
  } else {
    await $.audio.play({ asset: SOUND })
  }
}

// Claude Code's built-in fast mode (the same as /fast): faster output from the model.
// Returns why it could not be changed, or undefined when it was.
async function setFastMode($: EngineInterface, value: boolean): Promise<string | undefined> {
  const row = (await $.config.list()).find(r => r.key === 'fastMode')
  if (row === undefined) return 'fast mode is not available in this session'
  const r = await $.config.set({ key: row.key, value })
  return r.deny
}

export const register: Register = on => {
  let isBusy = false
  let isPending = false

  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('isOn')) === true
    await update($, isOn, () => saved)
    return next(e)
  })

  on('turn.start', ($, e, next) => {
    isBusy = true
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    isBusy = false
    isPending = false
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const active = await read($, isOn).catch(() => false)
    if (!active) return next(e)
    return next({ ...e, context: [...(e.context ?? []), FASTER] })
  })

  // Switched on mid-response: Claude reads the note right after its next tool result.
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (!isPending || r.deny !== undefined) return r
    isPending = false
    return { ...r, context: [...(r.context ?? []), FASTER] }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const on_ = await read($, isOn)
    const { Box, Button, Text } = $.ui.resolve(e)

    const toggle = async () => {
      const value = !on_
      void playSound($).catch(err => $.ui.toast(`Faster: sound failed: ${String(err).slice(0, 200)}`))
      await update($, isOn, () => value)
      await $.store.set('isOn', value)
      isPending = value && isBusy
      const why = await setFastMode($, value).catch(err => String(err))
      $.ui.toast(
        why === undefined
          ? value ? 'Faster on: fast mode on' : 'Faster off: fast mode off'
          : `Faster ${value ? 'on' : 'off'} (fast mode unchanged: ${why.slice(0, 150)})`,
      )
    }

    return (
      <Box>
        <Button key="faster" label={on_ ? 'Faster mode is on, press to turn off' : 'Faster mode is off, press to turn on'} onPress={toggle}>
          ⚡ Faster{' '}
          {on_
            ? <Text backgroundColor="#16a34a" color="#ffffff" bold>{'  ON ● '}</Text>
            : <Text backgroundColor="#6b7280" color="#ffffff">{' ● OFF  '}</Text>}
        </Button>
        {on_ ? <Text dimColor> fast mode on, and Claude is told to work faster</Text> : null}
      </Box>
    )
  })
}
