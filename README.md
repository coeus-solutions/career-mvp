# Career MVP 🚀

**Your AI Career Coach for Professional Fulfillment**

Career MVP is an innovative voice-powered AI assistant designed to help professionals navigate their career journey with confidence. Built with cutting-edge real-time voice technology, Career MVP provides personalized career coaching through natural conversation.

## ✨ Features

- **Real-time Voice Interaction**: Speak naturally with your AI career coach using advanced voice recognition and synthesis
- **WebRTC Audio Streaming**: High-quality, low-latency audio communication for seamless conversations
- **OpenAI Realtime API Integration**: Powered by OpenAI's latest realtime conversation capabilities
- **Beautiful UI/UX**: Modern, responsive interface with animated visual feedback
- **Audio Visualization**: Real-time audio level indicators and visual feedback during conversations
- **Multiple Client Implementations**: Various realtime client options for different use cases

## 🛠️ Tech Stack

- **Framework**: Next.js 15.4 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **AI Integration**: OpenAI Realtime API
- **Audio**: WebRTC, Web Audio API
- **Real-time Communication**: WebSockets

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- OpenAI API key with Realtime API access

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd career-mvp
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### Development

Run the development server:
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3002](http://localhost:3002) in your browser to see Career MVP in action.

For WebSocket server development:
```bash
npm run dev:server
```

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
career-mvp/
├── app/
│   ├── api/
│   │   ├── realtime/        # Realtime API endpoints
│   │   └── voice/           # Voice processing endpoints
│   ├── components/
│   │   ├── voice/           # Voice interface components
│   │   ├── AnimatedShapes.tsx
│   │   └── CaseyLogo.tsx
│   ├── lib/
│   │   ├── hooks/           # Custom React hooks
│   │   ├── openai/          # OpenAI client implementations
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Utility functions
│   └── test-*/              # Test pages for different implementations
├── public/                  # Static assets
├── screens/                 # Application screenshots
└── server.js               # WebSocket server
```

## 🎯 Key Components

### Voice Interface
The main voice interaction component (`VoiceInterface.tsx`) handles:
- Microphone access and audio capture
- Real-time transcription display
- AI response rendering
- Audio playback of AI responses
- Visual feedback with audio level indicators

### Realtime Clients
Multiple realtime client implementations for different scenarios:
- `casey-realtime-client.ts` - Main Career MVP client
- `proxy-realtime-client.ts` - Proxy-based implementation
- `webrtc-client.ts` - WebRTC-based client
- `simple-realtime-client.ts` - Simplified implementation

### Custom Hooks
- `useRealtimeAPI` - Main hook for managing realtime API connections and state

## 🔧 Available Scripts

- `npm run dev` - Start development server with TurboPack
- `npm run dev:server` - Start WebSocket server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🎨 Customization

### Branding
Update the logo and branding in:
- `app/components/CaseyLogo.tsx` - Logo component
- `app/page.tsx` - Main page content and messaging
- `app/globals.css` - Global styles and color scheme

### Voice Settings
Configure voice and audio settings in:
- `app/lib/utils/audio.ts` - Audio processing utilities
- `app/components/voice/VoiceInterface.tsx` - Voice interface configuration

## 📱 Browser Compatibility

Career MVP works best on modern browsers with WebRTC support:
- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

## 🔒 Security

- API keys are handled server-side
- Environment variables for sensitive data
- Secure WebSocket connections
- Audio permissions requested only when needed

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

© Career MVP – All rights reserved.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- Powered by [OpenAI](https://openai.com)
- UI components inspired by modern design principles

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Career MVP** - Empowering professionals to find their path to career fulfillment through AI-powered conversations.
