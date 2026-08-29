"use client";

import type { NetworkTier } from "@vaidhya/shared";

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export interface MediaControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface NetworkStats {
  tier: NetworkTier;
  rttMs: number;
  packetLossPercent: number;
  bitrateKbps: number;
}

export async function getUserMediaStream(
  requestVideo = true,
  requestAudio = true
): Promise<{ stream: MediaStream | null; error: string | null }> {
  if (typeof window === "undefined" || !navigator.mediaDevices) {
    return { stream: null, error: "Media devices not supported in this environment" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: requestVideo
        ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { max: 24 } }
        : false,
      audio: requestAudio
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : false,
    });
    return { stream, error: null };
  } catch (err: any) {
    console.warn("[webrtc] Video/Audio access error, trying audio-only fallback...", err);
    if (requestVideo && requestAudio) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        return { stream: audioStream, error: "Camera unavailable, using audio only" };
      } catch (fallbackErr: any) {
        return { stream: null, error: fallbackErr?.message || "Microphone access denied" };
      }
    }
    return { stream: null, error: err?.message || "Media access denied" };
  }
}

export async function getNetworkMetrics(pc: RTCPeerConnection): Promise<NetworkStats> {
  let rttMs = 0;
  let packetLossPercent = 0;
  let bitrateKbps = 0;

  try {
    const stats = await pc.getStats();
    let packetsLost = 0;
    let packetsReceived = 0;

    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        if (report.currentRoundTripTime) {
          rttMs = Math.round(report.currentRoundTripTime * 1000);
        }
      }
      if (report.type === "inbound-rtp") {
        if (report.packetsLost) packetsLost += report.packetsLost;
        if (report.packetsReceived) packetsReceived += report.packetsReceived;
      }
    });

    const totalPackets = packetsLost + packetsReceived;
    if (totalPackets > 0) {
      packetLossPercent = Math.round((packetsLost / totalPackets) * 100);
    }
  } catch (err) {
    console.warn("[webrtc] Error reading stats:", err);
  }

  let tier: NetworkTier = "high";
  if (rttMs > 600 || packetLossPercent > 15) {
    tier = "low";
  } else if (rttMs > 250 || packetLossPercent > 5) {
    tier = "medium";
  }

  return {
    tier,
    rttMs,
    packetLossPercent,
    bitrateKbps,
  };
}

export async function applyNetworkTierParameters(pc: RTCPeerConnection, tier: NetworkTier) {
  const senders = pc.getSenders();
  const videoSender = senders.find((s) => s.track?.kind === "video");
  if (!videoSender) return;

  const params = videoSender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }

  if (tier === "high") {
    delete params.encodings[0].maxBitrate;
    params.encodings[0].scaleResolutionDownBy = 1;
  } else if (tier === "medium") {
    params.encodings[0].maxBitrate = 500000; // 500 kbps
    params.encodings[0].scaleResolutionDownBy = 2;
  } else {
    params.encodings[0].maxBitrate = 150000; // 150 kbps
    params.encodings[0].scaleResolutionDownBy = 4;
  }

  try {
    await videoSender.setParameters(params);
  } catch (err) {
    console.warn("[webrtc] Failed to apply network tier parameters:", err);
  }
}

