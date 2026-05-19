// Simple window-level event bus for opening modals/panels from anywhere
export type ModalName =
  | "new-project"
  | "draft-update"
  | "view-impact"
  | "notifications"
  | "profile-menu"
  | "add-client"
  | "client-panel"
  | "add-vendor"
  | "vendor-panel"
  | "new-invoice"
  | "upload-photos"
  | "lightbox";

export type ModalEvent = { name: ModalName; data?: unknown };

const EVT = "studioos:modal";

export function openModal(name: ModalName, data?: unknown) {
  window.dispatchEvent(new CustomEvent<ModalEvent>(EVT, { detail: { name, data } }));
}

export function onModal(handler: (e: ModalEvent) => void) {
  const fn = (e: Event) => handler((e as CustomEvent<ModalEvent>).detail);
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
