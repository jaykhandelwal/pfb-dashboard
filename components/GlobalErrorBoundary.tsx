
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Fixed inheritance and state initialization to resolve "setState does not exist" and "props does not exist" errors
class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Properly call setState from within lifecycle method
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // Force a hard reload from the server, ignoring cache
    window.location.reload();
  };

  handleReset = () => {
    if (window.confirm("This will clear local app data (cache) to fix the crash. Your database data is safe. Continue?")) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <AlertTriangle size={32} />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-slate-500 mb-6 text-sm">
              The application encountered an unexpected error.
            </p>

            <div className="bg-slate-100 p-4 rounded-lg mb-6 text-left overflow-auto max-h-32">
                <p className="text-xs font-mono text-red-600 break-words">
                    {this.state.error?.toString() || "Unknown Error"}
                </p>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={this.handleReload}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={18} /> Reload App
              </button>
              
              <button 
                onClick={this.handleReset}
                className="w-full py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <Trash2 size={16} /> Clear Cache & Reset
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 mt-6">
                If this persists, please take a screenshot and send it to support.
            </p>
          </div>
        </div>
      );
    }

    // Access props.children safely from React.Component
    return this.props.children;
  }
}

export default GlobalErrorBoundary;
