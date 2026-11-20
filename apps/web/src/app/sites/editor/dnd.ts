import type { NodeType } from '../../../shared-types/site-document';
import type { DropPosition } from './site-tree';

// Contrato de drag-and-drop compartilhado entre paleta, árvore de camadas e iframe.
// Os tipos MIME próprios evitam que um arraste externo qualquer seja aceito como bloco.

export const DND_MIME_BLOCK = 'application/x-vexora-block';
export const DND_MIME_NODE = 'application/x-vexora-node';

export type DragPayload =
  | { kind: 'palette'; nodeType: NodeType }
  | { kind: 'node'; nodeId: string };

export interface DragTarget {
  targetId: string | null;
  position: DropPosition | null;
}

export function writeDragPayload(
  transfer: DataTransfer | null,
  payload: DragPayload,
  label: string,
): void {
  if (!transfer) return;
  transfer.effectAllowed = payload.kind === 'palette' ? 'copy' : 'move';
  const mime = payload.kind === 'palette' ? DND_MIME_BLOCK : DND_MIME_NODE;
  transfer.setData(mime, JSON.stringify(payload));
  transfer.setData('text/plain', label);
}

export function isDragPayload(value: unknown): value is DragPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<DragPayload>;
  if (payload.kind === 'palette') return typeof payload.nodeType === 'string';
  if (payload.kind === 'node') return typeof payload.nodeId === 'string';
  return false;
}

export function readDragPayload(transfer: DataTransfer | null): DragPayload | null {
  if (!transfer) return null;
  const block = transfer.getData(DND_MIME_BLOCK);
  if (block) {
    try {
      const parsed = JSON.parse(block) as DragPayload;
      if (isDragPayload(parsed) && parsed.kind === 'palette') return parsed;
    } catch {
      // payload externo inválido é ignorado
    }
  }
  const node = transfer.getData(DND_MIME_NODE);
  if (node) {
    try {
      const parsed = JSON.parse(node) as DragPayload;
      if (isDragPayload(parsed) && parsed.kind === 'node') return parsed;
    } catch {
      // o runtime do iframe grava apenas o id do nó
      return { kind: 'node', nodeId: node };
    }
  }
  return null;
}
