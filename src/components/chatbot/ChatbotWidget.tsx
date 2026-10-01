import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext.js';
import { useI18n } from '../../context/I18nContext.js';
import { api } from '../../lib/api.js';
import { ChatMessage, ChatAction, EscalationSummary } from '../../types.js';
import { 
  Bot, 
  X, 
  Send, 
  RotateCcw, 
  Sparkles, 
  ExternalLink, 
  ShoppingBag, 
  Package, 
  CreditCard, 
  Download, 
  User, 
  HelpCircle, 
  MessageSquare,
  ChevronDown,
  Loader2
} from 'lucide-react';

interface QuickQuestion {
  id: string;
  label: string;
  query: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ChatbotWidget: React.FC = () => {
  const { 
    siteSettings, 
    user, 
    products, 
    setActiveTab, 
    setAccountSubTab, 
    setSelectedProduct, 
    setIsRechargeModalOpen,
    setIsAuthModalOpen
  } = useStore();
  const { language } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const botConfig = siteSettings?.chatbotConfig;
  const isEnabled = botConfig ? botConfig.enabled : true;
  const botName = botConfig?.botName || 'Assistant HAITEX';

  // Quick Action Chips definitions
  const quickQuestions: QuickQuestion[] = [
    {
      id: 'products',
      label: language === 'ht' ? 'Wè pwodwi yo' : language === 'en' ? 'View products' : 'Voir les produits',
      query: language === 'ht' ? 'Ki pwodwi ki disponib nan boutik la ?' : language === 'en' ? 'What products are available?' : 'Quels produits avez-vous en stock ?',
      icon: ShoppingBag,
    },
    {
      id: 'order',
      label: language === 'ht' ? 'Suiv kòmand mwen' : language === 'en' ? 'Track order' : 'Suivre ma commande',
      query: language === 'ht' ? 'Ki kote dènye kòmand mwen an ye ?' : language === 'en' ? 'Where is my latest order?' : 'Quel est le statut de ma dernière commande ?',
      icon: Package,
    },
    {
      id: 'payment',
      label: language === 'ht' ? 'Pwoblèm peman' : language === 'en' ? 'Payment issue' : 'Problème de paiement',
      query: language === 'ht' ? 'Mwen gen yon pwoblèm ak yon peman' : language === 'en' ? 'I have a payment problem' : 'J\'ai un problème avec mon paiement NatCash / MonCash',
      icon: CreditCard,
    },
    {
      id: 'download',
      label: language === 'ht' ? 'Telechajman mwen' : language === 'en' ? 'My download' : 'Mon téléchargement',
      query: language === 'ht' ? 'Kouman pou mwen telechaje pwodwi mwen an ?' : language === 'en' ? 'How can I download my product?' : 'Comment télécharger mon produit acheté ?',
      icon: Download,
    },
    {
      id: 'wallet',
      label: language === 'ht' ? 'Bous mwen' : language === 'en' ? 'My wallet' : 'Mon portefeuille',
      query: language === 'ht' ? 'Kijan pou m recharge bous mwen an ?' : language === 'en' ? 'How to recharge my wallet?' : 'Comment recharger mon portefeuille en Gourdes ?',
      icon: CreditCard,
    },
    {
      id: 'how_to_buy',
      label: language === 'ht' ? 'Kijan pou achte ?' : language === 'en' ? 'How to buy?' : 'Comment acheter ?',
      query: language === 'ht' ? 'Kijan pou mwen achte yon pwodwi ?' : language === 'en' ? 'How do I make a purchase?' : 'Comment fonctionne l\'achat sur la boutique ?',
      icon: HelpCircle,
    },
    {
      id: 'support',
      label: language === 'ht' ? 'Kontakte sipò' : language === 'en' ? 'Contact support' : 'Contacter le support',
      query: language === 'ht' ? 'Mwen vle pale ak yon ajan sipò' : language === 'en' ? 'I want to talk to customer support' : 'Je souhaite parler au support client sur WhatsApp',
      icon: MessageSquare,
    },
  ];

  // Welcome greeting
  const getGreeting = () => {
    if (language === 'ht') {
      return botConfig?.welcomeMessage_ht || 'Bonjou ! Mwen se asistan dijital ou. Mwen ka ede w jwenn yon pwodwi, konprann kijan pou achte, verifye yon kòmand oswa jwenn èd.';
    } else if (language === 'en') {
      return botConfig?.welcomeMessage_en || 'Hello! I am your digital assistant. I can help you find products, understand purchasing, track orders, or get assistance.';
    } else {
      return botConfig?.welcomeMessage_fr || 'Bonjour ! Je suis votre assistant boutique. Je peux vous aider à trouver un produit, comprendre comment acheter, vérifier une commande ou contacter le support.';
    }
  };

  // Initialize initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: getGreeting(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [language, botConfig]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isEnabled) {
    return null;
  }

  const handleResetConversation = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: getGreeting(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setLoading(true);

    try {
      // Build history for context continuity
      const history = newMessages.slice(-6).map(m => ({
        sender: m.sender as 'user' | 'assistant',
        text: m.text,
      }));

      const res = await api.chatbot.sendMessage({
        message: text,
        history,
        lang: language,
      });

      const assistantMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: res.actions,
        escalationSummary: res.escalation,
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (!isOpen) {
        setUnreadCount(c => c + 1);
      }
    } catch (err) {
      console.error('Chatbot error:', err);
      const fallbackMsg: ChatMessage = {
        id: `bot-fallback-${Date.now()}`,
        sender: 'assistant',
        text: botConfig?.fallbackMessage || 'Le service d\'assistance est momentanément indisponible. Vous pouvez contacter le support direct.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          {
            type: 'contact_support',
            label: 'Contacter le support',
            payload: { phone: botConfig?.supportPhone || siteSettings?.supportPhone || '+509 4385-4650' }
          }
        ]
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: ChatAction) => {
    switch (action.type) {
      case 'view_product':
        if (action.payload?.productId) {
          const product = products.find(p => p.id === action.payload.productId);
          if (product) {
            setSelectedProduct(product);
          } else {
            setActiveTab('catalog');
          }
        } else {
          setActiveTab('catalog');
        }
        setIsOpen(false);
        break;

      case 'view_order':
        if (!user) {
          setIsAuthModalOpen(true);
        } else {
          setActiveTab('account');
          setAccountSubTab('orders');
        }
        setIsOpen(false);
        break;

      case 'open_library':
        if (!user) {
          setIsAuthModalOpen(true);
        } else {
          setActiveTab('account');
          setAccountSubTab('library');
        }
        setIsOpen(false);
        break;

      case 'open_wallet':
        if (!user) {
          setIsAuthModalOpen(true);
        } else {
          setIsRechargeModalOpen(true);
        }
        setIsOpen(false);
        break;

      case 'open_coupons':
        setActiveTab('cart');
        setIsOpen(false);
        break;

      case 'contact_support': {
        const phone = (action.payload?.phone || botConfig?.supportPhone || siteSettings?.supportPhone || '+509 4385-4650').replace(/[^0-9]/g, '');
        const text = encodeURIComponent('Bonjour support, je contacte le service d\'aide de la boutique.');
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
        break;
      }

      case 'quick_reply':
        if (action.payload?.text) {
          handleSendMessage(action.payload.text);
        }
        break;

      default:
        break;
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          id="btn-chatbot-trigger"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-3 sm:bottom-24 sm:right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          aria-label="Ouvrir l'assistant"
        >
          <div className="relative">
            <Bot className="w-4 h-4 text-black" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <span className="tracking-wide">Assistant</span>
          {unreadCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window Container */}
      {isOpen && (
        <div 
          id="chatbot-window"
          className="fixed bottom-0 right-0 sm:bottom-20 sm:right-6 w-full sm:w-[400px] h-[85vh] sm:h-[580px] max-h-[85vh] z-50 flex flex-col bg-[#0b101b] border border-cyan-500/30 sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-6 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-black font-bold shadow-md shadow-cyan-500/20">
                <Bot className="w-4 h-4" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0b101b]" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-['Chakra_Petch']">
                  {botName}
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                </h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  En ligne • Support & Conseils
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="btn-chatbot-reset"
                onClick={handleResetConversation}
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Recommencer la conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                id="btn-chatbot-close"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Questions Strip (Show at top of conversation) */}
          <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/80 overflow-x-auto scrollbar-none flex items-center gap-1.5 shrink-0">
            {quickQuestions.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  onClick={() => handleSendMessage(q.query)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-cyan-950 hover:border-cyan-500/40 border border-slate-700/60 text-[10px] text-slate-300 hover:text-cyan-300 font-medium whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Icon className="w-3 h-3 text-cyan-400" />
                  <span>{q.label}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-cyan-500 text-black font-medium rounded-tr-xs'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-xs whitespace-pre-line'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1">
                  {m.timestamp}
                </span>

                {/* Interactive Action Buttons */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                    {m.actions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionClick(act)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold hover:scale-102 transition-all cursor-pointer shadow-sm"
                      >
                        {act.type === 'view_product' && <ShoppingBag className="w-3 h-3" />}
                        {act.type === 'view_order' && <Package className="w-3 h-3" />}
                        {act.type === 'open_library' && <Download className="w-3 h-3" />}
                        {act.type === 'open_wallet' && <CreditCard className="w-3 h-3" />}
                        {act.type === 'contact_support' && <MessageSquare className="w-3 h-3" />}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Escalation Card if issue needs direct human contact */}
                {m.escalationSummary?.whatsappUrl && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 max-w-[90%] space-y-1.5">
                    <p className="text-[10px] text-emerald-300 font-medium">
                      💬 Besoin d'une aide directe avec notre équipe ?
                    </p>
                    <a
                      href={m.escalationSummary.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition-colors w-full justify-center"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Ouvrir WhatsApp Support
                    </a>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-400 text-[11px] max-w-[70%]">
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Assistant en train de répondre...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Input Field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={language === 'ht' ? 'Poze yon kesyon sou yon pwodwi...' : language === 'en' ? 'Ask a question about products or orders...' : 'Posez une question sur nos produits ou commandes...'}
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading}
              className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black font-bold transition-all cursor-pointer shrink-0"
              aria-label="Envoyer le message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
