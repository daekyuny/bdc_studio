import { dom } from "./dom.ts";

export interface ImportConfirmOptions {
  title: string;
  message: string;
  subtext?: string;
  okLabel?: string;
  hideCancel?: boolean;
}

export const showImportConfirm = ({
  title,
  message,
  subtext = "",
  okLabel = "Proceed",
  hideCancel = false,
}: ImportConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => {
    dom.importConfirmTitle.textContent = title;
    dom.importConfirmMessage.innerHTML = message;
    dom.importConfirmSubtext.textContent = subtext;
    dom.importConfirmSubtext.hidden = !subtext;
    dom.importConfirmOk.textContent = okLabel;
    dom.importConfirmCancel.hidden = hideCancel;
    dom.importConfirmModal.hidden = false;

    const cleanup = (): void => {
      dom.importConfirmModal.hidden = true;
      dom.importConfirmCancel.hidden = false;
      dom.importConfirmOk.removeEventListener("click", onOk);
      dom.importConfirmCancel.removeEventListener("click", onCancel);
    };
    const onOk = (): void => { cleanup(); resolve(true); };
    const onCancel = (): void => { cleanup(); resolve(false); };
    dom.importConfirmOk.addEventListener("click", onOk);
    dom.importConfirmCancel.addEventListener("click", onCancel);
  });
