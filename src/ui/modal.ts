// 通用结果弹窗：搁浅/通关共用，样式随交易面板的玻璃拟态语言
let modalEl: HTMLDivElement | null = null;

export function showModal(options: {
  eyebrow: string;
  title: string;
  lines: string[];
  buttonText: string;
  onClose?: () => void;
}) {
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "game-modal";
    modalEl.className = "trade-panel game-modal";
    document.body.appendChild(modalEl);
  }
  modalEl.innerHTML = `
    <div class="trade-head">
      <div>
        <p class="trade-eyebrow">${options.eyebrow}</p>
        <p class="modal-title">${options.title}</p>
      </div>
    </div>
    ${options.lines.map((line) => `<p class="modal-line">${line}</p>`).join("")}
    <button class="modal-button">${options.buttonText}</button>`;
  modalEl.hidden = false;
  const button = modalEl.querySelector<HTMLButtonElement>(".modal-button");
  button?.addEventListener(
    "click",
    () => {
      if (modalEl) modalEl.hidden = true;
      options.onClose?.();
    },
    { once: true },
  );
}

export function isModalOpen() {
  return Boolean(modalEl && !modalEl.hidden);
}
