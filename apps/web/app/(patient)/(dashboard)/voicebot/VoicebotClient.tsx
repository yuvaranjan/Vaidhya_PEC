"use client";

import { useState, useRef, useEffect } from "react";
import { edgeApi, USE_MOCK_AI } from "@/lib/edgeApi";
import { WebRtcConsultHub } from "@/components/WebRtcConsultHub";
import type { Language, IntakeCompleteResponse, PendingFinding, ModelsResponse, HealthResponse, VitalReadingInput } from "@vaidhya/shared";
import {
  Sparkles,
  Mic,
  Square,
  Send,
  Globe,
  AlertCircle,
  CheckCircle2,
  Volume2,
  Bot,
  User,
  Activity,
  FileCheck,
  RefreshCw,
  Wifi,
  WifiOff,
  Cpu,
  Stethoscope,
  Thermometer,
  Heart,
  Wind,
  ShieldCheck,
  ArrowRight,
  Camera,
  X,
  Usb
} from "lucide-react";

type Turn = {
  role: "bot" | "patient" | "nurse" | "doctor" | "patient_to_doctor";
  textNative: string;
  textEn: string;
  audioUrl?: string;
};

const LANG_LABELS: Record<Language, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  ml: { name: "Malayalam", native: "മലയാളം" },
  ta: { name: "Tamil", native: "தமிழ்" },
  hi: { name: "Hindi", native: "हिंदी" },
};

export function VoicebotClient({
  initialVisitId,
  initialPatientId,
}: {
  initialVisitId?: string;
  initialPatientId?: string;
}) {
  const [visitId] = useState(() => initialVisitId || `demo_visit_${Math.random().toString(36).substring(2, 7)}`);
  const [patientId] = useState(() => initialPatientId || "pat_001");

  const [language, setLanguage] = useState<Language>("en");
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [vitalsSubmitted, setVitalsSubmitted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [nurseError, setNurseError] = useState<string | null>(null);

  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState<Turn[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [pendingFinding, setPendingFinding] = useState<PendingFinding | null>(null);
  const [intakeResult, setIntakeResult] = useState<IntakeCompleteResponse | null>(null);
  const [currentlyPlayingUrl, setCurrentlyPlayingUrl] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);

  const [isVisionActive, setIsVisionActive] = useState(false);
  const [visionStatus, setVisionStatus] = useState<"idle" | "processing" | "done">("idle");
  const [visionDescription, setVisionDescription] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionStream = useRef<MediaStream | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDoctorQuestionId = useRef<string | null>(null);

  const [isUsbConnecting, setIsUsbConnecting] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const isMeasuringRef = useRef<boolean>(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [measureProgress, setMeasureProgress] = useState(0);
  const [liveHr, setLiveHr] = useState<number | null>(null);
  const [liveSpo2, setLiveSpo2] = useState<number | null>(null);
  const [liveTemp, setLiveTemp] = useState<number | null>(null);

  const hrSamples = useRef<number[]>([]);
  const spo2Samples = useRef<number[]>([]);
  const lastTempRef = useRef<number | null>(null);

  const startMeasurement = () => {
    setIsMeasuring(true);
    isMeasuringRef.current = true;
    setTimeLeft(30);
    setMeasureProgress(0);
    setLiveHr(null);
    setLiveSpo2(null);
    setLiveTemp(null);
    hrSamples.current = [];
    spo2Samples.current = [];

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 1;
      setTimeLeft(30 - elapsed);
      setMeasureProgress((elapsed / 30) * 100);

      if (elapsed >= 30) {
        clearInterval(interval);

        setIsMeasuring(false);
        isMeasuringRef.current = false;

        // Average HR (excluding 0)
        const validHr = hrSamples.current.filter(v => v > 0);
        if (validHr.length > 0) {
          const avgHr = Math.round(validHr.reduce((a, b) => a + b, 0) / validHr.length);
          const el = document.getElementById("pulse") as HTMLInputElement;
          if (el) el.value = avgHr.toString();
        }

        // Average SpO2 (excluding 0)
        const validSpo2 = spo2Samples.current.filter(v => v > 0);
        if (validSpo2.length > 0) {
          const avgSpo2 = Math.round(validSpo2.reduce((a, b) => a + b, 0) / validSpo2.length);
          const el = document.getElementById("spo2") as HTMLInputElement;
          if (el) el.value = avgSpo2.toString();
        }

        // Use last valid temp
        if (lastTempRef.current !== null) {
          const el = document.getElementById("temperature") as HTMLInputElement;
          if (el) el.value = lastTempRef.current.toString();
        }
      }
    }, 1000);
  };


  const connectUsbMonitor = async () => {
    try {
      setIsUsbConnecting(true);
      const nav = navigator as any;
      if (!nav.serial) {
        alert("Web Serial API not supported in this browser. Please use Chrome or Edge.");
        setIsUsbConnecting(false);
        return;
      }

      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setUsbConnected(true);
      setIsUsbConnecting(false);

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const inputStream = decoder.readable;
      const reader = inputStream.getReader();

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            try {
              const trimmed = line.trim();
              if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;
              const data = JSON.parse(trimmed);
              if (data.hr !== undefined && Number(data.hr) > 0) {
                const hrVal = Number(data.hr);
                setLiveHr(hrVal);
                if (isMeasuringRef.current) {
                  hrSamples.current.push(hrVal);
                }
              }
              if (data.spo2 !== undefined && Number(data.spo2) > 0 && Number(data.spo2) <= 100) {
                const spo2Val = Number(data.spo2);
                setLiveSpo2(spo2Val);
                if (isMeasuringRef.current) {
                  spo2Samples.current.push(spo2Val);
                }
              }
              if (data.temp !== undefined && Number(data.temp) > 0) {
                const rawTemp = Number(data.temp);
                // Convert Celsius from DS18B20 to Fahrenheit
                const tempF = Number((rawTemp * 9 / 5 + 32).toFixed(1));
                setLiveTemp(tempF);
                lastTempRef.current = tempF;
              }
            } catch (e) { }
          }
        }
        if (done) {
          reader.releaseLock();
          break;
        }
      }
    } catch (err) {
      console.error("USB Error", err);
      setIsUsbConnecting(false);
      setUsbConnected(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isProcessing]);

  const checkHealthAndModels = async () => {
    try {
      const h = await edgeApi.health();
      setHealthStatus(h);
    } catch {
      setHealthStatus({ llm: "down", stt: "down", tts: "down", translate: "down", mqtt: "down" });
    }

    try {
      const m = await edgeApi.listModels();
      setModelsData(m);
      if (m.current) setSelectedModel(m.current);
    } catch {
      // Ignore model list failure if offline
    }
  };

  useEffect(() => {
    checkHealthAndModels();
    return () => {
      stopVisionCamera();
    };
  }, []);

  const startVisionCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      visionStream.current = stream;
      setIsVisionActive(true);
      setVisionStatus("idle");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access the camera for vision analysis.');
    }
  };

  const stopVisionCamera = () => {
    if (visionStream.current) {
      visionStream.current.getTracks().forEach(track => track.stop());
      visionStream.current = null;
    }
    setIsVisionActive(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !visionStream.current) return;

    setVisionStatus("processing");

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg');

    stopVisionCamera();
    setIsProcessing(true);

    try {
      const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'local-model',
          messages: [
            {
              role: "system",
              content: "You are an expert medical AI assistant. Analyze the provided image and give a detailed, medically-oriented description. Identify any visible conditions, anatomical structures, or abnormalities using precise medical terminology. Limit your description to 125 words maximum."
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Please analyze this image based on the system instructions. Strictly limit your response to a maximum of 125 words." },
                { type: "image_url", image_url: { url: imageDataUrl } }
              ]
            }
          ],
          temperature: 0.5,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        throw new Error('Failed to connect to LM Studio.');
      }

      const data = await response.json();
      const description = data.choices[0].message.content;
      setVisionDescription(description);

      setTranscript((prev) => [
        ...prev,
        {
          role: "nurse",
          textNative: `[Visual Analysis Uploaded] ${description}`,
          textEn: `[Visual Analysis Uploaded] ${description}`,
        }
      ]);

      const res = await edgeApi.voiceTurnText({
        visit_id: visitId,
        text_en: `Visual analysis of patient condition: ${description}. Please acknowledge this visual finding.`
      });

      const botText = res.bot_text_native || res.bot_text_en;
      if (botText) {
        setTranscript((prev) => [
          ...prev,
          {
            role: "bot",
            textNative: botText,
            textEn: res.bot_text_en || botText,
            audioUrl: res.bot_audio_url,
          },
        ]);
        if (res.bot_audio_url) playAudio(res.bot_audio_url);
      }

      if (res.intake_done || res.next_action === "complete_intake") {
        await finalizeIntake();
      }

    } catch (error: any) {
      console.error('Vision Analysis Error:', error);
      alert(`Vision analysis failed: ${error.message}`);
    } finally {
      setVisionStatus("done");
      setIsProcessing(false);
    }
  };

  // Autoplay first greeting audio as soon as session starts and initial bot turn is available
  useEffect(() => {
    if (isSessionStarted && transcript.length > 0 && transcript[0].audioUrl) {
      playAudio(transcript[0].audioUrl);
    }
  }, [isSessionStarted]);

  useEffect(() => {
    if (!isSessionStarted) return;

    const interval = setInterval(async () => {
      try {
        const state = await edgeApi.sessionState(visitId);
        if (state.pending_finding) {
          setPendingFinding(state.pending_finding);
        } else {
          setPendingFinding(null);
        }

        if (state.doctor_question && state.doctor_question.message_id !== lastDoctorQuestionId.current) {
          lastDoctorQuestionId.current = state.doctor_question.message_id;
          setTranscript((prev) => [
            ...prev,
            {
              role: "doctor",
              textNative: state.doctor_question!.text_native,
              textEn: state.doctor_question!.text_en,
              audioUrl: state.doctor_question!.audio_url,
            },
          ]);
          if (state.doctor_question.audio_url) {
            playAudio(state.doctor_question.audio_url);
          }
        }
      } catch {
        // Polling error silently swallowed
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isSessionStarted, visitId]);

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = e.target.value;
    if (!newModelId || !modelsData) return;

    const opt = modelsData.available.find((m) => m.id === newModelId);
    if (!opt) return;

    setIsSwitchingModel(true);
    try {
      await edgeApi.setModel({ model: opt.id, provider: opt.provider });
      setSelectedModel(opt.id);
      checkHealthAndModels();
    } catch (err) {
      console.error("Failed to set model:", err);
      alert("Failed to switch active model.");
    } finally {
      setIsSwitchingModel(false);
    }
  };

  const playAudio = (url: string) => {
    if (!url || !audioRef.current) return;
    const fullUrl = edgeApi.audioUrl(url);
    setCurrentlyPlayingUrl(url);
    audioRef.current.src = fullUrl;
    audioRef.current
      .play()
      .catch((e) => console.warn("Autoplay audio blocked or failed:", e));
  };

  const startSession = async (selectedLang: Language) => {
    setIsStarting(true);
    setLanguage(selectedLang);

    try {
      const res = await edgeApi.sessionStart({
        visit_id: visitId,
        patient_id: patientId,
        language: selectedLang,
      });

      const textEn = res.greeting_text_en || (res as any).bot_text_en || "Hello, I am Vaidhya. How can I help you today?";
      const textNative = res.greeting_text_native || (res as any).bot_text_native || textEn;
      const audioUrl = res.greeting_audio_url || (res as any).bot_audio_url || "";

      setIsSessionStarted(true);
      setTranscript([
        {
          role: "bot",
          textNative: textNative,
          textEn: textEn,
          audioUrl: audioUrl,
        },
      ]);

      if (audioUrl) {
        playAudio(audioUrl);
      }
    } catch (err) {
      console.error("Session start error:", err);
      setIsSessionStarted(true);
      setTranscript([
        {
          role: "bot",
          textNative: "Hello, I am Vaidhya Edge AI Assistant. How can I help you today?",
          textEn: "Hello, I am Vaidhya Edge AI Assistant. How can I help you today?",
        },
      ]);
    } finally {
      setIsStarting(false);
    }
  };

  const handleNurseStartSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStarting(true);
    setNurseError(null);

    // Pre-unlock audio element within user gesture event
    if (audioRef.current) {
      audioRef.current.load();
    }

    const formData = new FormData(e.currentTarget);
    const temperature = parseFloat(formData.get("temperature") as string || "98.6");
    const bloodPressure = ((formData.get("blood_pressure") as string) || "120/80").trim();
    const pulse = parseInt(formData.get("pulse") as string || "76", 10);
    const spo2 = parseInt(formData.get("spo2") as string || "98", 10);
    const respRate = parseInt(formData.get("respiratory_rate") as string || "16", 10);

    const readings: VitalReadingInput[] = [
      { type: "temperature", value_numeric: temperature, unit: "fahrenheit" },
      { type: "blood_pressure", value_text: bloodPressure },
      { type: "pulse", value_numeric: pulse },
      { type: "spo2", value_numeric: spo2 },
      { type: "respiratory_rate", value_numeric: respRate },
    ];

    try {
      // 1. Submit vitals baseline to edge service
      await edgeApi.vitals({
        visit_id: visitId,
        patient_id: patientId,
        phase: "pass_one_baseline",
        readings,
      });
      setVitalsSubmitted(true);

      // 2. Start session with nurse-selected language
      await startSession(language);
    } catch (err: any) {
      console.error("Nurse vitals submission error:", err);
      setNurseError(err.message || "Failed to submit vitals or initialize session.");
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        await handleVoiceTurn(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.current.start(200);
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access failed:", err);
      alert("Microphone access failed. Please ensure mic permission is granted, or use the typed response box below.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const handleVoiceTurn = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const res = await edgeApi.voiceTurn(visitId, audioBlob);

      const newTurns: Turn[] = [];
      const patientText = res.transcript_native || res.transcript_en;
      if (patientText) {
        newTurns.push({
          role: "patient",
          textNative: patientText,
          textEn: res.transcript_en || patientText,
        });
      }

      const botText = res.bot_text_native || res.bot_text_en;
      if (botText) {
        newTurns.push({
          role: "bot",
          textNative: botText,
          textEn: res.bot_text_en || botText,
          audioUrl: res.bot_audio_url,
        });
      }

      if (newTurns.length > 0) {
        setTranscript((prev) => [...prev, ...newTurns]);
      }

      if (res.bot_audio_url) {
        playAudio(res.bot_audio_url);
      }

      if (res.next_action === "request_nurse_finding" && res.pending_finding) {
        setPendingFinding(res.pending_finding);
      }

      // Automatically send triage report to doctor when intake completed by bot
      if (res.intake_done || res.next_action === "complete_intake") {
        await finalizeIntake();
      }
    } catch (err) {
      console.error("Voice turn error:", err);
      setTranscript((prev) => [
        ...prev,
        {
          role: "bot",
          textNative: "I heard your audio. (Backend edge service connection issue detected).",
          textEn: "I heard your audio. (Backend edge service connection issue detected).",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing || !!pendingFinding) return;

    const userText = textInput.trim();
    setTextInput("");
    setIsProcessing(true);

    try {
      const res = await edgeApi.voiceTurnText({ visit_id: visitId, text_en: userText });

      const botText = res.bot_text_native || res.bot_text_en;
      setTranscript((prev) => [
        ...prev,
        { role: "patient", textNative: userText, textEn: userText },
        ...(botText
          ? [
            {
              role: "bot" as const,
              textNative: botText,
              textEn: res.bot_text_en || botText,
              audioUrl: res.bot_audio_url,
            },
          ]
          : []),
      ]);

      if (res.bot_audio_url) {
        playAudio(res.bot_audio_url);
      }

      if (res.next_action === "request_nurse_finding" && res.pending_finding) {
        setPendingFinding(res.pending_finding);
      }

      if (res.intake_done || res.next_action === "complete_intake") {
        await finalizeIntake();
      }
    } catch (err) {
      console.error("Text turn error:", err);
      setTranscript((prev) => [
        ...prev,
        { role: "patient", textNative: userText, textEn: userText },
        {
          role: "bot",
          textNative: "Processed your input. Ensure the Local Edge AI backend is running on port 8000.",
          textEn: "Processed your input. Ensure the Local Edge AI backend is running on port 8000.",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNurseFindingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingFinding || isProcessing) return;

    const formData = new FormData(e.currentTarget);
    const val = formData.get("finding_value") as string;
    const currentFinding = pendingFinding;

    setPendingFinding(null);
    setIsProcessing(true);

    try {
      await edgeApi.submitFinding({
        visit_id: visitId,
        phase: "on_demand",
        readings: [{ type: currentFinding.type, value_text: val }],
      });

      const nursePrompt = `Nurse examination finding for '${currentFinding.type}': ${val}. Please acknowledge this finding to the patient and ask your next question or complete intake.`;
      const res = await edgeApi.voiceTurnText({ visit_id: visitId, text_en: nursePrompt });

      const botText = res.bot_text_native || res.bot_text_en;
      setTranscript((prev) => [
        ...prev,
        {
          role: "nurse",
          textNative: `Exam Finding (${currentFinding.type}): ${val}`,
          textEn: `Exam Finding (${currentFinding.type}): ${val}`,
        },
        ...(botText
          ? [
            {
              role: "bot" as const,
              textNative: botText,
              textEn: res.bot_text_en || botText,
              audioUrl: res.bot_audio_url,
            },
          ]
          : []),
      ]);

      if (res.bot_audio_url) {
        playAudio(res.bot_audio_url);
      }

      if (res.next_action === "request_nurse_finding" && res.pending_finding) {
        setPendingFinding(res.pending_finding);
      }

      if (res.intake_done || res.next_action === "complete_intake") {
        await finalizeIntake();
      }
    } catch (err) {
      console.error("Nurse finding submit error:", err);
      alert("Failed to submit nurse finding.");
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeIntake = async () => {
    setIsFinalizing(true);
    try {
      const res = await edgeApi.intakeComplete(visitId);
      setIntakeResult(res);
    } catch (err) {
      console.error("Finalize intake error:", err);
      alert("Could not finalize intake. Make sure edge-ai service is active.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Hidden Audio Element mounted at root level for seamless autoplay */}
      <audio ref={audioRef} className="hidden" onEnded={() => setCurrentlyPlayingUrl(null)} />

      {/* NURSE SETUP SCREEN: Before session starts */}
      {!isSessionStarted ? (
        <div className="w-full max-w-3xl mx-auto space-y-6">
          {/* Header Banner */}
          <div className="bg-primary text-primary-foreground rounded-2xl p-6 sm:p-8 shadow-soft border border-border relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-accent">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Step 1: Nurse Triage & Setup</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Patient Intake & Baseline Vitals
              </h1>
              <p className="text-xs sm:text-sm text-white/80 max-w-xl">
                Select the patient&apos;s preferred consultation language and record baseline physiological readings before initiating the AI Voicebot conversation.
              </p>
            </div>
          </div>

          {/* Main Setup Form Card */}
          <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-soft border border-border">
            <form onSubmit={handleNurseStartSubmit} className="space-y-8">
              {nurseError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                  {nurseError}
                </div>
              )}

              {/* Section 1: Language Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent" />
                    <span>1. Select Patient Language</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["en", "ml", "ta", "hi"] as Language[]).map((lang) => {
                    const isSelected = language === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${isSelected
                            ? "bg-secondary border-accent shadow-sm ring-2 ring-accent/30"
                            : "bg-background border-border hover:border-accent/40"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {lang.toUpperCase()}
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                              ✓
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-base font-bold text-foreground">{LANG_LABELS[lang].native}</p>
                          <p className="text-xs text-muted-foreground">{LANG_LABELS[lang].name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Baseline Vitals Entry */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent" />
                    <span>2. Record Baseline Vitals</span>
                  </label>
                  <button
                    type="button"
                    onClick={usbConnected ? startMeasurement : connectUsbMonitor}
                    disabled={isUsbConnecting || isMeasuring}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      usbConnected
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                        : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
                    }`}
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>{isUsbConnecting ? "Connecting..." : usbConnected ? (isMeasuring ? `Measuring (${timeLeft}s)...` : "Measure (30s)") : "Connect USB Monitor"}</span>
                  </button>
                </div>

                {usbConnected && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Hardware Sensor Connected {isMeasuring && `(Measuring: ${timeLeft}s remaining)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (liveHr) {
                            const el = document.getElementById("pulse") as HTMLInputElement;
                            if (el) el.value = String(liveHr);
                          }
                          if (liveSpo2) {
                            const el = document.getElementById("spo2") as HTMLInputElement;
                            if (el) el.value = String(liveSpo2);
                          }
                          if (liveTemp) {
                            const el = document.getElementById("temperature") as HTMLInputElement;
                            if (el) el.value = String(liveTemp);
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-bold hover:bg-emerald-700 transition-all text-[11px]"
                      >
                        Apply Live Readings
                      </button>
                    </div>

                    {isMeasuring && (
                      <div className="w-full bg-emerald-200/50 dark:bg-emerald-950/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${measureProgress}%` }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="p-2 bg-background rounded-lg border border-border">
                        <span className="text-[10px] text-muted-foreground block font-semibold">Pulse</span>
                        <span className="text-sm font-bold text-destructive">{liveHr ? `${liveHr} bpm` : "Place finger..."}</span>
                      </div>
                      <div className="p-2 bg-background rounded-lg border border-border">
                        <span className="text-[10px] text-muted-foreground block font-semibold">SpO2</span>
                        <span className="text-sm font-bold text-accent">{liveSpo2 ? `${liveSpo2}%` : "Place finger..."}</span>
                      </div>
                      <div className="p-2 bg-background rounded-lg border border-border">
                        <span className="text-[10px] text-muted-foreground block font-semibold">Body Temp</span>
                        <span className="text-sm font-bold text-foreground">{liveTemp ? `${liveTemp}°F` : "--"}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="temperature" className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-accent" /> Temperature (°F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      id="temperature"
                      name="temperature"
                      required
                      defaultValue="98.6"
                      className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      placeholder="98.6"
                    />
                  </div>

                  <div>
                    <label htmlFor="blood_pressure" className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-accent" /> Blood Pressure (mmHg)
                    </label>
                    <input
                      type="text"
                      id="blood_pressure"
                      name="blood_pressure"
                      required
                      defaultValue="120/80"
                      pattern="\d{2,3}/\d{2,3}"
                      title="Format: 120/80"
                      className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      placeholder="120/80"
                    />
                  </div>

                  <div>
                    <label htmlFor="pulse" className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-destructive" /> Pulse Rate (bpm)
                    </label>
                    <input
                      type="number"
                      id="pulse"
                      name="pulse"
                      required
                      defaultValue="76"
                      className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      placeholder="76"
                    />
                  </div>

                  <div>
                    <label htmlFor="spo2" className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-accent" /> SpO2 Saturation (%)
                    </label>
                    <input
                      type="number"
                      id="spo2"
                      name="spo2"
                      required
                      min="0"
                      max="100"
                      defaultValue="98"
                      className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      placeholder="98"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="respiratory_rate" className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-accent" /> Respiratory Rate (breaths/min)
                  </label>
                  <input
                    type="number"
                    id="respiratory_rate"
                    name="respiratory_rate"
                    required
                    defaultValue="16"
                    className="w-full h-11 px-3.5 border border-border rounded-lg bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    placeholder="16"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={isStarting}
                  className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-soft disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isStarting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                      <span>Submitting Vitals & Initializing AI...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Vitals & Launch AI Voicebot Conversation</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* MEASUREMENT MODAL */}
              {isMeasuring && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-border bg-muted/30">
                      <h2 className="text-xl font-bold text-foreground">Capturing Vitals...</h2>
                      <p className="text-sm text-muted-foreground mt-1">Please keep your finger steady on the sensor.</p>
                    </div>

                    {/* Live Waveform Area (Simulated) */}
                    <div className="h-32 bg-[#0A192F] relative overflow-hidden flex items-center justify-center border-y border-border">
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                      <div className="flex items-center text-[#00FFCC] animate-pulse">
                        <Activity className="w-16 h-16" />
                      </div>
                    </div>

                    {/* Live Stats */}
                    <div className="grid grid-cols-3 divide-x divide-border bg-card">
                      <div className="p-6 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><Heart className="w-3 h-3 text-destructive" /> Heart Rate</span>
                        <span className="text-4xl font-bold text-foreground">{liveHr !== null ? liveHr : "--"}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">bpm</span>
                      </div>
                      <div className="p-6 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-[#00FFCC]" /> SpO2</span>
                        <span className="text-4xl font-bold text-foreground">{liveSpo2 !== null ? liveSpo2 : "--"}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">%</span>
                      </div>
                      <div className="p-6 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><Thermometer className="w-3 h-3 text-amber-500" /> Temp</span>
                        <span className="text-4xl font-bold text-foreground">{liveTemp !== null ? liveTemp : "--"}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">°F</span>
                      </div>
                    </div>

                    {/* Progress Bar & Footer */}
                    <div className="p-6 border-t border-border bg-muted/30">
                      <div className="flex items-center justify-between text-xs font-bold mb-2">
                        <span className="text-accent">Averaging readings...</span>
                        <span className="text-foreground">{timeLeft}s remaining</span>
                      </div>
                      <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-1000 ease-linear"
                          style={{ width: `${measureProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* ACTIVE VOICEBOT CONVERSATION SCREEN */
        <div className="space-y-6">
          {/* Light Theme Navy Header Card */}
          <div className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-soft border border-border relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-accent/20 text-accent rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Local Edge AI Hub</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Clinical Voicebot Assistant
                </h1>
                <p className="text-xs text-white/80 flex items-center gap-2">
                  <span>Offline-capable AI intake • Speech-to-Text & Neural TTS</span>
                  {vitalsSubmitted && (
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Vitals Logged
                    </span>
                  )}
                </p>
              </div>

              {/* Engine Status & Controls */}
              <div className="flex flex-wrap items-center gap-3">

                {/* Edge AI Health Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl border border-white/15 text-xs text-white">
                  {healthStatus?.llm === "ok" ? (
                    <Wifi className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-300" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/70 uppercase font-semibold">Edge AI Node</span>
                    <span className="font-bold">
                      {USE_MOCK_AI ? "Mock Mode" : healthStatus?.llm === "ok" ? "Online (:8000)" : "Connecting..."}
                    </span>
                  </div>
                </div>

                {/* Model Selector */}
                {modelsData && modelsData.available.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl border border-white/15 text-xs text-white">
                    <Cpu className="w-4 h-4 text-accent" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/70 uppercase font-semibold">Active Model</span>
                      <select
                        value={selectedModel}
                        onChange={handleModelChange}
                        disabled={isSwitchingModel}
                        className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
                      >
                        {modelsData.available.map((m) => (
                          <option key={m.id} value={m.id} className="bg-primary text-white">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Language Selector */}
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
                  {(["en", "ml", "ta", "hi"] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        if (!isSessionStarted) {
                          startSession(lang);
                        } else {
                          setLanguage(lang);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${language === lang
                          ? "bg-accent text-white shadow-sm"
                          : "text-white/80 hover:bg-white/10"
                        }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>

              </div>

            </div>
          </div>

          {/* Workspace Main Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Main Chat Panel */}
            <div className={`${intakeResult ? "lg:col-span-7" : "lg:col-span-12"} bg-card rounded-xl shadow-soft border border-border flex flex-col h-[680px] overflow-hidden`}>

              {/* Sub-header Bar */}
              <div className="px-6 py-3 bg-secondary border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Stethoscope className="w-4 h-4 text-accent" />
                  <span>Visit ID: <code className="font-mono text-accent font-bold bg-background px-2 py-0.5 rounded border border-border">{visitId}</code></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={checkHealthAndModels}
                    title="Refresh health status"
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-card transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => finalizeIntake()}
                    disabled={isFinalizing || transcript.length === 0}
                    className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{isFinalizing ? "Generating..." : "Finalize Report"}</span>
                  </button>
                </div>
              </div>

              {/* Active Chat Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
                {transcript.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${turn.role === "patient" || turn.role === "patient_to_doctor" ? "items-end" : "items-start"
                      }`}
                  >
                    {/* Speaker Badge */}
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                      {turn.role === "bot" && <Bot className="w-3.5 h-3.5 text-accent" />}
                      {turn.role === "patient" && <User className="w-3.5 h-3.5 text-primary" />}
                      {turn.role === "patient_to_doctor" && <Stethoscope className="w-3.5 h-3.5 text-accent" />}
                      {turn.role === "nurse" && <Activity className="w-3.5 h-3.5 text-purple-600" />}
                      {turn.role === "doctor" && <Stethoscope className="w-3.5 h-3.5 text-teal-700" />}
                      <span>
                        {turn.role === "bot"
                          ? "Vaidhya AI Assistant"
                          : turn.role === "patient_to_doctor"
                            ? "Patient Reply (To Doctor)"
                            : turn.role === "patient"
                              ? "Patient Response"
                              : turn.role === "nurse"
                                ? "Nurse Input"
                                : "Doctor Question"}
                      </span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] sm:max-w-[78%] px-4 py-3 leading-relaxed text-sm shadow-sm ${turn.role === "patient" || turn.role === "patient_to_doctor"
                          ? "bg-primary text-primary-foreground rounded-xl rounded-tr-sm border border-accent/30"
                          : turn.role === "bot"
                            ? "bg-card border border-border text-foreground rounded-xl rounded-tl-sm"
                            : turn.role === "nurse"
                              ? "bg-[#F4F0FB] border border-[#E4D9F5] text-foreground rounded-xl rounded-tl-sm"
                              : "bg-[#E5F5F3] border border-[#C2E8E4] text-[#14736A] rounded-xl rounded-tl-sm"
                        }`}
                    >
                      {/* Native / Main Text */}
                      <p className="font-semibold">{turn.textNative || turn.textEn}</p>

                      {/* Secondary Translation Line */}
                      {turn.textEn && turn.textNative && turn.textEn !== turn.textNative && (
                        <p
                          className={`text-xs mt-1.5 pt-1.5 border-t ${turn.role === "patient"
                              ? "border-white/20 text-white/80"
                              : "border-border text-muted-foreground"
                            }`}
                        >
                          <span className="font-bold">English:</span> {turn.textEn}
                        </p>
                      )}

                      {/* Audio Replay Button */}
                      {turn.audioUrl && (
                        <button
                          onClick={() => playAudio(turn.audioUrl!)}
                          className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg transition shadow-xs ${currentlyPlayingUrl === turn.audioUrl
                              ? "bg-accent text-accent-foreground"
                              : turn.role === "patient"
                                ? "bg-white/20 hover:bg-white/30 text-white"
                                : "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
                            }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Play Spoken Audio</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Processing Indicator */}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-card p-3 rounded-xl border border-border w-fit animate-pulse">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span>Processing speech with local LLM & rules engine...</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Vision Camera UI */}
              {isVisionActive && (
                <div className="p-4 bg-card border-t border-border animate-in slide-in-from-bottom-2 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Camera className="w-4 h-4" /> Condition Visual Analysis
                    </h3>
                    <button onClick={stopVisionCamera} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative rounded-xl overflow-hidden bg-black h-48 flex items-center justify-center border border-border">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {visionStatus === "processing" && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-4 text-center z-10">
                        <RefreshCw className="w-6 h-6 animate-spin mb-3 text-accent" />
                        <span className="text-sm font-bold tracking-wide">Analyzing with Local Vision Model...</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={captureAndAnalyze}
                      disabled={visionStatus === "processing"}
                      className="w-full sm:w-auto px-6 py-2.5 bg-accent text-white rounded-lg text-xs font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Capture & Analyze
                    </button>
                  </div>
                </div>
              )}

              {/* Pending Nurse Finding Banner */}
              {pendingFinding && (
                <div className="p-4 bg-[#F4F0FB] border-t border-b border-[#E4D9F5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7050A8] flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Nurse Action Required
                    </h3>
                    <p className="text-foreground text-xs font-semibold mt-0.5">{pendingFinding.instruction_en}</p>
                  </div>
                  <form onSubmit={handleNurseFindingSubmit} className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      name="finding_value"
                      required
                      placeholder="Enter reading..."
                      className="h-9 px-3 border border-border rounded-lg bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button type="submit" className="bg-primary text-primary-foreground px-4 h-9 rounded-lg text-xs font-bold shadow-sm hover:opacity-90">
                      Submit
                    </button>
                  </form>
                </div>
              )}

              {/* Controls Footer */}
              <div className="p-4 sm:p-5 bg-card border-t border-border flex flex-col sm:flex-row items-center gap-4">

                {/* Text Input Fallback */}
                <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2 w-full">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your response here..."
                    className="flex-1 h-11 px-4 border border-border rounded-lg bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isProcessing || !!pendingFinding}
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isProcessing || !!pendingFinding}
                    className="px-5 h-11 bg-primary text-primary-foreground rounded-lg font-bold text-xs shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 shrink-0"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">OR</div>

                {/* Vision / Camera Button */}
                <button
                  type="button"
                  onClick={startVisionCamera}
                  disabled={isProcessing || !!pendingFinding || isVisionActive}
                  title="Capture condition photo for AI analysis"
                  className="h-11 px-4 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center bg-secondary text-primary hover:bg-secondary/80 border border-border shrink-0"
                >
                  <Camera className="w-4 h-4 text-accent" />
                </button>

                {/* Mic Recording Button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing || !!pendingFinding}
                  className={`h-11 px-6 rounded-full font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 ${isRecording ? "bg-destructive text-white hover:bg-destructive/90 animate-pulse" :
                      isProcessing || !!pendingFinding ? "bg-muted text-muted-foreground cursor-not-allowed" :
                        "bg-secondary text-primary hover:bg-secondary/80 border border-border"
                    }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 fill-white" />
                      <span>Stop ({formatTime(recordSeconds)})</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-accent" />
                      <span>Hold to Speak</span>
                    </>
                  )}
                </button>

              </div>

            </div>

            {/* Right Panel: live tele-consult + diagnostic summary */}
            <div className="lg:col-span-5 space-y-5 h-fit">

              {/* The doctor can dial in at any point in the visit, not only
                  after intake finishes — so this mounts as soon as the session
                  starts. Without it on this screen the patient had no WebRTC
                  peer at all and the doctor's offer went unanswered. */}
              <WebRtcConsultHub visitId={visitId} role="patient" userId={patientId} />

              {intakeResult && (
                <div className="bg-card rounded-xl p-6 shadow-soft border border-border space-y-5">

                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="w-10 h-10 rounded-full bg-[#E5F5F3] text-[#14736A] flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Clinical Triage Completed</p>
                      <h3 className="text-xl font-bold text-foreground">Consultation Summary</h3>
                    </div>
                  </div>

                  <div className="space-y-4">

                    {/* Urgency Level Badge */}
                    <div
                      className={`p-4 rounded-xl border font-bold text-xs flex items-center justify-between ${intakeResult.urgency_tier.tier === "urgent"
                          ? "bg-destructive/10 border-destructive/20 text-destructive"
                          : intakeResult.urgency_tier.tier === "elevated"
                            ? "bg-[#EEF3FB] border-[#D1E0F5] text-[#315A94]"
                            : "bg-[#E5F5F3] border-[#C2E8E4] text-[#14736A]"
                        }`}
                    >
                      <span>Urgency Assessment Tier</span>
                      <span className="uppercase tracking-widest text-xs px-2.5 py-1 rounded-full bg-white/80 shadow-xs">
                        {intakeResult.urgency_tier.tier} ({intakeResult.urgency_tier.flag_count} Flags)
                      </span>
                    </div>

                    {/* Chief Complaint */}
                    <div className="bg-background p-4 rounded-xl border border-border">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Chief Complaint</p>
                      <p className="text-foreground font-bold text-xs">{intakeResult.chief_complaint}</p>
                    </div>

                    {/* Narrative Summary */}
                    <div className="bg-background p-4 rounded-xl border border-border">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Diagnostic Summary</p>
                      <p className="text-foreground text-xs leading-relaxed font-medium">{intakeResult.summary_text}</p>
                      {visionDescription && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-accent" /> Visual Analysis Attached</p>
                          <p className="text-foreground text-xs leading-relaxed font-medium italic">{visionDescription}</p>
                        </div>
                      )}
                    </div>

                    {/* Urgency Rules list */}
                    {intakeResult.urgency_tier.flags.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Fired Urgency Rules</p>
                        <div className="space-y-1">
                          {intakeResult.urgency_tier.flags.map((f, i) => (
                            <div
                              key={i}
                              className="text-xs px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-semibold"
                            >
                              ⚠️ {f.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                  <div className="p-3 bg-[#E5F5F3] rounded-xl border border-[#C2E8E4] text-center">
                    <p className="text-xs text-[#14736A] font-bold">
                      ✓ Report synced to Doctor Queue via Outbox & MQTT
                    </p>
                  </div>

                </div>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
