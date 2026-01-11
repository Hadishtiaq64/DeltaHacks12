"use client";

import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();

    return (
        <div className="landing">
            {/* Animated Wave Background */}
            <div className="wave-bg">
                <svg viewBox="0 0 1440 600" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#1a1a2e" />
                            <stop offset="50%" stopColor="#16213e" />
                            <stop offset="100%" stopColor="#0f3460" />
                        </linearGradient>
                    </defs>
                    <path
                        className="wave wave1"
                        fill="url(#waveGradient)"
                        d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1440,200 1440,200 L1440,600 L0,600 Z"
                    />
                    <path
                        className="wave wave2"
                        fill="rgba(99, 102, 241, 0.1)"
                        d="M0,250 C200,150 400,350 600,250 C800,150 1000,350 1200,250 C1400,150 1440,250 1440,250 L1440,600 L0,600 Z"
                    />
                    <path
                        className="wave wave3"
                        fill="rgba(139, 92, 246, 0.08)"
                        d="M0,300 C200,200 400,400 600,300 C800,200 1000,400 1200,300 C1400,200 1440,300 1440,300 L1440,600 L0,600 Z"
                    />
                </svg>
            </div>

            {/* Header */}
            <header className="landing-header">
                <div className="logo-text">TwinTrim</div>
                <div className="header-buttons">
                    <button className="btn-ghost">Login</button>
                    <button className="btn-outline">Sign Up</button>
                </div>
            </header>

            {/* Hero Section */}
            <main className="hero">
                <h1 className="hero-title">
                    Where creativity
                    <br />
                    becomes <span className="gradient-text">effortless</span>
                    <br />
                    and fast
                </h1>

                <div className="hero-features">
                    <span>AI-POWERED VIDEO EDITING</span>
                    <span>•</span>
                    <span>VOICE COMMANDS</span>
                    <span>•</span>
                    <span>INSTANT TRANSFORMATIONS</span>
                </div>

                <p className="hero-description">
                    Transform your videos with the power of AI. Trim, enhance, and edit
                    using natural language or voice commands. No complex timelines needed.
                </p>

                <button
                    className="btn-primary btn-get-started"
                    onClick={() => router.push('/editor')}
                >
                    Get Started
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </button>
            </main>

            {/* Footer Glow */}
            <div className="footer-glow" />
        </div>
    );
}
