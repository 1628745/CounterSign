import { create } from "zustand";
import type { ClientEvent, InboxEmailDTO, Mode, PaymentDetailDTO, ProvenanceHitDTO, RunMoneyStatDTO, WalletDTO } from "./types";

export interface TraceInfo {
  address: string;
  firstHit: ProvenanceHitDTO | null;
}

export type RunStatus = "idle" | "running" | "completed" | "failed";

interface MissionControlState {
  pack: string;
  inbox: InboxEmailDTO[];
  inboxLoaded: boolean;

  guardOn: boolean;
  mode: Mode | null;
  runId: string | null;
  runStatus: RunStatus;
  runSummary: string | null;

  events: ClientEvent[];
  payments: Record<string, PaymentDetailDTO>;

  wallets: WalletDTO[];
  recentRuns: RunMoneyStatDTO[];
  walletsLoaded: boolean;

  announcement: string;
  error: string | null;
  connectionDegraded: boolean;

  approverName: string;
  trace: TraceInfo | null;
  tracedPinned: boolean;
  presenterMode: boolean;
  shortcutsOpen: boolean;

  loadInbox: () => Promise<void>;
  startApprovalWatcher: () => void;
  setGuardOn: (on: boolean) => void;
  runInbox: () => Promise<void>;
  resetDemo: () => Promise<void>;
  fetchWallets: () => Promise<void>;
  fetchPayment: (paymentId: string) => Promise<void>;
  announce: (sentence: string) => void;
  clearError: () => void;
  setApproverName: (name: string) => void;
  hoverTrace: (info: TraceInfo) => void;
  unhoverTrace: () => void;
  pinTrace: (info: TraceInfo) => void;
  clearTrace: () => void;
  togglePresenterMode: () => void;
  setShortcutsOpen: (open: boolean) => void;
}

let sseAbort: AbortController | null = null;
let walletPollHandle: ReturnType<typeof setInterval> | null = null;
let approvalWatcherHandle: ReturnType<typeof setInterval> | null = null;
let eventFallbackHandle: ReturnType<typeof setInterval> | null = null;
let lastSeqSeen = "-1";

/** Stops loops tied to one specific run (wallet polling, SSE fallback). The approval
 * watcher is intentionally NOT stopped here — see startApprovalWatcher below: a human
 * approving on their phone routinely takes longer than the agent's own run does, so
 * polling for approval resolutions must outlive the run that created them. */
function stopRunLoops(): void {
  if (walletPollHandle) clearInterval(walletPollHandle);
  if (eventFallbackHandle) clearInterval(eventFallbackHandle);
  walletPollHandle = null;
  eventFallbackHandle = null;
}

function decisionSentenceFromEvent(event: ClientEvent): string | null {
  switch (event.kind) {
    case "tx_confirmed":
      return "Confirmed on Solana.";
    case "payment_blocked":
      return "Blocked before it reached Solana.";
    case "approval_resolved": {
      const status = event.payload.status;
      if (status === "approved") return "Approved.";
      if (status === "denied") return "Declined.";
      if (status === "expired") return "Approval expired.";
      return null;
    }
    default:
      return null;
  }
}

export const useMissionControlStore = create<MissionControlState>((set, get) => ({
  pack: "demo",
  inbox: [],
  inboxLoaded: false,

  guardOn: true,
  mode: null,
  runId: null,
  runStatus: "idle",
  runSummary: null,

  events: [],
  payments: {},

  wallets: [],
  recentRuns: [],
  walletsLoaded: false,

  announcement: "",
  error: null,
  connectionDegraded: false,

  approverName: "",
  trace: null,
  tracedPinned: false,
  presenterMode: false,
  shortcutsOpen: false,

  announce: (sentence) => set({ announcement: sentence }),
  clearError: () => set({ error: null }),
  setApproverName: (name) => set({ approverName: name }),
  hoverTrace: (info) => {
    if (!get().tracedPinned) set({ trace: info });
  },
  unhoverTrace: () => {
    if (!get().tracedPinned) set({ trace: null });
  },
  pinTrace: (info) => set({ trace: info, tracedPinned: true }),
  clearTrace: () => set({ trace: null, tracedPinned: false }),
  togglePresenterMode: () => set((state) => ({ presenterMode: !state.presenterMode })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  loadInbox: async () => {
    try {
      const res = await fetch(`/api/inbox?pack=${get().pack}`);
      if (!res.ok) throw new Error(`GET /api/inbox failed (${res.status})`);
      const data = await res.json();
      set({ inbox: data.emails, inboxLoaded: true });
    } catch {
      set({ error: "Couldn't load the inbox. It will appear once the server is reachable." });
    }
  },

  /** Runs for the lifetime of the page, independent of any single run — see stopRunLoops above. */
  startApprovalWatcher: () => {
    if (approvalWatcherHandle) return;
    approvalWatcherHandle = setInterval(() => pollApprovals(get), 2000);
  },

  fetchWallets: async () => {
    try {
      const res = await fetch("/api/wallets");
      if (!res.ok) throw new Error(`GET /api/wallets failed (${res.status})`);
      const data = await res.json();
      set({ wallets: data.wallets, recentRuns: data.recentRuns, walletsLoaded: true });
    } catch {
      set({ error: "Couldn't reach Solana devnet. Balances will refresh when it's back." });
    }
  },

  fetchPayment: async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`);
      if (!res.ok) return;
      const data: PaymentDetailDTO = await res.json();
      set((state) => ({ payments: { ...state.payments, [paymentId]: data } }));
    } catch {
      // Transient — the next poll tick or event will retry.
    }
  },

  setGuardOn: (on) => set({ guardOn: on }),

  resetDemo: async () => {
    stopRunLoops();
    sseAbort?.abort();
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) throw new Error(`POST /api/demo/reset failed (${res.status})`);
    } catch {
      set({ error: "Couldn't reset the demo. Try again in a moment." });
      return;
    }
    set({
      mode: null,
      runId: null,
      runStatus: "idle",
      runSummary: null,
      events: [],
      payments: {},
      announcement: "Demo reset.",
    });
    await get().fetchWallets();
  },

  runInbox: async () => {
    const state = get();
    if (state.runStatus === "running") return;

    stopRunLoops();
    const mode: Mode = state.guardOn ? "guarded" : "naive";
    lastSeqSeen = "-1";
    set({ mode, runId: null, runStatus: "running", runSummary: null, events: [], payments: {}, error: null, announcement: "Inbox run started." });

    sseAbort = new AbortController();
    let runId: string | null = null;

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, pack: state.pack }),
        signal: sseAbort.signal,
      });
      if (!res.ok || !res.body) throw new Error(`POST /api/runs failed (${res.status})`);

      runId = res.headers.get("x-run-id");
      if (runId) set({ runId });

      walletPollHandle = setInterval(() => get().fetchWallets(), 3000);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let frameEnd = buffer.indexOf("\n\n");
        while (frameEnd !== -1) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);
          handleSseFrame(frame, get, set);
          frameEnd = buffer.indexOf("\n\n");
        }
      }
    } catch {
      if (get().runStatus === "running" && !sseAbort?.signal.aborted) {
        set({ connectionDegraded: true });
        if (runId) startEventFallbackPolling(runId, get, set);
      }
    } finally {
      const finished = get().runStatus !== "running";
      if (finished) {
        stopRunLoops();
        await get().fetchWallets();
      }
    }
  },
}));

function handleSseFrame(frame: string, get: () => MissionControlState, set: (partial: Partial<MissionControlState>) => void): void {
  const lines = frame.split("\n");
  let eventName: string | null = null;
  let dataLine: string | null = null;
  for (const line of lines) {
    if (line.startsWith("event: ")) eventName = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataLine = line.slice(6);
  }
  if (!dataLine) return;

  if (eventName === "run_id") {
    const parsed: { runId: string } = JSON.parse(dataLine);
    set({ runId: parsed.runId });
    return;
  }

  applyEvent(JSON.parse(dataLine), get, set);
}

function applyEvent(event: ClientEvent, get: () => MissionControlState, set: (partial: Partial<MissionControlState>) => void): void {
  lastSeqSeen = event.seq;
  set({ events: [...get().events, event] });

  if (event.kind === "run_finished") {
    const status = event.payload.status === "completed" ? "completed" : "failed";
    const summary = typeof event.payload.summary === "string" ? event.payload.summary : null;
    set({ runStatus: status, runSummary: summary });
  }

  if (event.paymentId && ["payment_proposed", "risk_scored", "approval_requested", "approval_resolved", "tx_submitted", "tx_confirmed", "payment_blocked"].includes(event.kind)) {
    get().fetchPayment(event.paymentId);
  }

  const sentence = decisionSentenceFromEvent(event);
  if (sentence) get().announce(sentence);
}

async function pollApprovals(get: () => MissionControlState): Promise<void> {
  try {
    const res = await fetch("/api/approvals/poll", { method: "POST" });
    if (!res.ok) return;
    const data: { advances: { approvalId: string; paymentId: string; status: string }[] } = await res.json();
    let anyResolved = false;
    for (const advance of data.advances) {
      if (advance.status !== "pending") {
        anyResolved = true;
        get().fetchPayment(advance.paymentId);
      }
    }
    // A resolved approval may have just paid out — refresh balances even
    // though the run that requested it (if any) finished long ago.
    if (anyResolved) get().fetchWallets();
  } catch {
    // Next tick retries.
  }
}

function startEventFallbackPolling(runId: string, get: () => MissionControlState, set: (partial: Partial<MissionControlState>) => void): void {
  if (eventFallbackHandle) return;
  eventFallbackHandle = setInterval(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}/events?after=${lastSeqSeen}`);
      if (!res.ok) return;
      const data: { events: ClientEvent[] } = await res.json();
      for (const event of data.events) {
        applyEvent(event, get, set);
      }
      if (data.events.length > 0) set({ connectionDegraded: false });
    } catch {
      // Keep trying.
    }
  }, 2000);
}

export function abortActiveRun(): void {
  sseAbort?.abort();
  stopRunLoops();
}
