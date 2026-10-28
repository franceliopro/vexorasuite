type ScrollLock = { owners: Set<symbol>; overflow: string; priority: string };
const scrollLocks = new WeakMap<Document, ScrollLock>();

/** Dialogs and fullscreen editors share ownership, even when they close out of order. */
export function acquireBodyScrollLock(doc: Document = document): () => void {
  let state = scrollLocks.get(doc);
  if (!state) {
    state = {
      owners: new Set(),
      overflow: doc.body.style.getPropertyValue("overflow"),
      priority: doc.body.style.getPropertyPriority("overflow"),
    };
    scrollLocks.set(doc, state);
    doc.body.style.setProperty("overflow", "hidden");
  }
  const owner = Symbol("scroll-lock");
  state.owners.add(owner);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.owners.delete(owner);
    if (state.owners.size) return;
    if (state.overflow) doc.body.style.setProperty("overflow", state.overflow, state.priority);
    else doc.body.style.removeProperty("overflow");
    scrollLocks.delete(doc);
  };
}
