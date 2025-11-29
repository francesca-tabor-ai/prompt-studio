import { useState } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import { Sparkles } from 'lucide-react';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-cadet via-yale-blue to-light-sea-green flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      <div className="relative z-10 w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        <div className="text-white space-y-6 hidden md:block">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-green-yellow to-jungle-green rounded-lg flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bebas tracking-wide">PROMPT STUDIO</h1>
              <p className="text-sm text-white/80">AI Prompt Engineering Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold leading-tight">
            Enterprise-Grade Prompt Management
          </h2>

          <p className="text-lg text-white/90 leading-relaxed">
            Streamline your AI workflows with powerful tools for creating, testing, and managing prompts across your organization.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-green-yellow font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">AI-Powered Generation</h3>
                <p className="text-white/80 text-sm">
                  Create optimized prompts with AI assistance tailored to your specific needs
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-green-yellow font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Real-Time Testing</h3>
                <p className="text-white/80 text-sm">
                  Test and refine prompts in a sandbox environment with instant feedback
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-green-yellow font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Collaborative Review</h3>
                <p className="text-white/80 text-sm">
                  Peer review system with ratings and AI suggestions for continuous improvement
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-green-yellow font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Enterprise Analytics</h3>
                <p className="text-white/80 text-sm">
                  Track performance metrics and usage across departments with detailed insights
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/20">
            <p className="text-sm text-white/70">
              Trusted by leading organizations for AI prompt management
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={() => window.location.reload()}
              onSwitchToRegister={() => setMode('register')}
            />
          ) : (
            <RegisterForm
              onSuccess={() => setMode('login')}
              onSwitchToLogin={() => setMode('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
