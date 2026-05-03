const bridge = window.agentDesktop;

const elements = {
  deviceName: document.getElementById("deviceName"),
  terminalToggle: document.getElementById("terminalToggle"),
  statusDot: document.getElementById("statusDot"),
  connectionStatus: document.getElementById("connectionStatus"),
  statusMessage: document.getElementById("statusMessage"),
  pairingExpiry: document.getElementById("pairingExpiry"),
  pairingQr: document.getElementById("pairingQr"),
  qrEmpty: document.getElementById("qrEmpty"),
  pairingCode: document.getElementById("pairingCode"),
  deviceId: document.getElementById("deviceId"),
  serverUrl: document.getElementById("serverUrl"),
  shell: document.getElementById("shell"),
  requestPanel: document.getElementById("requestPanel"),
  requestTitle: document.getElementById("requestTitle"),
  requestMeta: document.getElementById("requestMeta"),
  rejectPairing: document.getElementById("rejectPairing"),
  approvePairing: document.getElementById("approvePairing")
};

function setText(element, value) {
  element.textContent = value || "-";
}

function render(state) {
  setText(elements.deviceName, state.deviceName);
  elements.terminalToggle.checked = Boolean(state.terminalEnabled);
  elements.statusDot.dataset.status = state.connectionStatus;
  setText(elements.connectionStatus, state.connectionStatus);
  setText(elements.statusMessage, state.statusMessage);
  setText(elements.deviceId, state.deviceId);
  setText(elements.serverUrl, state.serverUrl);
  setText(elements.shell, state.shell);

  if (state.pairingQrDataUrl) {
    elements.pairingQr.src = state.pairingQrDataUrl;
    elements.pairingQr.classList.remove("hidden");
    elements.qrEmpty.classList.add("hidden");
  } else {
    elements.pairingQr.removeAttribute("src");
    elements.pairingQr.classList.add("hidden");
    elements.qrEmpty.classList.remove("hidden");
  }

  setText(elements.pairingCode, state.pairingCode || "------");
  setText(elements.pairingExpiry, state.pairingExpiresAt ? `Expires ${state.pairingExpiresAt}` : "No active code");

  if (state.pendingPairingRequest) {
    elements.requestPanel.classList.remove("hidden");
    setText(elements.requestTitle, `${state.pendingPairingRequest.mobileName} wants to pair`);
    setText(
      elements.requestMeta,
      `${state.pendingPairingRequest.mobileClientId} / ${state.pendingPairingRequest.requestedAt}`
    );
  } else {
    elements.requestPanel.classList.add("hidden");
  }
}

elements.terminalToggle.addEventListener("change", () => {
  bridge.setTerminalEnabled(elements.terminalToggle.checked).then(render);
});

elements.approvePairing.addEventListener("click", () => {
  bridge.approvePairing().then(render);
});

elements.rejectPairing.addEventListener("click", () => {
  bridge.rejectPairing().then(render);
});

bridge.getState().then(render);
bridge.onState(render);
