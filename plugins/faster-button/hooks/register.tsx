import type { EngineInterface, Register } from 'claude-code'

const SOUND = 'sounds/buttonSound.mp3'
const NOTE = 'The user pressed the Faster button: work faster. Skip narration, batch tool calls, and wrap up as quickly as you can.'

async function playSound($: EngineInterface) {
  const { platform } = await $.session.info()
  if (platform === 'windows') {
    const file = `${$.plugin.root}/${SOUND}`.replace(/\//g, '\\').replace(/'/g, "''")
    const ps = `Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'${file}'); $p.Play(); Start-Sleep -Milliseconds 3000`
    await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps], { timeoutMs: 10000 })
  } else {
    await $.audio.play({ asset: SOUND })
  }
}

export const register: Register = on => {
  let isBusy = false
  let isPending = false

  on('turn.start', ($, e, next) => {
    isBusy = true
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    isBusy = false
    isPending = false
    return next(e)
  })

  // Pressed mid-task: Claude reads the note right after its next tool result.
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (!isPending || r.deny !== undefined) return r
    isPending = false
    return { ...r, context: [...(r.context ?? []), NOTE] }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Button } = $.ui.resolve(e)

    const press = async () => {
      void playSound($).catch(() => {})
      if (isBusy) {
        isPending = true
        $.ui.toast('Told Claude to work faster')
      } else {
        await $.prompt.submit({ text: 'Work faster.', asUser: true })
      }
    }

    return <Button key="faster" label="⚡ Work faster" onPress={press} />
  })
}
