import type { SiteNode } from '../../../shared-types/site-document';

// Véxora Sites — operações imutáveis sobre a árvore do documento.
// Usadas pelo canvas, pela paleta e pela árvore de camadas para que arrastar
// sempre passe pelas mesmas regras (histórico, lock e prevenção de ciclos).

export type DropPosition = 'before' | 'after' | 'inside';

const CHILD_CONTAINERS = new Set(['section', 'container']);

export function isNodeLocked(node: SiteNode): boolean {
  return node.props?.locked === true;
}

export function canReceiveChildren(node: SiteNode): boolean {
  return CHILD_CONTAINERS.has(node.type) && !isNodeLocked(node);
}

export function findNodeById(root: SiteNode, id: string): SiteNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function containsId(node: SiteNode, id: string): boolean {
  return node.id === id || node.children.some((child) => containsId(child, id));
}

export function replaceNodeById(root: SiteNode, id: string, next: SiteNode): SiteNode {
  if (root.id === id) return next;
  if (!root.children.some((child) => containsId(child, id))) return root;
  return {
    ...root,
    children: root.children.map((child) => replaceNodeById(child, id, next)),
  };
}

export function findParentId(root: SiteNode, id: string): string | null {
  for (const child of root.children) {
    if (child.id === id) return root.id;
    const found = findParentId(child, id);
    if (found) return found;
  }
  return null;
}

/** `candidateId` está dentro de `ancestorId` (exclusivo: um nó não é descendente de si). */
export function isDescendantId(root: SiteNode, ancestorId: string, candidateId: string): boolean {
  if (ancestorId === candidateId) return false;
  const ancestor = findNodeById(root, ancestorId);
  return ancestor ? containsId(ancestor, candidateId) : false;
}

function findPath(root: SiteNode, id: string, path: SiteNode[] = []): SiteNode[] | null {
  const next = [...path, root];
  if (root.id === id) return next;
  for (const child of root.children) {
    const found = findPath(child, id, next);
    if (found) return found;
  }
  return null;
}

/** Um nó bloqueado, ou filho de bloco bloqueado, não pode ser movido nem receber drops. */
export function isEffectivelyLocked(root: SiteNode, id: string): boolean {
  const path = findPath(root, id);
  return path ? path.some(isNodeLocked) : false;
}

export function appendNode(root: SiteNode, node: SiteNode): SiteNode {
  if (findNodeById(root, node.id)) return root;
  return { ...root, children: [...root.children, node] };
}

export function insertNodeAt(
  root: SiteNode,
  node: SiteNode,
  targetId: string | null,
  position: DropPosition,
): SiteNode {
  if (findNodeById(root, node.id)) return root;
  const destinationId = targetId ?? root.id;
  if (isEffectivelyLocked(root, destinationId)) return root;

  if (destinationId === root.id) {
    // before/after da raiz significaria sair do documento; apenas "inside" é válido.
    return position === 'inside' || !targetId ? appendNode(root, node) : root;
  }

  const target = findNodeById(root, destinationId);
  if (!target) return root;

  if (position === 'inside') {
    if (!canReceiveChildren(target)) return root;
    return replaceNodeById(root, target.id, {
      ...target,
      children: [...target.children, node],
    });
  }

  const parentId = findParentId(root, target.id);
  if (!parentId) return root;
  const parent = findNodeById(root, parentId);
  if (!parent || isEffectivelyLocked(root, parentId)) return root;

  const index = parent.children.findIndex((child) => child.id === target.id);
  if (index < 0) return root;
  const children = [...parent.children];
  children.splice(position === 'before' ? index : index + 1, 0, node);
  return replaceNodeById(root, parent.id, { ...parent, children });
}

function detachNode(root: SiteNode, id: string): { root: SiteNode; node: SiteNode | null } {
  if (root.id === id) return { root, node: null };
  const parentId = findParentId(root, id);
  if (!parentId) return { root, node: null };
  const parent = findNodeById(root, parentId);
  const node = parent?.children.find((child) => child.id === id) ?? null;
  if (!parent || !node) return { root, node: null };
  return {
    root: replaceNodeById(root, parent.id, {
      ...parent,
      children: parent.children.filter((child) => child.id !== id),
    }),
    node,
  };
}

export function moveNode(
  root: SiteNode,
  sourceId: string,
  targetId: string | null,
  position: DropPosition,
): SiteNode {
  if (!sourceId || sourceId === targetId || sourceId === root.id) return root;
  if (isEffectivelyLocked(root, sourceId)) return root;
  if (!targetId) return root;
  if (isDescendantId(root, sourceId, targetId)) return root;

  // Valida o destino antes de destacar: um drop recusado não pode perder o bloco.
  const target = findNodeById(root, targetId);
  if (!target || isEffectivelyLocked(root, targetId)) return root;
  if (targetId === root.id && position !== 'inside') return root;
  if (position === 'inside' && !canReceiveChildren(target)) return root;

  const detached = detachNode(root, sourceId);
  if (!detached.node) return root;
  const inserted = insertNodeAt(detached.root, detached.node, targetId, position);
  return inserted === detached.root ? root : inserted;
}
