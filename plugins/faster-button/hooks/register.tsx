import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const isOn = atom({ plugin: 'faster-button', key: 'isOn' } as const, false)

const FASTER = `The user pressed the "Faster" button: work faster.
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('isOn')) === true
    await update($, isOn, () => saved)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const active = await read($, isOn).catch(() => false)
    if (!active) return next(e)
    return next({ ...e, context: [...(e.context ?? []), FASTER] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const on_ = await read($, isOn)
    const { Box, Button, Text } = $.ui.resolve(e)

    const toggle = async () => {
      const value = !on_
      void playSound($).catch(err => $.ui.toast(`Faster: sound failed: ${String(err).slice(0, 200)}`))
      await update($, isOn, () => value)
      await $.store.set('isOn', value)
      $.ui.toast(value ? 'Faster mode on' : 'Faster mode off')
    }

    return (
      <Box>
        <Button key="faster" label={on_ ? 'Faster mode is on, press to turn off' : 'Faster mode is off, press to turn on'} onPress={toggle}>
          ⚡ Faster{' '}
          {on_
            ? <Text backgroundColor="#16a34a" color="#ffffff" bold>{'  ON ● '}</Text>
            : <Text backgroundColor="#6b7280" color="#ffffff">{' ● OFF  '}</Text>}
        </Button>
        {on_ ? <Text dimColor> every prompt asks Claude to work faster</Text> : null}
      </Box>
    )
  })
}
