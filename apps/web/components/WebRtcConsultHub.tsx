"use client";

import { useState, useEffect, useRef } from "react";
import { getMqttClient, subscribeJson, publishJson } from "@/lib/mqtt";
import {
  topics,
  createDedupe,
  type WebRtcOfferMessage,
  type WebRtcAnswerMessage,
  type WebRtcIceMessage,
  type NetworkStatusMessage,
  type NetworkTier,
} from "@vaidhya/shared";
import {
  RTC_CONFIG,
  getUserMediaStream,
  getNetworkMetrics,
  applyNetworkTierParameters,
  type NetworkStats,
} from "@/lib/webrtc";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Wifi,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface WebRtcConsultHubProps {
  visitId: string;
  role: "doctor" | "patient";
  userId: string;
}

export function WebRtcConsultHub({ visitId, role, userId }: WebRtcConsultHubProps) {
  const [callState, setCallState] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    tier: "high",
    rttMs: 45,
    packetLossPercent: 0,
    bitrateKbps: 1200,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);

  // Setup MQTT signaling listener & RTCPeerConnection
  useEffect(() => {
    const client = getMqttClient(userId);
    if (!client) return;

    const isDup = createDedupe(200);

    // Listen for WebRTC Offer
    const unsubOffer = subscribeJson<WebRtcOfferMessage>(
      client,
      topics.webrtcOffer(visitId),
      async (payload) => {
        if (payload.sender === role || isDup(JSON.stringify(payload.sdp))) return;
        await handleReceivedOffer(payload.sdp);
      }
    );

    // Listen for WebRTC Answer
    const unsubAnswer = subscribeJson<WebRtcAnswerMessage>(
      client,
      topics.webrtcAnswer(visitId),
      async (payload) => {
        if (payload.sender === role || isDup(JSON.stringify(payload.sdp))) return;
        await handleReceivedAnswer(payload.sdp);
      }
    );

    // Listen for ICE Candidates
    const unsubIce = subscribeJson<WebRtcIceMessage>(
      client,
      topics.webrtcIce(visitId),
      async (payload) => {
        if (payload.sender === role || isDup(JSON.stringify(payload.candidate))) return;
        await handleReceivedIceCandidate(payload.candidate);
      }
    );

    // Listen for peer network status
    const unsubNetwork = subscribeJson<NetworkStatusMessage>(
      client,
      topics.networkStatus(visitId),
      (payload) => {
        if (payload.sender !== role) {
          setNetworkStats((prev) => ({
            ...prev,
            tier: payload.tier,
            rttMs: payload.rttMs,
            packetLossPercent: payload.packetLossPercent,
          }));
          // Adapt outgoing local stream bitrate to match the peer's reported network tier
          if (pcRef.current) {
            applyNetworkTierParameters(pcRef.current, payload.tier);
          }
        }
      }
    );

    return () => {
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubNetwork();
    };
  }, [visitId, role, userId]);

  // Periodic Network Telemetry Monitor
  useEffect(() => {
    if (callState !== "connected" || !pcRef.current) return;

    const interval = setInterval(async () => {
      if (!pcRef.current) return;
      const stats = await getNetworkMetrics(pcRef.current);
      setNetworkStats(stats);

      // Adapt outgoing local stream bitrate to match our local network capability
      if (stats.tier !== "high") {
        applyNetworkTierParameters(pcRef.current, stats.tier);
      }

      // Publish network telemetry to peer over MQTT
      const client = getMqttClient(userId);
      if (client) {
        const statusMsg: NetworkStatusMessage = {
          sender: role,
          tier: stats.tier,
          rttMs: stats.rttMs,
          packetLossPercent: stats.packetLossPercent,
          timestamp: new Date().toISOString(),
        };
        publishJson(client, topics.networkStatus(visitId), statusMsg);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [callState, videoEnabled, visitId, role, userId]);

  const initPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const client = getMqttClient(userId);
        if (client) {
          const iceMsg: WebRtcIceMessage = {
            sender: role,
            candidate: event.candidate.toJSON(),
            timestamp: new Date().toISOString(),
          };
          publishJson(client, topics.webrtcIce(visitId), iceMsg);
        }
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setCallState("idle");
      }
    };

    pcRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    setErrorMessage(null);
    setCallState("connecting");

    const { stream, error } = await getUserMediaStream(true, true);
    if (error) setErrorMessage(error);

    if (stream) {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }

    const pc = initPeerConnection();

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      const client = getMqttClient(userId);
      if (client) {
        const offerMsg: WebRtcOfferMessage = {
          sender: role,
          sdp: offer,
          timestamp: new Date().toISOString(),
        };
        publishJson(client, topics.webrtcOffer(visitId), offerMsg);
      }
    } catch (err: any) {
      setErrorMessage("Failed to initiate WebRTC call offer");
      setCallState("idle");
    }
  };

  const handleReceivedOffer = async (sdp: RTCSessionDescriptionInit) => {
    setCallState("connecting");
    const { stream } = await getUserMediaStream(true, true);
    if (stream) {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }

    const pc = initPeerConnection();
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush queued ICE candidates
    while (iceCandidateQueue.current.length > 0) {
      const cand = iceCandidateQueue.current.shift();
      if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const client = getMqttClient(userId);
    if (client) {
      const answerMsg: WebRtcAnswerMessage = {
        sender: role,
        sdp: answer,
        timestamp: new Date().toISOString(),
      };
      publishJson(client, topics.webrtcAnswer(visitId), answerMsg);
    }
  };

  const handleReceivedAnswer = async (sdp: RTCSessionDescriptionInit) => {
    if (!pcRef.current) return;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

    while (iceCandidateQueue.current.length > 0) {
      const cand = iceCandidateQueue.current.shift();
      if (cand) await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
    }
  };

  const handleReceivedIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (pcRef.current && pcRef.current.remoteDescription) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      iceCandidateQueue.current.push(candidate);
    }
  };

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    setCallState("idle");
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const toggleVideoTrack = (forceState?: boolean) => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = forceState !== undefined ? forceState : !videoEnabled;
        videoTrack.enabled = nextState;
        setVideoEnabled(nextState);
      }
    }
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-white">
      {/* Network Adaptive Header Bar */}
      <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-teal-400 animate-pulse" />
          <span className="font-bold tracking-tight text-slate-200">
            WebRTC Live Tele-Consultation
          </span>
        </div>

        {/* Network Quality Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
              networkStats.tier === "high"
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                : networkStats.tier === "medium"
                ? "bg-amber-950/80 border-amber-800 text-amber-300"
                : "bg-rose-950/80 border-rose-800 text-rose-300"
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span className="capitalize">{networkStats.tier} Bandwidth</span>
            <span className="text-[9px] font-mono opacity-80">({networkStats.rttMs}ms)</span>
          </div>
        </div>
      </div>

      {/* Adaptive Mode Warning Banner */}
      {networkStats.tier !== "high" && (
        <div className="bg-amber-900/40 border-b border-amber-800/50 px-4 py-2 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {networkStats.tier === "medium"
              ? "Limited Network Bandwidth: Video quality has been automatically reduced."
              : "Poor Network Quality: Video quality severely reduced to maintain connection."}
          </span>
        </div>
      )}

      {/* Video Stream Stage */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Remote Video Stream */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${callState === "connected" ? "block" : "hidden"}`}
        />

        {/* Placeholder when Call is Idle or Connecting */}
        {callState !== "connected" && (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 shadow-inner">
              <Activity className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-200">
                {callState === "idle"
                  ? role === "doctor"
                    ? "Start Live Audio/Video Stream with Patient"
                    : "Waiting for Doctor to Connect Video..."
                  : "Establishing Encrypted Peer Connection..."}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                WebRTC media stream encrypted end-to-end via MQTT signaling & STUN.
              </p>
            </div>
            {role === "doctor" && callState === "idle" && (
              <button
                onClick={startCall}
                className="mt-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Start Video Consult</span>
              </button>
            )}
          </div>
        )}

        {/* Inset Local Video Stream */}
        <div className="absolute bottom-3 right-3 w-32 aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-[10px] font-semibold text-slate-400">
              Camera Off
            </div>
          )}
        </div>
      </div>

      {/* Control Action Toolbar */}
      <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Audio Mute Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              audioEnabled
                ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                : "bg-rose-950/80 border-rose-800 text-rose-300"
            }`}
            title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {audioEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioEnabled ? "Muted Off" : "Muted"}</span>
          </button>

          {/* Video Camera Toggle */}
          <button
            onClick={() => toggleVideoTrack()}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              videoEnabled
                ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                : "bg-rose-950/80 border-rose-800 text-rose-300"
            }`}
            title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}
          >
            {videoEnabled ? <Video className="w-4 h-4 text-teal-400" /> : <VideoOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{videoEnabled ? "Cam On" : "Cam Off"}</span>
          </button>
        </div>

        {/* End Call / Connect Action */}
        <div>
          {callState === "connected" ? (
            <button
              onClick={endCall}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Stream</span>
            </button>
          ) : (
            role === "doctor" && (
              <button
                onClick={startCall}
                disabled={callState === "connecting"}
                className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{callState === "connecting" ? "Connecting..." : "Connect Stream"}</span>
              </button>
            )
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/60 border-t border-rose-800 p-2.5 text-center text-xs text-rose-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
