"use client";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const router = useRouter();

    return (
        <div className="dashboard-container" style={{
            minHeight: "100vh",
            background: "var(--bg-dark)",
            color: "var(--text-primary)",
            fontFamily: "Inter, sans-serif"
        }}>
            {/* Navbar */}
            <nav style={{
                height: "64px",
                padding: "0 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border-color)",
                background: "var(--bg-sidebar)"
            }}>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--accent)" }}>TwinTrim</div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bg-card)", border: "1px solid var(--border-color)" }}></div>
                </div>
            </nav>

            <main style={{ padding: "48px 32px", maxWidth: "1200px", margin: "0 auto" }}>
                <header style={{ marginBottom: "40px" }}>
                    <h1 style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}>Welcome to TwinTrim</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Create and manage your AI-powered editing projects.</p>
                </header>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: "24px"
                }}>
                    {/* Create Project Card */}
                    <div
                        onClick={() => router.push("/project")}
                        style={{
                            padding: "40px",
                            background: "var(--bg-sidebar)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "16px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "16px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
                        }}
                        className="card-hover"
                    >
                        <div style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "12px",
                            background: "var(--glow)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent)"
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "4px" }}>Create Project</div>
                            <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Start a new AI session</div>
                        </div>
                    </div>

                    {/* Dummy Project Cards */}
                    {[1, 2].map(i => (
                        <div
                            key={i}
                            style={{
                                background: "var(--bg-sidebar)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "16px",
                                overflow: "hidden",
                                opacity: 0.6
                            }}
                        >
                            <div style={{ height: "140px", background: "var(--bg-panel)" }}></div>
                            <div style={{ padding: "16px" }}>
                                <div style={{ fontWeight: "600", marginBottom: "4px" }}>Recent Project {i}</div>
                                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Edited 2 days ago</div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
