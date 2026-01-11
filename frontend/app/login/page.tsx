"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate a brief delay for realism
        setTimeout(() => {
            router.push("/dashboard");
        }, 800);
    };

    return (
        <div className="login-container" style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-dark)",
            fontFamily: "Inter, sans-serif"
        }}>
            <div className="login-card" style={{
                width: "100%",
                maxWidth: "400px",
                padding: "40px",
                background: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                borderRadius: "16px",
                textAlign: "center"
            }}>
                <div className="logo" style={{
                    fontSize: "32px",
                    fontWeight: "800",
                    color: "var(--accent)",
                    marginBottom: "8px",
                    display: "block"
                }}>
                    TwinTrim
                </div>
                <p style={{ color: "var(--text-secondary)", marginBottom: "32px", fontSize: "14px" }}>
                    Your AI Co-Editor for Video Editing
                </p>

                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ textAlign: "left" }}>
                        <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "6px", fontWeight: "600" }}>EMAIL</label>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            defaultValue="demo@twintrim.ai"
                            style={{
                                width: "100%",
                                padding: "12px",
                                background: "var(--bg-panel)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "8px",
                                color: "white",
                                outline: "none",
                                fontSize: "14px"
                            }}
                        />
                    </div>

                    <div style={{ textAlign: "left" }}>
                        <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "6px", fontWeight: "600" }}>PASSWORD</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            defaultValue="password123"
                            style={{
                                width: "100%",
                                padding: "12px",
                                background: "var(--bg-panel)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "8px",
                                color: "white",
                                outline: "none",
                                fontSize: "14px"
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="login-btn"
                        style={{
                            padding: "14px",
                            background: "var(--accent)",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            fontWeight: "700",
                            fontSize: "15px",
                            cursor: "pointer",
                            marginTop: "12px",
                            transition: "transform 0.2s, background 0.2s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px"
                        }}
                    >
                        {isLoading ? <div className="spinner"></div> : "Login"}
                    </button>

                    <button
                        type="button"
                        onClick={handleLogin}
                        style={{
                            padding: "14px",
                            background: "transparent",
                            border: "1px solid var(--border-color)",
                            borderRadius: "8px",
                            color: "var(--text-primary)",
                            fontWeight: "600",
                            fontSize: "15px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        Create Account
                    </button>
                </form>

                <div style={{ marginTop: "24px", fontSize: "13px", color: "var(--text-muted)" }}>
                    Forgot password? <span style={{ color: "var(--accent)", cursor: "pointer" }}>Reset here</span>
                </div>
            </div>
        </div>
    );
}
