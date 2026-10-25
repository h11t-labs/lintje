/** The layout of a large graph, away from the page: a request in, its positions out. */
import { computeLayout, type LayoutRequest } from './layout'

const scope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  postMessage(message: unknown, transfer: Transferable[]): void
}

scope.addEventListener('message', (event: MessageEvent<{ id: number; request: LayoutRequest }>) => {
  const { id, request } = event.data
  scope.postMessage({ id, result: computeLayout(request) }, [])
})
