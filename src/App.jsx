import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);

  async function handleGoogleSignIn() {
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) setError(error.message);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,

        ...(mode === "signup" && {
          data: {
            full_name: name.trim(),
          },
        }),
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setLinkSent(true);
    }
  }

  if (linkSent) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">
            {mode === "login"
              ? "Login Link Sent!"
              : "Account Created!"}
          </h1>

          <p className="auth-subtitle">
            Check your inbox for a magic link sent to
            <br />
            <strong>{email}</strong>
          </p>

          <button
            className="auth-toggle"
            onClick={() => {
              setLinkSent(false);
              setEmail("");
              setName("");
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">

        <div className="auth-switch">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Login
          </button>

          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign Up
          </button>
        </div>

        <h1 className="auth-title">
          {mode === "login"
            ? "Welcome Back"
            : "Create Account"}
        </h1>

        <p className="auth-subtitle">
          {mode === "login"
            ? "Login using your email."
            : "Create your account in seconds."}
        </p>

        <button
          className="google-signin-btn"
          onClick={handleGoogleSignIn}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>

          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit}>

          {mode === "signup" && (
            <div className="field">
              <label>Name</label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div className="field">
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {error && (
            <p className="error-msg">
              {error}
            </p>
          )}

          <button
            className="btn-primary auth-submit"
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : mode === "login"
              ? "Send Login Link"
              : "Create Account"}
          </button>
        </form>

      </div>
    </div>
  );
}
