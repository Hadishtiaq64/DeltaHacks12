"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
}

interface Video {
  id: string;
  name: string;
  length: number;
  stream_url: string;
}

// Enhanced clip model for timeline
interface Clip {
  id: string;
  name: string;
  sourceId: string;          // Original video/audio ID
  sourceStart: number;       // Trim start in source (seconds)
  sourceEnd: number;         // Trim end in source (seconds)
  timelineStart: number;     // Position on timeline (seconds)
  duration: number;          // Visible duration = sourceEnd - sourceStart
  type: 'video' | 'audio';
  streamUrl?: string;
}

interface ToolResult {
  tool: string;
  arguments?: {
    start?: number;
    end?: number;
    [key: string]: unknown;
  };
  result: {
    stream_url?: string;
    videos?: Video[];
    id?: string;
    name?: string;
    length?: number;
    duration?: number;
    [key: string]: unknown;
  };
}

const API_BASE = "http://localhost:8000/api";

type Tab = "Basic" | "Effects" | "Adjust" | "Agent";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your AI video editor. I can help you:\n\n• Upload videos from URLs\n• Trim clips\n• Add text overlays\n• Render your final video\n\nTry saying: \"Upload this video: [URL]\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Agent");

  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Timeline state
  const [clips, setClips] = useState<Clip[]>([]);
  const [audioClips, setAudioClips] = useState<Clip[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Get current clip's trim state
      const currentClip = clips.find(c => c.sourceId === currentVideo?.id);

      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          video_context: currentVideo
            ? {
              current_video: currentVideo,
              clip_trim: currentClip ? {
                start: currentClip.sourceStart,
                end: currentClip.sourceEnd,
                duration: currentClip.duration
              } : null
            }
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to get response");
      }

      const data = await response.json();

      if (data.tool_results) {
        data.tool_results.forEach((tr: ToolResult) => {
          console.log("Tool result:", tr);

          if (tr.tool === "list_videos" && tr.result.videos) {
            setVideos(tr.result.videos);
          }

          if (tr.tool === "trim_video" && tr.result.stream_url) {
            const newDuration = tr.result.length || tr.result.duration ||
              ((tr.arguments?.end ?? 0) - (tr.arguments?.start ?? 0)) || 10;

            const newVideo: Video = {
              id: tr.result.id || currentVideo?.id || `video-${Date.now()}`,
              name: tr.result.name || "Trimmed Video",
              length: newDuration,
              stream_url: tr.result.stream_url
            };
            setCurrentVideo(newVideo);

            // Update clips to reflect the trim
            setClips((prev) => prev.map((clip, idx) =>
              idx === 0 ? {
                ...clip,
                duration: newDuration,
                sourceEnd: newDuration,
                streamUrl: tr.result.stream_url
              } : clip
            ));

            setTotalDuration(newDuration);
          }
          else if (
            (tr.tool === "upload_video" || tr.tool === "add_text_overlay") &&
            tr.result.stream_url
          ) {
            const newVideo: Video = {
              id: tr.result.id as string || `video-${Date.now()}`,
              name: tr.result.name as string || "Edited Video",
              length: tr.result.length as number || (tr.result.duration as number) || 0,
              stream_url: tr.result.stream_url
            };
            setCurrentVideo(newVideo);
            if (!videos.find(v => v.id === newVideo.id)) {
              setVideos((prev) => [...prev, newVideo]);
            }
          }
        });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message || "Something went wrong"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: "No audio captured." }]);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 1000) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Recording too short." }]);
          return;
        }

        await sendVoiceCommand(audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (error) {
      console.error("Mic error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Microphone access denied." }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceCommand = async (audioBlob: Blob) => {
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: "🎤 (voice command)" }]);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice.webm");
      if (currentVideo?.id) {
        formData.append("video_id", currentVideo.id);
      }

      const response = await fetch(`${API_BASE}/voice-command`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.status === "success") {
        // Show transcription
        if (data.transcription) {
          setMessages((prev) => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: "user", content: `🎤 "${data.transcription}"` };
            return newMsgs;
          });
        }

        // Show AI response
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

        // Play voice response
        if (data.voice_url) {
          const audio = new Audio(data.voice_url);
          audio.play().catch((e) => console.log("Audio playback error:", e));
        }

        // Handle tool results (video updates, etc.)
        if (data.tool_results) {
          for (const tr of data.tool_results) {
            console.log("Tool result:", tr);

            // Handle trim_video result
            if (tr.tool === "trim_video" && tr.result?.stream_url) {
              const newDuration = tr.result.duration || tr.result.length ||
                (tr.arguments?.end - tr.arguments?.start) || 10;

              setCurrentVideo((prev) => prev ? {
                ...prev,
                stream_url: tr.result.stream_url,
                length: newDuration
              } : null);

              // Update clips to reflect the trim
              setClips((prev) => prev.map((clip, idx) =>
                idx === 0 ? {
                  ...clip,
                  duration: newDuration,
                  sourceEnd: newDuration,
                  streamUrl: tr.result.stream_url
                } : clip
              ));

              setTotalDuration(newDuration);
            }
            // Handle other tools with stream_url
            else if (tr.result?.stream_url) {
              setCurrentVideo((prev) => prev ? { ...prev, stream_url: tr.result.stream_url } : null);
            }

            if (tr.result?.videos) {
              setVideos((prev) => [...prev, ...tr.result.videos]);
              if (!currentVideo && tr.result.videos.length > 0) {
                setCurrentVideo(tr.result.videos[0]);
              }
            }
          }
        }
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message || "Voice error." }]);
      }
    } catch (error) {
      console.error("Voice error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Voice command failed." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      const response = await fetch(`${API_BASE}/upload/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detail || data.message || "Upload failed";
        throw new Error(errorMsg);
      }

      const newVideo: Video = {
        id: data.id,
        name: data.name || "Imported Video",
        length: data.length || 0,
        stream_url: data.stream_url,
      };
      setVideos((prev) => [...prev, newVideo]);
      setCurrentVideo(newVideo);

      // Create a clip from the imported video
      const newClip: Clip = {
        id: `clip-${Date.now()}`,
        name: newVideo.name,
        sourceId: newVideo.id,
        sourceStart: 0,
        sourceEnd: newVideo.length,
        timelineStart: clips.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0),
        duration: newVideo.length,
        type: 'video',
        streamUrl: newVideo.stream_url,
      };
      setClips((prev) => [...prev, newClip]);
      setTotalDuration(Math.max(totalDuration, newClip.timelineStart + newClip.duration));

      setShowImportModal(false);
      setImportUrl("");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `✅ Imported video: ${newVideo.name}` },
      ]);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${errorMessage}` },
      ]);
    } finally {
      setIsImporting(false);
    }
  };

  // Sync video playback with timeline
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isDraggingPlayhead) {
        setCurrentTime(video.currentTime);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isDraggingPlayhead]);

  // Format time as mm:ss.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Playhead drag handlers
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);
    updatePlayheadPosition(e);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 80; // Subtract track-label width
    const newTime = Math.max(0, x / pixelsPerSecond);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const updatePlayheadPosition = (e: MouseEvent | React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 80); // Subtract track-label width
    const newTime = x / pixelsPerSecond;
    setCurrentTime(Math.min(newTime, totalDuration || 60));
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => updatePlayheadPosition(e);
    const handleMouseUp = () => setIsDraggingPlayhead(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, pixelsPerSecond, totalDuration]);

  // Clip trim handlers
  const handleClipTrimStart = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const startX = e.clientX;
    const originalStart = clip.sourceStart;
    const originalTimelineStart = clip.timelineStart;
    const originalDuration = clip.duration;

    const handleMove = (moveE: MouseEvent) => {
      const deltaX = moveE.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newSourceStart = Math.max(0, originalStart + deltaTime);
      const trimAmount = newSourceStart - originalStart;

      setClips(prev => prev.map(c =>
        c.id === clipId ? {
          ...c,
          sourceStart: newSourceStart,
          timelineStart: originalTimelineStart + trimAmount,
          duration: originalDuration - trimAmount,
        } : c
      ));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleClipTrimEnd = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const startX = e.clientX;
    const originalEnd = clip.sourceEnd;
    const originalDuration = clip.duration;

    const handleMove = (moveE: MouseEvent) => {
      const deltaX = moveE.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newDuration = Math.max(0.5, originalDuration + deltaTime);

      setClips(prev => prev.map(c =>
        c.id === clipId ? {
          ...c,
          sourceEnd: clip.sourceStart + newDuration,
          duration: newDuration,
        } : c
      ));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Clip drag handler
  const handleClipDrag = (clipId: string, e: React.MouseEvent) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const startX = e.clientX;
    const originalTimelineStart = clip.timelineStart;

    const handleMove = (moveE: MouseEvent) => {
      const deltaX = moveE.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newTimelineStart = Math.max(0, originalTimelineStart + deltaTime);

      setClips(prev => prev.map(c =>
        c.id === clipId ? { ...c, timelineStart: newTimelineStart } : c
      ));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Zoom controls
  const handleZoomIn = () => setPixelsPerSecond(prev => Math.min(200, prev * 1.25));
  const handleZoomOut = () => setPixelsPerSecond(prev => Math.max(10, prev / 1.25));


  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <Link href="/" className="logo">
          TwinTrim <span className="logo-badge">BETA</span>
        </Link>
        <div className="header-actions">
          <button className="header-btn header-btn-secondary" onClick={() => window.open(currentVideo?.stream_url, "_blank")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Export
          </button>
          <button className="header-btn header-btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
          <button className="header-btn header-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Pro
          </button>
        </div>
      </header>

      {/* Left Sidebar */}
      <div className="sidebar-left">
        <span className="sidebar-title">Media Library</span>
        <button className="import-btn" onClick={() => setShowImportModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import Media
        </button>

        <div className="sidebar-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Local Files
        </div>
        <div className="sidebar-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Recent Media
        </div>
      </div>

      {/* Main Video Area */}
      <div className="video-area">
        <div className={`video-container ${currentVideo ? 'has-video' : ''}`}>
          {currentVideo ? (
            <>
              {/* Black overlay when playhead is past clip end */}
              {clips.length > 0 && currentTime > clips.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0) && (
                <div className="video-ended-overlay">
                  <span>End of Timeline</span>
                </div>
              )}
              <video
                ref={videoRef}
                src={currentVideo.stream_url}
                controls
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{
                  opacity: clips.length > 0 && currentTime > clips.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0) ? 0 : 1
                }}
              />
            </>
          ) : (
            <div className="upload-prompt">
              <div className="upload-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="upload-title">Upload your video</div>
                <div className="upload-subtitle">Drag & drop your video file here</div>
              </div>
              <button className="browse-btn" onClick={() => setShowImportModal(true)}>Browse Files</button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="panel-right">
        <div className="panel-tabs">
          {["Basic", "Effects", "Adjust", "Agent"].map((tab) => (
            <div
              key={tab}
              className={`panel-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab as Tab)}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className="panel-content">
          {activeTab === "Agent" ? (
            <div className="agent-chat">
              <div className="agent-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`agent-message ${msg.role}`}>
                    {msg.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="agent-message assistant">
                    <span className="loading"><div className="spinner"></div> Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="agent-input-area">
                <input
                  className="agent-input"
                  placeholder="Ask AI to edit..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading || isRecording}
                />
                <button
                  className={`agent-mic ${isRecording ? "recording" : ""}`}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isLoading}
                  title="Hold to speak"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                <button className="agent-send" onClick={sendMessage} disabled={isLoading || !input.trim()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Placeholder UI for other tabs */}
              <div className="panel-section">
                <div className="panel-section-title">Adjustments</div>
                <button className="panel-btn panel-btn-full">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                  Auto Adjust
                </button>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Speed</div>
                <button className="panel-btn panel-btn-full">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Adjust Speed
                </button>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Enhancement</div>
                <button className="panel-btn panel-btn-full">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                    <path d="M8.5 8.5v.01" />
                    <path d="M16 16v.01" />
                    <path d="M12 12v.01" />
                  </svg>
                  AI Enhance
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="timeline">
        <div className="timeline-header">
          <div className="timeline-title">
            Timeline
            {clips.length > 0 && <span className="timeline-time">{formatTime(currentTime)}</span>}
          </div>
          {clips.length > 0 && (
            <div className="timeline-actions">
              <button className="timeline-btn" onClick={handleZoomOut} title="Zoom Out">−</button>
              <span className="zoom-level">{Math.round(pixelsPerSecond)}px/s</span>
              <button className="timeline-btn" onClick={handleZoomIn} title="Zoom In">+</button>
              <button className="timeline-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                </svg>
                Split
              </button>
            </div>
          )}
        </div>

        {clips.length > 0 ? (
          <>
            {/* Time Ruler */}
            <div className="time-ruler" style={{ width: Math.max(800, (totalDuration || 30) * pixelsPerSecond) }}>
              {Array.from({ length: Math.ceil((totalDuration || 30) / 5) + 1 }).map((_, i) => (
                <div key={i} className="time-mark" style={{ left: i * 5 * pixelsPerSecond }}>
                  <span>{formatTime(i * 5).slice(0, 5)}</span>
                </div>
              ))}
            </div>

            {/* Timeline Tracks */}
            <div
              className="timeline-tracks"
              ref={timelineRef}
              onClick={handleTimelineClick}
              style={{ width: Math.max(800, (totalDuration || 30) * pixelsPerSecond) }}
            >
              {/* Video Track */}
              <div className="track">
                <div className="track-label">🎬 Video</div>
                <div className="track-content">
                  {clips.filter(c => c.type === 'video').map((clip) => (
                    <div
                      key={clip.id}
                      className={`timeline-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                      style={{
                        left: clip.timelineStart * pixelsPerSecond,
                        width: clip.duration * pixelsPerSecond,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                      }}
                      onMouseDown={(e) => {
                        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('clip-body')) {
                          handleClipDrag(clip.id, e);
                        }
                      }}
                    >
                      <div
                        className="clip-handle clip-handle-left"
                        onMouseDown={(e) => handleClipTrimStart(clip.id, e)}
                      />
                      <div className="clip-body">
                        <span className="clip-name">{clip.name}</span>
                        <span className="clip-duration">{clip.duration.toFixed(1)}s</span>
                      </div>
                      <div
                        className="clip-handle clip-handle-right"
                        onMouseDown={(e) => handleClipTrimEnd(clip.id, e)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Audio Track */}
              <div className="track">
                <div className="track-label">🎵 Audio</div>
                <div className="track-content">
                  {audioClips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`timeline-clip audio-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                      style={{
                        left: clip.timelineStart * pixelsPerSecond,
                        width: clip.duration * pixelsPerSecond,
                      }}
                    >
                      <div className="clip-body">
                        <span className="clip-name">{clip.name}</span>
                      </div>
                    </div>
                  ))}
                  {audioClips.length === 0 && (
                    <div className="track-empty">Drop audio here</div>
                  )}
                </div>
              </div>

              {/* Playhead */}
              <div
                className="playhead"
                style={{ left: 80 + currentTime * pixelsPerSecond }}
                onMouseDown={handlePlayheadMouseDown}
              >
                <div className="playhead-handle" />
                <div className="playhead-line" />
              </div>
            </div>
          </>
        ) : (
          /* Empty State - Clean like CapCut */
          <div className="timeline-empty-state">
            <div className="empty-state-content">
              <svg width="48\" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <p>Import a video to start editing</p>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Import Video</div>
            <div className="modal-subtitle">Enter a video URL (YouTube, direct MP4 link, etc.)</div>
            <input
              type="text"
              className="modal-input"
              placeholder="https://example.com/video.mp4"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleImport()}
            />
            <div className="modal-actions">
              <button className="header-btn header-btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="header-btn header-btn-primary" onClick={handleImport} disabled={isImporting || !importUrl.trim()}>
                {isImporting ? <span className="loading"><div className="spinner"></div> Importing...</span> : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
