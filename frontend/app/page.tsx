"use client";

import { useState, useRef, useEffect } from "react";

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

interface ToolResult {
  tool: string;
  result: {
    stream_url?: string;
    videos?: Video[];
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

  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          video_context: currentVideo
            ? { current_video: currentVideo }
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
          if (tr.tool === "list_videos" && tr.result.videos) {
            setVideos(tr.result.videos);
          }
          if (
            (tr.tool === "upload_video" || tr.tool === "trim_video" || tr.tool === "add_text_overlay") &&
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
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      const newVideo: Video = {
        id: data.id,
        name: data.name || "Imported Video",
        length: data.length || 0,
        stream_url: data.stream_url,
      };
      setVideos((prev) => [...prev, newVideo]);
      setCurrentVideo(newVideo);
      setShowImportModal(false);
      setImportUrl("");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `✅ Imported video: ${newVideo.name}` },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Failed to import video. Check the URL." },
      ]);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          Frame <span className="logo-badge">BETA</span>
        </div>
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
            <video
              ref={videoRef}
              src={currentVideo.stream_url}
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
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
                  disabled={isLoading}
                />
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
          <div className="timeline-title">Timeline</div>
          <div className="timeline-actions">
            <button className="timeline-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" />
                <path d="M8.12 14.71a3 3 0 0 0-4.24 0" />
                <path d="M15.88 20.29a3 3 0 0 0-4.24 0" />
              </svg>
              Split
            </button>
            <button className="timeline-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              AI Cut
            </button>
          </div>
        </div>
        <div className={`timeline-content ${videos.length > 0 ? 'has-clips' : ''}`}>
          {videos.length > 0 ? (
            videos.map((video) => (
              <div key={video.id} className="timeline-clip" onClick={() => setCurrentVideo(video)}>
                {video.name}
              </div>
            ))
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <div className="timeline-placeholder">Upload a video to see the timeline</div>
            </>
          )}
        </div>
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
