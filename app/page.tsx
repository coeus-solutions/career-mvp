import VoiceInterface from '@/app/components/voice/VoiceInterface';
import CaseyLogo from '@/app/components/CaseyLogo';
import AnimatedShapes from '@/app/components/AnimatedShapes';

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background gradient similar to screens */}
      <div className="absolute inset-0 casey-gradient-bg opacity-40" />
      
      {/* Animated abstract shapes */}
      <AnimatedShapes />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <div className="flex flex-col items-center justify-center min-h-[85vh] space-y-8 sm:space-y-12">
          
          {/* CASEY Logo */}
          <div className="animate-fadeIn">
            <CaseyLogo />
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-4 max-w-2xl animate-fadeIn">
            <h1 className="text-5xl sm:text-6xl font-bold text-[#4169E1]">
              Hello <span className="inline-block animate-pulse">👋</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed px-4">
              Your AI Career Coach on your journey to finding Professional Fulfillment
            </p>
          </div>

          {/* Voice Interface Card */}
          <div className="w-full max-w-lg bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 sm:p-8 animate-fadeIn">
            <VoiceInterface />
          </div>

          {/* Footer */}
          <div className="text-center mt-8 animate-fadeIn">
            <p className="text-sm text-gray-500">
              © CASEY – All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

