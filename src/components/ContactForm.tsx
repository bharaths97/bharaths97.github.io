import { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface ContactFormContent {
  terminalLabel: string;
  successTitle: string;
  successMessage: string;
  labels: {
    name: string;
    email: string;
    subject: string;
    message: string;
  };
  placeholders: {
    name: string;
    email: string;
    subject: string;
    message: string;
  };
  submitDefault: string;
  submitSending: string;
  errorMessage: string;
  statusLabel: string;
  readyLabel: string;
  connectionLabel: string;
  connectionValue: string;
  encryptionLabel: string;
  encryptionValue: string;
}

interface ContactFormProps {
  content: ContactFormContent;
}

export function ContactForm({ content }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    setTimeout(() => {
      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });

      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }, 1300);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const statusValue = status === 'idle' ? content.readyLabel : status.toUpperCase();

  return (
    <div className="relative">
      <div className="border border-green-matrix/50 bg-black-light">
        <div className="border-b border-green-matrix/30 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-matrix/70" />
          </div>
          <span className="text-green-dark text-sm font-mono ml-4">{content.terminalLabel}</span>
        </div>

        <div className="p-6 md:p-8">
          {status === 'success' ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-matrix mx-auto mb-4" />
              <h3 className="text-2xl text-green-matrix mb-2">{content.successTitle}</h3>
              <p className="text-green-dark font-mono">{content.successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-green-matrix mb-2 font-mono text-sm">
                  {content.labels.name}
                  {focusedField === 'name' && <span className="ml-2 text-green-dark animate-pulse">_</span>}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="w-full bg-black-deep border border-green-matrix/30 text-green-matrix px-4 py-3 focus:border-green-matrix focus:outline-none focus:ring-1 focus:ring-green-matrix transition-all duration-300 font-mono"
                  placeholder={content.placeholders.name}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-green-matrix mb-2 font-mono text-sm">
                  {content.labels.email}
                  {focusedField === 'email' && <span className="ml-2 text-green-dark animate-pulse">_</span>}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="w-full bg-black-deep border border-green-matrix/30 text-green-matrix px-4 py-3 focus:border-green-matrix focus:outline-none focus:ring-1 focus:ring-green-matrix transition-all duration-300 font-mono"
                  placeholder={content.placeholders.email}
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-green-matrix mb-2 font-mono text-sm">
                  {content.labels.subject}
                  {focusedField === 'subject' && <span className="ml-2 text-green-dark animate-pulse">_</span>}
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('subject')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="w-full bg-black-deep border border-green-matrix/30 text-green-matrix px-4 py-3 focus:border-green-matrix focus:outline-none focus:ring-1 focus:ring-green-matrix transition-all duration-300 font-mono"
                  placeholder={content.placeholders.subject}
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-green-matrix mb-2 font-mono text-sm">
                  {content.labels.message}
                  {focusedField === 'message' && <span className="ml-2 text-green-dark animate-pulse">_</span>}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('message')}
                  onBlur={() => setFocusedField(null)}
                  required
                  rows={6}
                  className="w-full bg-black-deep border border-green-matrix/30 text-green-matrix px-4 py-3 focus:border-green-matrix focus:outline-none focus:ring-1 focus:ring-green-matrix transition-all duration-300 resize-none font-mono"
                  placeholder={content.placeholders.message}
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="flex-1 group relative px-6 py-3 border border-green-matrix text-green-matrix hover:bg-green-matrix hover:text-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
                >
                  {status === 'sending' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-green-matrix border-t-transparent rounded-full animate-spin" />
                      <span>{content.submitSending}</span>
                    </>
                  ) : (
                    <>
                      <span>{content.submitDefault}</span>
                      <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}

                  <div className="absolute inset-0 bg-green-matrix/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left -z-10" />
                </button>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 text-destructive border border-destructive/50 px-4 py-3 bg-destructive/5">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-mono text-sm">{content.errorMessage}</span>
                </div>
              )}

              <div className="border-t border-green-matrix/30 pt-4 mt-6">
                <div className="text-green-darker text-xs font-mono space-y-1">
                  <p>{`> ${content.statusLabel}: ${statusValue}`}</p>
                  <p>{`> ${content.connectionLabel}: ${content.connectionValue}`}</p>
                  <p>{`> ${content.encryptionLabel}: ${content.encryptionValue}`}</p>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="absolute -top-2 -left-2 w-16 h-16 border-t-2 border-l-2 border-green-matrix/30" />
      <div className="absolute -bottom-2 -right-2 w-16 h-16 border-b-2 border-r-2 border-green-matrix/30" />
    </div>
  );
}
