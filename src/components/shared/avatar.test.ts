/** The one drawing of a circle: its form follows what there is, photo → initials → icon → empty. */
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'lit'
import { renderAvatar, type AvatarOptions } from './avatar'
import type { Person } from '../../types'

// Data URIs: happy-dom would fetch a path from a server that is not there.
const PHOTO = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

afterEach(() => {
  document.body.innerHTML = ''
})

function draw(person: Person | null, options?: AvatarOptions): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  render(renderAvatar(person, options), host)
  return host.querySelector<HTMLElement>('.lintje-avatar')!
}

describe('renderAvatar', () => {
  it('draws the initials, hidden from a screen reader, in the size asked', () => {
    const avatar = draw({ name: 'J. de Vries', initials: 'JV' }, { size: 'small' })
    expect(avatar.getAttribute('aria-hidden')).toBe('true')
    expect(avatar.classList.contains('lintje-avatar--small')).toBe(true)
    expect(avatar.querySelector('.lintje-avatar__initials')!.textContent).toBe('JV')
    expect(avatar.querySelector('img')).toBeNull()
  })

  it('lays a photo over the initials, with an empty alt', () => {
    const avatar = draw({ name: 'J. de Vries', initials: 'JV', photo: PHOTO })
    const photo = avatar.querySelector('img')!
    expect(photo.getAttribute('alt')).toBe('')
    expect(photo.getAttribute('src')).toBe(PHOTO)
    expect(avatar.querySelector('.lintje-avatar__initials')!.textContent).toBe('JV')
  })

  it('hides a photo that does not load, so the initials under it show', () => {
    const avatar = draw({ name: 'J. de Vries', initials: 'JV', photo: 'data:image/png;base64,' })
    const photo = avatar.querySelector('img')!
    photo.dispatchEvent(new Event('error'))
    expect(photo.hidden).toBe(true)
    expect(avatar.querySelector('.lintje-avatar__initials')).not.toBeNull()
  })

  it('draws the person icon without initials and without a photo', () => {
    const avatar = draw({ name: 'Extern account' }, { size: 'large' })
    expect(avatar.querySelector('.lintje-avatar__initials')).toBeNull()
    expect(avatar.querySelector('svg.lintje-avatar__icon')).not.toBeNull()
  })

  it('is the dashed empty place without a person', () => {
    const avatar = draw(null)
    expect(avatar.classList.contains('is-empty')).toBe(true)
    expect(avatar.textContent!.trim()).toBe('')
  })

  it('takes a speaker’s colour, but neutral for `other` and on the menu', () => {
    const person = { name: 'Spreker 1', initials: 'S1' }
    expect(draw(person, { color: 'pink' }).classList.contains('lintje-avatar--pink')).toBe(true)
    const other = draw(person, { color: 'other' })
    expect([...other.classList].some((name) => name.endsWith('--other'))).toBe(false)
    const nav = draw(person, { onNav: true, color: 'pink' })
    expect(nav.classList.contains('lintje-avatar--nav')).toBe(true)
    expect(nav.classList.contains('lintje-avatar--pink')).toBe(false)
  })
})
