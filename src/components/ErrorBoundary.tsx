import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary Caught]', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '';
    window.location.pathname = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] p-6 flex flex-col items-center justify-center text-center bg-slate-900/60 border border-slate-800 rounded-2xl my-4 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100 mb-1">
            {this.props.fallbackTitle || 'Yon ti pwoblèm afichaj'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
            {this.props.fallbackMessage || 'Pati sa a rankontre yon erè tanporè. Rès boutik la ap fonksyone nòmalman.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Eseye ankò
            </button>
            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Paj Akèy
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
